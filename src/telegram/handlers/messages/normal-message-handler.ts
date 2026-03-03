import { Messages } from '@configs/messages.js';
import { faqMatcher } from '@data/faq-matcher.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { ChitchatHandler } from './chitchat-handler.js';

const CUSTOM_KEYWORD_REPLY = [
  {
    keywords: ['常见问题', 'FAQ'],
    reply: Messages.faqSimplified,
  },
] satisfies { keywords: string[]; reply: string }[];

interface Handlers {
  chitchatHandler: ChitchatHandler;
}

export class NormalMessageHandler {
  private chitchat: ChitchatHandler;

  constructor(handlers: Handlers) {
    this.chitchat = handlers.chitchatHandler;
  }

  public async handle(ctx: ResponseContext) {
    logger.debug('Received normal message', { chatId: ctx.chat.id, userId: ctx.user.id });

    try {
      await this.handleKeywordReply(ctx);
      await this.chitchat.handle(ctx);
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(ctx: ResponseContext) {
    if (!ctx.text?.length) return;
    const result = faqMatcher.findFaqMatch(ctx.text);
    let answer: string | undefined;
    if (result) {
      logger.info('FAQ 匹配成功', {
        chatId: ctx.chat.id,
        messageId: ctx.message?.message_id,
        matchedTexts: result.matches,
      });
      answer = result.matchedFaq.answer;
    } else {
      answer ??= CUSTOM_KEYWORD_REPLY.find((k) => k.keywords.includes(ctx.text?.trim().toUpperCase() ?? ''))?.reply;
    }

    if (!answer) return;
    const chunks = markdownToMarkdownV2Chunks(answer.trim(), 300);
    for (const [i, chunk] of chunks.entries()) {
      if (i === 0) {
        await ctx.reply(chunk, {
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['5m'],
        });
      } else {
        await ctx.send(chunk, {
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['5m'],
        });
      }
      await delay(1_500);
    }
  }
}
