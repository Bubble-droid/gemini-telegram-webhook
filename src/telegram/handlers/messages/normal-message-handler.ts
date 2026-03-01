import { BotCommands } from '@configs/bot-commands.js';
import { faqMatcher } from '@data/faq-matcher.js';
import { logger } from '@shared/core/logger.js';
import { toMarkdownV2 } from '@shared/markdown/telegram-converter.js';
import { ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { ChitchatHandler } from './chitchat-handler.js';

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

    if (ctx.isCommandAlias) {
      await this.handleCommandAlias(ctx);
      return;
    }

    try {
      await this.handleKeywordReply(ctx);
      await this.chitchat.handle(ctx);
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
  }

  /**
   * 处理 :ask 等指令别名
   * @private
   */
  private async handleCommandAlias(ctx: ResponseContext) {
    const cleanText = ctx.text?.slice(1).trim();
    const targetCommand = BotCommands.find((cmd) => cleanText?.startsWith(cmd.command));
    if (!targetCommand) return;
    logger.info(`Handling command alias: ${targetCommand.command}`, { chatId: ctx.chat.id });
    await targetCommand.action({ ctx });
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(ctx: ResponseContext): Promise<boolean> {
    if (!ctx.text?.length) return false;

    const result = faqMatcher.findFaqMatch(ctx.text);

    if (!result) return false;

    logger.info('FAQ 匹配成功', {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      matchedTexts: result.matches,
    });

    await ctx.send(toMarkdownV2(result.matchedFaq.answer.trim()), {
      opts: { parse_mode: 'MarkdownV2', deleteAfterMs: ms['5m'] },
      isToReply: true,
    });

    return true;
  }
}
