// src/utils/formatting/send_formatted_message.ts

import { formatter } from './formatter';
import { splitAstAndGenerateChunks } from './chunk_splitting';
import { scheduleDeletion } from '@/utils/scheduler_task';
import { Log, makeInlineKeyboard, bot, TelegramError } from '@/services';
import type { ParseMode, ReplyMarkup } from '@/types';
import { preprocessMarkdown } from './preprocessor';

const MAX_CONTENT_LENGTH = 4096;

/**
 * 简单的纯文本分割函数，确保在回退到纯文本模式时不会因消息超长而失败。
 * @param text - 原始文本。
 * @param maxLength - 每块的最大长度。
 * @returns {string[]} 分割后的文本块数组。
 */
const splitPlainText = (text: string, maxLength: number): string[] => {
  // 关键修复：使用码点计数法进行初始长度检查，确保准确性。
  if ([...text].length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    // 优先在换行符处分割
    let splitIndex = remainingText.lastIndexOf('\n', maxLength);
    // 其次在空格处分割
    if (splitIndex === -1) {
      splitIndex = remainingText.lastIndexOf(' ', maxLength);
    }
    // 如果都找不到，则硬分割
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = maxLength;
    }

    chunks.push(remainingText.substring(0, splitIndex));
    remainingText = remainingText.substring(splitIndex).trimStart();
  }

  return chunks;
};

/**
 * 发送 Telegram 消息，使用 AST 进行精确的文本分割和格式化，并支持多模式回退。
 *
 * @param {number} chatId - 目标聊天 ID。
 * @param {string} standardMarkdownText - 标准 Markdown 格式的输入文本。
 * @param {number} replyToMessageId - 如果需要回复某条消息，则指定 messageId。
 * @param {number} userId - 发起请求的用户 ID。
 * @returns {Promise<{ok: boolean, messageId?: number, error?: TelegramError}>} 发送结果。
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
  let lastError: TelegramError | null = null;

  // 2. 在解析前，应用预处理器
  // 关键修改：在解析前，先对原始 Markdown 进行预处理
  const processedText = preprocessMarkdown(standardMarkdownText);

  // 1. 首先，一次性将 Markdown 解析为 AST
  const ast = formatter.parse(processedText); // <--- 使用处理后的文本

  for (const mode of modesToTry) {
    Log.info(`尝试使用 [${mode ?? '纯文本'}] 格式发送全部消息...`);
    const sentMessageIdsInCurrentAttempt: number[] = [];
    let lastMessageId: number | undefined;
    let currentReplyTo: number = replyToMessageId;
    let modeSucceeded = true;

    try {
      let chunks: string[];

      if (mode === null) {
        // 潜在问题修复：对于纯文本模式，也需要进行分割以防超长
        chunks = splitPlainText(processedText, MAX_CONTENT_LENGTH);
      } else {
        // 2. 获取对应模式的生成器
        const generator = formatter.getGenerator(mode);
        // 3. 基于 AST 和生成器，直接得到最终的消息块数组
        chunks = splitAstAndGenerateChunks(ast, generator);
      }

      Log.info(`[${mode ?? '纯文本'}] 格式的文本被分割成 ${chunks.length} 块.`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        Log.info(`发送消息 (块 ${i + 1}/${chunks.length}, 长度: ${[...chunk].length}, 格式: ${mode ?? '纯文本'})...`);

        const replyMarkup: ReplyMarkup = { inline_keyboard: makeInlineKeyboard(userId) };
        const sendResult = await bot.sendMessage(chatId, chunk, {
          replyToMessageId: currentReplyTo,
          parseMode: mode === null ? undefined : mode,
          replyMarkup,
        });

        if (sendResult.ok) {
          Log.info(`消息块 ${i + 1}/${chunks.length} 发送成功.`);
          sentMessageIdsInCurrentAttempt.push(sendResult.messageId);
          scheduleDeletion(chatId, sendResult.messageId, 24 * 60 * 60_000);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
        } else {
          Log.error(`消息块 ${i + 1}/${chunks.length} 发送失败.`, { err: sendResult.error });
          lastError = new TelegramError(sendResult.error);
          modeSucceeded = false;

          if (sentMessageIdsInCurrentAttempt.length > 0) {
            Log.warn(`[${mode ?? '纯文本'}] 模式发送中断，开始清理 ${sentMessageIdsInCurrentAttempt.length} 条已发送的消息...`);
            const deleteResult = await bot.deleteMessages(chatId, sentMessageIdsInCurrentAttempt);
            if (deleteResult.ok) {
              Log.info('清理操作完成。');
            } else {
              Log.error('清理发生错误，为了不影响任务执行，将继续处理');
            }
          }
          break; // 中断当前模式
        }
      }

      if (modeSucceeded) {
        Log.info(`所有消息均已使用 [${mode ?? '纯文本'}] 格式成功发送.`);
        return { ok: true, messageId: lastMessageId };
      }
      Log.warn(`[${mode ?? '纯文本'}] 格式发送失败，将尝试下一个格式...`);
    } catch (error: unknown) {
      lastError = new TelegramError(error instanceof Error ? error.message : String(error));
      Log.error(`在处理 [${mode ?? '纯文本'}] 格式时发生严重错误.`, { err: lastError.message });
    }
  }

  Log.error('所有格式化模式均发送失败。');
  return { ok: false, error: lastError ?? new TelegramError('未知错误导致所有格式化模式发送失败', 'ALL_FORMAT_MODES_FAILED') };
};
