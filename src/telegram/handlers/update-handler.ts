import type { CallbackButtonType } from '@configs/callbacks.js';
import type { CommandType } from '@configs/commands.js';
import type { Update } from '@grammyjs/types';
import { CONFIG } from '@shared/core/config.js';
import { ALL_UPDATE_TYPES } from '@shared/core/constants.js';
import { AppError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { Escaper } from '@shared/markdown/escaper.js';
import type { MaybePromise } from '@shared/types/common.js';
import { ms, shortenString } from '@shared/utils/helpers.js';
import { simplifyUpdate } from '@shared/utils/message.js';
import { ResponseContext } from '@telegram/bot/response-context.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';

type UpdateType = (typeof ALL_UPDATE_TYPES)[number];
type UpdateHandleCallback = (ctx: ResponseContext, done: () => void) => MaybePromise;

export class UpdateHandler {
  private readonly handlerRegistry = new Map<keyof Update, Set<UpdateHandleCallback>>();

  constructor(private readonly api: TelegramBotApi) {}

  public async handleUpdate(update: Update) {
    if (!update.message && !update.callback_query) return;
    logger.trace('Received update:', { update: simplifyUpdate(update) });

    const ctx = new ResponseContext(update, this.api);
    try {
      logger.info('Received update from:', {
        chat_id: ctx.chat.id,
        user_id: ctx.user.id,
        message_id: ctx.message?.message_id,
      });
      if (!CONFIG.ALLOWED_USAGE_GROUPS.includes(ctx.chat.id)) return;
      if (!['group', 'supergroup'].includes(ctx.chat.type)) return;
      await this.dispatch(ctx);
    } catch (err) {
      await this.handleError(err, ctx).catch((e: unknown) => {
        logger.error(`Error while handling update:`, { err: e, originalError: err });
      });
    }
  }

  public on(updateType: keyof Update, handler: UpdateHandleCallback) {
    let handlers = this.handlerRegistry.get(updateType);
    if (!handlers) {
      handlers = new Set();
      this.handlerRegistry.set(updateType, handlers);
    }
    handlers.add(handler);
  }

  public message(handle: UpdateHandleCallback) {
    this.on('message', async (ctx, done) => {
      await handle(ctx, done);
    });
  }

  public command(name: CommandType, handle: UpdateHandleCallback) {
    this.on('message', async (ctx, done) => {
      if (!ctx.isBotCommand || ctx.command?.name !== name) return;
      done();
      await handle(ctx, done);
    });
  }

  public callback(
    pattern: CallbackButtonType | `${CallbackButtonType}_${string}}` | RegExp,
    handle: UpdateHandleCallback,
  ) {
    this.on('callback_query', async (ctx, done) => {
      const data = ctx.callbackQueryData;
      const isMatch =
        typeof pattern === 'string' ? data === pattern || data.startsWith(`${pattern}_`) : pattern.test(data);
      if (!isMatch) return;
      done();
      await handle(ctx, done);
    });
  }

  private async dispatch(ctx: ResponseContext) {
    const updateKeys = Object.keys(ctx.update) as UpdateType[];
    for (const key of updateKeys) {
      if (!ALL_UPDATE_TYPES.includes(key)) continue;
      const handlers = this.handlerRegistry.get(key);
      if (!handlers?.size) continue;

      let propagationStopped = false;
      const done = () => {
        propagationStopped = true;
      };
      for (const handle of handlers) {
        if (propagationStopped as boolean) break;
        try {
          await handle(ctx, done);
        } catch (err) {
          await this.handleError(err, ctx).catch((e: unknown) => {
            logger.warn(`Handler perform failed:`, { err: e, originalError: err });
          });
        }
      }
    }
  }

  private async handleError(err: unknown, ctx: ResponseContext) {
    const { chat, message } = ctx;
    const errorMessage = err instanceof AppError ? err.message : typeof err === 'string' ? err : String(err);
    logger.error('Error while handling update', { err });
    if (err instanceof AppError) {
      await err.notify(
        err,
        ctx,
        `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message?.message_id })}`,
      );
    }
    const shorten = `❌ An error occurred, please try again later\n<blockquote expandable>${Escaper.html(shortenString(errorMessage))}</blockquote>`;
    await ctx.reply(shorten, { parse_mode: 'HTML', deleteAfterMs: ms['3m'] });
  }
}
