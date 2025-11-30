// src/utils/formatters/send_formatted_message.ts

import { AppError, bot, logger } from '@/services';
import type { ParseMode } from '@/types';
import { taskScheduler } from '@/utils';
import { formatter, preProcessMarkdown, splitAstAndGenerateChunks, splitPlainText } from '@/utils/formatters';

const MAX_CONTENT_LENGTH = 4096;

/**
 * @description 发送 Telegram 消息，使用 AST 进行精确的文本分割和格式化，并支持多模式回退。
 * @param chatId - 目标聊天 ID。
 * @param replyToMessageId - 如果需要回复某条消息，则指定 messageId。
 * @param standardMarkdownText - 标准 Markdown 格式的输入文本。
 */
export const sendFormattedMessage = async (
  chatId: number,
  srcMsgId: number | undefined,
  replyToMessageId: number,
  standardMarkdownText: string,
): Promise<{ ok: true; messageId?: number } | { ok: false; error: AppError }> => {
  if (!standardMarkdownText || standardMarkdownText.trim().length === 0) {
    return { ok: true, messageId: undefined };
  }

  const modesToTry: (ParseMode | null)[] = ['HTML', 'MarkdownV2', 'Markdown', null];
  let lastError: AppError | null = null;

  // 2. 在解析前，应用预处理器
  // 关键修改：在解析前，先对原始 Markdown 进行预处理
  const processedText = preProcessMarkdown(standardMarkdownText);

  // 1. 首先，一次性将 Markdown 解析为 AST
  const ast = formatter.parse(processedText); // <--- 使用处理后的文本

  let italicOpenTag = '';
  let italicCloseTag = '';

  for (const mode of modesToTry) {
    logger.info(`尝试使用 [${mode ?? '纯文本'}] 格式发送全部消息...`);
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
        italicOpenTag = mode === 'HTML' ? '<i>' : '_';
        italicCloseTag = mode === 'HTML' ? '</i>' : '_';
        // 2. 获取对应模式的生成器
        const generator = formatter.getGenerator(mode);
        // 3. 基于 AST 和生成器，直接得到最终的消息块数组
        chunks = splitAstAndGenerateChunks(ast, generator);
      }

      const warningText = `\n\n${italicOpenTag}⚠️ 本 AI 回答仅供参考，可能存在不准确之处，请你自行判断。${italicCloseTag}`;

      logger.info(`[${mode ?? '纯文本'}] 格式的文本被分割成 ${chunks.length} 块.`);

      for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];
        logger.info(
          `发送消息 (块 ${i + 1}/${chunks.length}, 长度: ${[...chunk].length}, 格式: ${mode ?? '纯文本'})...`,
        );

        if (i === chunks.length - 1) {
          chunk += warningText;
        }

        let sendResult;
        if (srcMsgId && i === 0) {
          sendResult = await bot.editMessageText(chatId, srcMsgId, chunk, {
            parseMode: mode === null ? undefined : mode,
          });
        } else {
          sendResult = await bot.sendMessage(chatId, chunk, {
            replyToMessageId: currentReplyTo,
            parseMode: mode === null ? undefined : mode,
          });
        }

        if (sendResult.ok) {
          logger.info(`消息块 ${i + 1}/${chunks.length} 发送成功.`);
          if (!srcMsgId || (srcMsgId && i > 0)) {
            sentMessageIdsInCurrentAttempt.push(sendResult.messageId);
          }
          taskScheduler.deleteMessage(chatId, sendResult.messageId, 24 * 60 * 60_000);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
        } else {
          logger.error(`消息块 ${i + 1}/${chunks.length} 发送失败.`, { err: sendResult.error });
          lastError = new AppError(sendResult.error);
          modeSucceeded = false;

          if (sentMessageIdsInCurrentAttempt.length > 0) {
            logger.warn(
              `[${mode ?? '纯文本'}] 模式发送中断，开始清理 ${sentMessageIdsInCurrentAttempt.length} 条已发送的消息...`,
            );
            const deleteResult = await bot.deleteMessages(chatId, sentMessageIdsInCurrentAttempt);
            if (deleteResult.ok) {
              logger.info('清理操作完成。');
            } else {
              logger.error('清理发生错误，为了不影响任务执行，将继续处理', { err: deleteResult.error });
            }
          }
          break; // 中断当前模式
        }
      }

      if (modeSucceeded) {
        logger.info(`所有消息均已使用 [${mode ?? '纯文本'}] 格式成功发送.`);
        return { ok: true, messageId: lastMessageId };
      }
      logger.warn(`[${mode ?? '纯文本'}] 格式发送失败，将尝试下一个格式...`);
    } catch (err) {
      lastError = new AppError(err instanceof Error ? err.message : String(err));
      logger.error(`在处理 [${mode ?? '纯文本'}] 格式时发生严重错误.`, { err });
    }
  }

  logger.error('所有格式化模式均发送失败。');
  return {
    ok: false,
    error: lastError ?? new AppError('未知错误导致所有格式化模式发送失败', 'ALL_FORMAT_MODES_FAILED'),
  };
};
