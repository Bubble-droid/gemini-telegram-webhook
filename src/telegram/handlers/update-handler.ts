import { CONFIG } from '@shared/core/config.js';
import { AppError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { MaybePromise } from '@shared/types/common.js';
import { ms, shortenString } from '@shared/utils/helpers.js';
import { simplifyUpdate } from '@shared/utils/message.js';
import { ResponseContext } from '@telegram/bot/response-context.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import { Escaper } from '@telegram/markdown/Escaper.js';
import type { Update } from 'grammy/types';

type SpecificUpdateHandler = (ctx: ResponseContext) => MaybePromise;

export class UpdateHandler {
  private readonly handlerRegistry = new Map<keyof Update, Set<SpecificUpdateHandler>>();
  private readonly bot: TelegramBotApi;

  constructor(bot: TelegramBotApi) {
    this.bot = bot;
  }

  public onUpdate(updateType: keyof Update, handler: SpecificUpdateHandler) {
    let handlers = this.handlerRegistry.get(updateType);
    if (!handlers) {
      handlers = new Set();
      this.handlerRegistry.set(updateType, handlers);
    }
    handlers.add(handler);
  }

  public async handle(update: Update) {
    const { message, callback_query } = update;
    logger.trace('Received update:', { update: simplifyUpdate(update) });
    if (!message && !callback_query) return;

    const ctx = new ResponseContext(update, this.bot);
    logger.info('Received update from:', {
      chat_id: ctx.chat.id,
      user_id: ctx.user.id,
      message_id: ctx.message.message_id,
    });
    const { id, type } = ctx.chat;
    if (!CONFIG.ALLOWED_USAGE_GROUPS.includes(id)) return;
    if (!['group', 'supergroup'].includes(type)) return;

    const updateTypes = Object.keys(update) as (keyof Update)[];
    for (const updateType of updateTypes) {
      const handlers = this.handlerRegistry.get(updateType);
      if (handlers) {
        for (const handle of handlers) {
          try {
            await handle(ctx);
          } catch (err) {
            this.handleError(err, ctx);
          }
        }
      }
    }
  }

  private handleError(err: unknown, ctx: ResponseContext) {
    const { chat, message } = ctx;
    const errorMessage = err instanceof AppError ? err.message : typeof err === 'string' ? err : String(err);
    logger.error('Error while handling update', { err });
    if (err instanceof AppError) {
      void err.notify(
        err,
        ctx,
        `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message.message_id })}`,
      );
    }
    const shorten = `❌ An error occurred, please try again later\n<blockquote expandable>${Escaper.html(shortenString(errorMessage))}</blockquote>`;
    void ctx.reply(shorten, { parse_mode: 'HTML', deleteAfterMs: ms['3m'] });
  }
}
