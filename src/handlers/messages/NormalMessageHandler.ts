import { BotCommands } from '@/configs';
import { ChitChatHandler, mentionHandler } from '@/handlers/messages';
import { logger } from '@/services';
import { CONFIG } from '@/services/ConfigLoader';
import { faqMatcher, MsgPTTL, type ResponseContext } from '@/utils';
import { toHtml } from '@/utils/markdown';

/**
 * @description 处理普通消息（非提及、非显式命令）。
 *              采用无状态单例模式，包含正则缓存优化。
 */
export class NormalMessageHandler {
  private chitChatHandler: ChitChatHandler;

  constructor() {
    this.chitChatHandler = new ChitChatHandler();
  }

  public async handle(ctx: ResponseContext): Promise<void> {
    logger.debug('Received normal message', { chatId: ctx.chat.id, userId: ctx.user.id });

    if (await this.handleCommandAlias(ctx)) return;

    const isReplyToBot = ctx.messages.some((m) => m.reply_to_message?.from?.username === CONFIG.TELEGRAM_BOT_USERNAME);
    if (isReplyToBot) {
      logger.info('handling reply to bot', { chatId: ctx.chat.id, userId: ctx.user.id });
      await mentionHandler.handle(ctx);
      return;
    }

    try {
      if (await this.handleKeywordReply(ctx)) return;

      if (await this.chitChatHandler.handle(ctx)) return;
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
  }

  /**
   * 处理 :ask 等指令别名
   * @private
   */
  private async handleCommandAlias(ctx: ResponseContext): Promise<boolean> {
    const aliasText = ctx.checkCommandAlias();

    if (!aliasText) return false;

    const cleanText = aliasText.slice(1).trim();

    if (cleanText.startsWith('ask')) {
      await mentionHandler.handle(ctx);
      return true;
    }

    const targetCommand = BotCommands.find((cmd) => cleanText.startsWith(cmd.command));

    if (!targetCommand) return false;

    logger.info(`Handling command alias: ${targetCommand.command}`, { chatId: ctx.chat.id });

    await targetCommand.action({ ctx });

    return true;
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(ctx: ResponseContext): Promise<boolean> {
    const combinedText = ctx.messages
      .map((m) => ctx.getText(m))
      .filter(Boolean)
      .join('\n')
      .trim();

    if (combinedText.length === 0) return false;

    const result = faqMatcher.findFaqMatch(combinedText);

    if (!result) return false;

    logger.info('FAQ 匹配成功', {
      chatId: ctx.chat.id,
      messageId: ctx.primaryMessage.message_id,
      matchedTexts: result.matches,
    });

    await ctx.send(toHtml(result.matchedFaq.answer.trim()), {
      opts: { parse_mode: 'HTML', deleteAfterMs: MsgPTTL['5m'] },
      isReply: true,
    });

    return true;
  }
}
