import { BotCommands } from '@configs/bot-commands';
import { faqMatcher } from '@data/faq-matcher';
import { logger } from '@shared/core/logger';
import { ms } from '@shared/utils/helpers';
import type { ResponseContext } from '@telegram/bot/response-context';
import { toHtml } from '@telegram/markdown';
import type { Message } from 'grammy/types';
import type { ChitchatHandler } from './chitchat-handler';
import type { MentionHandler } from './mention-handler';

interface Handlers {
  mentionHandler: MentionHandler;
  chitchatHandler: ChitchatHandler;
}

export class NormalMessageHandler {
  private mention: MentionHandler;
  private chitchat: ChitchatHandler;

  constructor(handlers: Handlers) {
    this.mention = handlers.mentionHandler;
    this.chitchat = handlers.chitchatHandler;
  }

  public async handle(ctx: ResponseContext, messages: Message[]): Promise<void> {
    logger.debug('Received normal message', { chatId: ctx.chat.id, userId: ctx.user.id });

    if (ctx.isReplyToBot) {
      logger.info('handling reply to bot', { chatId: ctx.chat.id, userId: ctx.user.id });
      await this.mention.handle(ctx, messages);
      return;
    }

    if (ctx.isCommandAlias) {
      await this.handleCommandAlias(ctx, messages);
      return;
    }

    try {
      if (await this.handleKeywordReply(ctx)) return;

      if (await this.chitchat.handle(ctx, messages)) return;
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
  }

  /**
   * 处理 :ask 等指令别名
   * @private
   */
  private async handleCommandAlias(ctx: ResponseContext, messages: Message[]) {
    const cleanText = ctx.text?.slice(1).trim();

    if (cleanText?.startsWith('ask')) {
      await this.mention.handle(ctx, messages);
      return;
    }

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

    await ctx.send(toHtml(result.matchedFaq.answer.trim()), {
      opts: { parse_mode: 'HTML', deleteAfterMs: ms['5m'] },
      isToReply: true,
    });

    return true;
  }
}
