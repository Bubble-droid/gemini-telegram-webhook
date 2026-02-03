import type { MessageCollector } from '@services/message-collector';
import { CONFIG } from '@shared/core/config';
import { AppError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import { ms, shortenString } from '@shared/utils/helpers';
import { simplifyUpdateInLogger } from '@shared/utils/message';
import { ResponseContext } from '@telegram/bot/response-context';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api';
import { Escaper } from '@telegram/markdown/Escaper';
import type { Update } from 'grammy/types';
import { handleCallbackQuery } from './callback-query-handler';
import { handleBotCommand } from './messages/command-handler';
import type { MentionHandler } from './messages/mention-handler';
import type { NormalMessageHandler } from './messages/normal-message-handler';

interface Handlers {
  messageCollector: MessageCollector;
  mentionHandler: MentionHandler;
  normalMessageHandler: NormalMessageHandler;
}

export class UpdateHandler {
  private readonly bot: TelegramBotApi;
  private readonly collector: MessageCollector;
  private readonly mention: MentionHandler;
  private readonly normal: NormalMessageHandler;

  constructor(bot: TelegramBotApi, handlers: Handlers) {
    this.bot = bot;
    this.collector = handlers.messageCollector;
    this.mention = handlers.mentionHandler;
    this.normal = handlers.normalMessageHandler;
  }

  public async handle(update: Update) {
    const { message, callback_query } = update;
    logger.debug('Received webhook update:', { update: simplifyUpdateInLogger(update) });
    if (!message && !callback_query) return;
    const ctx = new ResponseContext(update, this.bot);
    try {
      if (ctx.callBackQuery) {
        await handleCallbackQuery(ctx);
      } else {
        const { id, type } = ctx.chat;
        if (!CONFIG.ALLOWED_USAGE_GROUPS.has(id)) return;
        if (!['group', 'supergroup'].includes(type)) return;

        if (ctx.isBotCommand) {
          await handleBotCommand(ctx);
          return;
        }

        this.collector.append(ctx.message);

        await this.dispatch(ctx);
      }
    } catch (err) {
      this.handleError(err, ctx);
    }
  }

  private async dispatch(ctx: ResponseContext) {
    const messages = await this.collector.getMessages(ctx.message);

    if (ctx.isBotMentioned) {
      await this.mention.handle(ctx, messages);
      return;
    }

    await this.normal.handle(ctx, messages);
  }

  private handleError(err: unknown, ctx: ResponseContext) {
    const { chat, message } = ctx;
    const errorMessage = err instanceof AppError ? err.message : 'Unknown error';

    logger.error('Error while handling update', { err });

    if (err instanceof AppError) {
      void err.notify(
        err,
        ctx,
        `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message.message_id })}`,
      );
    }

    const shorten = `❌ 发生错误，请稍后再试\n<blockquote expandable>${Escaper.html(shortenString(errorMessage))}</blockquote>`;

    void ctx.api.sendMessage(chat.id, shorten, {
      replyToMessageId: message.message_id,
      parse_mode: 'HTML',
      deleteAfterMs: ms['3m'],
    });
  }
}
