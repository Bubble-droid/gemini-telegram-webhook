// src/utils/send-formatted-message.ts

import { logger } from '@/services';
import { bot } from '@/services/apis';
import type { ApiResult } from '@/types';
import { AppError } from '@/utils/errors';
import { getHtmlChunks, getPlainTextChunks } from '@/utils/markdown';
import type { ParseMode } from 'grammy/types';
import type { ResponseContext } from './ResponseContext';
import { MsgPTTL } from './helpers';

const sendTextChunks = async (textChunks: string[], ctx: ResponseContext, mode?: Extract<ParseMode, 'HTML'>) => {
  const italicOpenTag = mode === 'HTML' ? '<i>' : '';
  const italicCloseTag = mode === 'HTML' ? '</i>' : '';
  const warningText = `\n\n⚠️ ${italicOpenTag}AI 的回答仅供参考，可能存在不准确之处，请自行判断。${italicCloseTag}`;

  const sentMessageIds: number[] = [];

  for (const [i, chunk] of textChunks.entries()) {
    const isFirstChunk = i === 0;
    const fullText = i === textChunks.length - 1 ? chunk + warningText : chunk;

    let result: ApiResult<'sendMessage' | 'editMessageText'>;
    if (isFirstChunk) {
      result = await ctx.reply(fullText, {
        ...(mode && { parse_mode: mode }),
        deleteAfterMs: MsgPTTL['1d'],
      });
    } else {
      result = await ctx.send(fullText, {
        opts: {
          ...(mode && { parse_mode: mode }),
          deleteAfterMs: MsgPTTL['1d'],
        },
        isReply: true,
      });
    }

    if (result.ok) {
      if (typeof result.data !== 'boolean') {
        sentMessageIds.push(result.data.message_id);
      }
    } else {
      logger.error(`消息块 ${i + 1}/${textChunks.length} 发送失败.`, { err: result.error });

      if (sentMessageIds.length > 0) await bot.deleteMessages(ctx.chat.id, sentMessageIds);

      ctx.lastMessageId = undefined;

      throw new AppError(result.error);
    }
  }
};

export const sendFormattedMessage = async (markdownText: string, ctx: ResponseContext): Promise<void> => {
  const htmlChunks = getHtmlChunks(markdownText);
  try {
    await sendTextChunks(htmlChunks, ctx, 'HTML');
  } catch (err) {
    logger.error(`Send HTML Formatted Error, try to send plain text.`, { err });
    const plainTextChunks = getPlainTextChunks(markdownText);
    await sendTextChunks(plainTextChunks, ctx);
  }
};
