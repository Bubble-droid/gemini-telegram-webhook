import { HttpError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import type { ApiResult } from '@shared/types/telegram';
import { ms } from '@shared/utils/helpers';
import type { ResponseContext } from '@telegram/bot/response-context';
import { getHtmlChunks, getPlainTextChunks } from '@telegram/markdown';
import type { ParseMode } from 'grammy/types';

const sendTextChunks = async (textChunks: string[], ctx: ResponseContext, mode?: Extract<ParseMode, 'HTML'>) => {
  const sentMessageIds: number[] = [];
  for (const [i, chunk] of textChunks.entries()) {
    let result: ApiResult<'sendMessage' | 'editMessageText'>;
    if (i === 0) {
      result = await ctx.reply(chunk, {
        ...(mode && { parse_mode: mode }),
        deleteAfterMs: ms['1d'],
      });
    } else {
      result = await ctx.send(chunk, {
        opts: {
          ...(mode && { parse_mode: mode }),
          deleteAfterMs: ms['1d'],
        },
        isToReply: true,
      });
    }

    if (result.ok) {
      if (typeof result.data !== 'boolean') {
        sentMessageIds.push(result.data.message_id);
      }
    } else {
      logger.error(`消息块 ${i + 1}/${textChunks.length} 发送失败.`, { err: result.error });
      if (sentMessageIds.length > 0) await ctx.api.deleteMessages(ctx.chat.id, sentMessageIds);
      ctx.lastMessageId = undefined;
      throw new HttpError(result.error);
    }
  }
};

export const sendFormattedChunks = async (markdownText: string, ctx: ResponseContext): Promise<void> => {
  const htmlChunks = getHtmlChunks(markdownText);
  try {
    await sendTextChunks(htmlChunks, ctx, 'HTML');
  } catch (err) {
    logger.error(`Send HTML Formatted Error, try to send plain text.`, { err });
    const plainTextChunks = getPlainTextChunks(markdownText);
    await sendTextChunks(plainTextChunks, ctx);
  }
};
