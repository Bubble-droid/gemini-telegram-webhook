// src/utils/formatting/send_formatted_message.ts

import { formatText } from './formatters';
import { balanceChunkTags } from './tag_balancing';
import { splitFormattedText } from './chunk_splitting';
import { scheduleDeletion } from '@/utils/scheduler_task';
import { Log, TelegramBot, TelegramError } from '@/services';
import type { ParseMode } from '@/types';

/**
 * 发送 Telegram 消息，支持文本分割、按块格式化回退和未闭合标签处理。
 * 优先使用 HTML 格式，失败则回退到 MarkdownV2，然后 Markdown (Legacy)，最后纯文本。
 * 对原始超长文本按 4000 字符分割，并尝试在分割点闭合常见的行内格式。
 *
 * @param {number} chatId - 目标聊天 ID。
 * @param {string} standardMarkdownText - 标准 Markdown 格式的输入文本。
 * @param {number | null} replyToMessageId - (可选) 如果需要回复某条消息，则指定 messageId。
 * @returns {Promise<{ok: boolean, messageId?: number, error?: TelegramError}>} 发送结果。成功时返回最后一条消息的 messageId。
 */
export const sendFormattedMessage = async (
  chatId: number,
  standardMarkdownText: string,
  replyToMessageId: number,
): Promise<{ ok: boolean; messageId?: number; error?: TelegramError }> => {
  const modesToTry: (ParseMode | null)[] = ['HTML', 'MarkdownV2', 'Markdown', null]; // null 代表纯文本模式
  let lastMessageId: number | undefined = undefined;
  let lastError: TelegramError | null = null;
  let currentReplyTo: number = replyToMessageId;

  // 跟踪原始文本中已经成功发送的字符数
  let originalTextSentLength: number = 0;

  try {
    // 外层循环：尝试不同的格式模式
    for (const mode of modesToTry) {
      Log.info(`尝试使用 ${mode === null ? '纯文本' : mode} 格式处理剩余文本...`);

      // 获取当前模式需要处理的剩余原始文本
      const remainingOriginalText: string = standardMarkdownText.substring(originalTextSentLength);

      if (remainingOriginalText.length === 0) {
        Log.info(`剩余原始文本已发送完毕.`);
        // 如果所有文本都已发送，且这是最后一个模式（或成功模式），则返回成功
        if (lastMessageId) {
          return { ok: true, messageId: lastMessageId };
        } else {
          // 如果没有任何消息成功发送 (例如，输入是空字符串)
          return { ok: true, messageId: undefined };
        }
      }

      let formattedText: string;
      try {
        // 1. 格式化剩余原始文本
        formattedText = formatText(remainingOriginalText, mode);
      } catch (e: unknown) {
        Log.error(`格式化剩余文本为 ${mode === null ? '纯文本' : mode} 失败:`, { err: e as TelegramError });
        lastError = e as TelegramError;
        continue; // 格式化失败，尝试下一个模式
      }

      // 2. 分割格式化后的文本 (不在此处平衡标签)
      const rawChunks: string[] = splitFormattedText(formattedText, mode);
      Log.info(`格式化后的剩余文本被分割成 ${rawChunks.length} 块.`);

      let modeSuccessForRemaining: boolean = true; // 标记当前模式是否成功发送了所有剩余块
      let chunkIndex: number = 0; // 当前正在发送的原始块的索引
      let inheritedOpenTags: string[] = []; // 跟踪从前一个块继承的开放标记栈

      // 3. 逐块发送消息
      while (chunkIndex < rawChunks.length) {
        const rawChunk: string = rawChunks[chunkIndex];

        // 4. 平衡当前块的标签 (添加继承的开放标签和块末尾的闭合标签)
        const { balancedChunk, nextInheritedOpenTags } = balanceChunkTags(rawChunk, mode, inheritedOpenTags);
        inheritedOpenTags = nextInheritedOpenTags; // 更新下一个块需要继承的状态

        Log.info(
          `发送第 ${originalTextSentLength + chunkIndex + 1} 条消息 (当前块 ${chunkIndex + 1}/${rawChunks.length}, 长度: ${balancedChunk.length})...`,
        );

        // Telegram API 对消息长度有严格限制，空消息或过短消息也可能失败
        if (balancedChunk.trim().length === 0) {
          Log.info(`跳过发送空消息块 (格式: ${mode === null ? '纯文本' : mode}).`);
          // 跳过空块，但需要更新 originalTextSentLength 以便后续模式从正确位置开始
          // 这里估算跳过的原始文本长度，仍然不精确
          originalTextSentLength += rawChunk.length; // 使用原始块长度估算
          chunkIndex++; // 跳过空块，处理下一块
          lastError = null; // 清除错误状态
          continue;
        }

        const sendResult = await TelegramBot.sendMessage(chatId, balancedChunk, mode === null ? undefined : mode, currentReplyTo, false);

        if (sendResult.ok) {
          Log.info(`消息块发送成功 (格式: ${mode === null ? '纯文本' : mode}).`);
          void scheduleDeletion({ chat_id: chatId, message_id: sendResult.messageId }, 24 * 60 * 60_000);
          lastMessageId = sendResult.messageId; // 更新最后一条消息 ID
          currentReplyTo = sendResult.messageId; // 下一块回复当前块
          // 成功发送当前块，更新已发送的原始文本长度 (估算值)
          originalTextSentLength += rawChunk.length; // 使用原始块长度估算

          chunkIndex++; // 成功发送当前块，处理下一块
          lastError = null; // 清除错误状态
        } else {
          Log.error(`消息块发送失败 (格式: ${mode === null ? '纯文本' : mode}).`);
          lastError = sendResult.error; // 记录当前块的错误
          modeSuccessForRemaining = false; // 当前模式未能成功发送所有剩余块
          // 当前模式失败，跳出块循环，尝试下一个模式处理从失败点开始的剩余原始文本
          break;
        }
      }

      // 如果当前模式成功发送了所有剩余块
      if (modeSuccessForRemaining) {
        Log.info(`${mode === null ? '纯文本' : mode} 格式成功发送了所有剩余文本.`);
        // 整个发送过程成功，因为所有文本都已发送
        return { ok: true, messageId: lastMessageId };
      }

      // 如果当前模式失败，外层循环将继续，尝试下一个模式处理从失败点开始的剩余原始文本
      // originalTextSentLength 保持在失败块之前的状态，确保下一模式从正确位置开始
      // inheritedOpenTags 也需要重置，因为换了格式模式
      inheritedOpenTags = [];
    }
  } catch (error: unknown) {
    lastError = error as TelegramError;
  }

  // 如果所有模式都失败了
  Log.error('所有格式化模式发送均失败.');
  return { ok: false, error: lastError || new TelegramError('所有格式化模式发送失败') };
};
