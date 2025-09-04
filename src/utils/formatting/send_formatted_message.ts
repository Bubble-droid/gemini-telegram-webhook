import { formatText } from './formatters';
import { balanceChunkTags } from './tag_balancing';
import { splitFormattedText } from './chunk_splitting';
import { scheduleDeletion } from '@/utils/scheduler_task';
import { Log, makeInlineKeyboard, bot, TelegramError } from '@/services';
import type { ParseMode, ReplyMarkup } from '@/types';

/**
 * 发送 Telegram 消息，支持文本分割、多模式回退和未闭合标签处理。
 *
 * 最终策略：
 * 1.  **原子化尝试**：将每种 parseMode 的尝试视为一个原子操作。如果该模式下的任何一个消息块发送失败，
 *     则认为整个模式失败，并用下一个模式从头开始处理全部原始文本。
 * 2.  **失败后清理**：在一个模式的发送过程中，如果某个块发送失败，立即删除该模式下已经成功发送的所有消息，
 *     以避免给用户造成消息重复的困扰。
 *
 * @param {number} chatId - 目标聊天 ID。
 * @param {string} standardMarkdownText - 标准 Markdown 格式的输入文本。
 * @param {number | null} replyToMessageId - (可选) 如果需要回复某条消息，则指定 messageId。
 * @param {number} userId - 发起请求的用户 ID。
 * @returns {Promise<{ok: boolean, messageId?: number, error?: TelegramError}>} 发送结果。成功时返回最后一条消息的 messageId。
 */
export const sendFormattedMessage = async (
  chatId: number,
  standardMarkdownText: string,
  replyToMessageId: number,
  userId: number,
): Promise<{ ok: true; messageId?: number } | { ok: false; error: TelegramError }> => {
  if (!standardMarkdownText || standardMarkdownText.trim().length === 0) {
    return { ok: true, messageId: undefined };
  }

  const modesToTry: (ParseMode | null)[] = ['HTML', 'MarkdownV2', 'Markdown', null];
  let lastError: string | null = null;

  for (const mode of modesToTry) {
    Log.info(`尝试使用 [${mode ?? '纯文本'}] 格式发送全部消息...`);

    // --- 新增：用于追踪当前模式下已发送的消息ID，以便失败时清理 ---
    const sentMessageIdsInCurrentAttempt: number[] = [];

    let lastMessageId: number | undefined;
    let currentReplyTo: number = replyToMessageId;
    let modeSucceeded = true;

    try {
      const formattedText = formatText(standardMarkdownText, mode);
      const chunks = splitFormattedText(formattedText, mode);
      Log.info(`[${mode ?? '纯文本'}] 格式的文本被分割成 ${chunks.length} 块.`);

      let inheritedOpenTags: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const rawChunk = chunks[i];

        if (rawChunk.trim().length === 0) {
          Log.info(`跳过发送空消息块 (块 ${i + 1}/${chunks.length})`);
          continue;
        }

        const { balancedChunk, nextInheritedOpenTags } = balanceChunkTags(rawChunk, mode, inheritedOpenTags);
        inheritedOpenTags = nextInheritedOpenTags;

        Log.info(`发送消息 (块 ${i + 1}/${chunks.length}, 长度: ${balancedChunk.length}, 格式: ${mode ?? '纯文本'})...`);

        const replyMarkup: ReplyMarkup = {
          inline_keyboard: makeInlineKeyboard(userId),
        };

        const sendResult = await bot.sendMessage(chatId, balancedChunk, {
          replyToMessageId: currentReplyTo,
          parseMode: mode === null ? undefined : mode,
          replyMarkup,
        });

        if (sendResult.ok) {
          Log.info(`消息块 ${i + 1}/${chunks.length} 发送成功.`);

          // --- 新增：记录已发送的消息ID ---
          sentMessageIdsInCurrentAttempt.push(sendResult.messageId);

          scheduleDeletion({ chat_id: chatId, message_id: sendResult.messageId }, 24 * 60 * 60_000);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
        } else {
          Log.error(`消息块 ${i + 1}/${chunks.length} 发送失败 (格式: ${mode ?? '纯文本'}).`, { err: sendResult.error });
          lastError = sendResult.error;
          modeSucceeded = false;

          // --- 新增：核心清理逻辑 ---
          if (sentMessageIdsInCurrentAttempt.length > 0) {
            Log.warn(`[${mode ?? '纯文本'}] 模式发送中断，开始清理 ${sentMessageIdsInCurrentAttempt.length} 条已发送的消息...`);
            bot.deleteMessages(chatId, sentMessageIdsInCurrentAttempt);
            Log.info('后台进行清理操作。');
          }
          break; // 中断当前模式的发送循环
        }
      }

      if (modeSucceeded) {
        Log.info(`所有消息均已使用 [${mode ?? '纯文本'}] 格式成功发送.`);
        return { ok: true, messageId: lastMessageId };
      }

      Log.warn(`[${mode ?? '纯文本'}] 格式发送失败，将尝试下一个格式...`);
    } catch (formatError: unknown) {
      const errorMessage = formatError instanceof Error ? formatError.message : String(formatError);
      Log.error(`在处理 [${mode ?? '纯文本'}] 格式时发生严重错误.`, { err: errorMessage });
      lastError = errorMessage;
    }
  }

  Log.error('所有格式化模式均发送失败。');
  return { ok: false, error: new TelegramError(`所有格式化模式发送失败，${lastError}`, 'ALL_FORMAT_MODES_FAILED') };
};
