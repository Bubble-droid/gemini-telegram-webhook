import type { GenerateContentResponse } from '@google/genai';
import { TelegramError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { ApiResult } from '@shared/types/telegram.js';
import { makeFile, ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import { getHtmlChunks, getPlainTextChunks } from '@telegram/markdown/index.js';
import type { ParseMode } from 'grammy/types';

const FILE_CAPTION = 'Output too long, sent as file.';

const sendTextChunks = async (
  textChunks: string[],
  model: string | undefined,
  ctx: ResponseContext,
  mode?: Extract<ParseMode, 'HTML'>,
) => {
  const italicOpenTag = mode === 'HTML' ? '<i>' : '';
  const italicCloseTag = mode === 'HTML' ? '</i>' : '';
  const byText = `\n\n${italicOpenTag}Reply by ${model}${italicCloseTag}`;

  const sentMessageIds: number[] = [];
  for (const [i, chunk] of textChunks.entries()) {
    const fullText = model && i === textChunks.length - 1 ? chunk + byText : chunk;

    let result: ApiResult<'sendMessage' | 'editMessageText'>;
    if (i === 0) {
      result = await ctx.reply(fullText, {
        ...(mode && { parse_mode: mode }),
        deleteAfterMs: ms['1d'],
      });
    } else {
      result = await ctx.send(fullText, {
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
      throw new TelegramError(result.error);
    }
  }
};

export const sendFormattedChunks = async (response: GenerateContentResponse, ctx: ResponseContext) => {
  const { text, modelVersion } = response;
  const htmlChunks = getHtmlChunks(text!);
  if (htmlChunks.length > 1) {
    const file = makeFile(text!, 'response.md', 'text/markdown');
    const res = await ctx.api.sendDocument(ctx.chat.id, file, {
      caption: FILE_CAPTION,
      deleteAfterMs: ms['1d'],
      replyToMessageId: ctx.message.message_id,
    });
    if (!res.ok) {
      throw new TelegramError(res.error);
    }
    return;
  }
  try {
    await sendTextChunks(htmlChunks, modelVersion, ctx, 'HTML');
  } catch (err) {
    logger.error(`Send HTML Formatted Error, try to send plain text.`, { err });
    const plainTextChunks = getPlainTextChunks(text!);
    await sendTextChunks(plainTextChunks, modelVersion, ctx);
  }
};
