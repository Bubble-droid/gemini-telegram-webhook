import { Messages } from '@configs/messages.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { FaqMatcher } from '@storage/faq-matcher.js';
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
  faqMatcher: FaqMatcher;
}

export class NormalMessageHandler {
  private readonly chitchat: ChitchatHandler;
  private readonly faqMatcher: FaqMatcher;

  constructor(handlers: Handlers) {
    this.chitchat = handlers.chitchatHandler;
    this.faqMatcher = handlers.faqMatcher;
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
    const result = this.faqMatcher.findFaqMatch(ctx.text);
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
    const chunks = markdownToMarkdownV2Chunks(answer.trim());
    for (const [i, chunk] of chunks.entries()) {
      if (i === 0) {
        await ctx.reply(chunk, {
          replyToMessageId: ctx.message?.message_id,
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['5m'],
        });
      } else {
        await ctx.reply(chunk, {
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['5m'],
        });
      }
      await delay(1000);
    }
  }
}
