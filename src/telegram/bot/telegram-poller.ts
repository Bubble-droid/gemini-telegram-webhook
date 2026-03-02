import { logger } from '@shared/core/logger.js';
import type { ApiParams } from '@shared/types/telegram.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import type { UpdateHandler } from '@telegram/handlers/update-handler.js';

type AllowedUpdates = NonNullable<ApiParams<'getUpdates'>>['allowed_updates'];

export class TelegramPoller {
  private isPolling = false;
  private offset = 0;
  private readonly POLLING_TIMEOUT = 30;
  private readonly RETRY_DELAY = ms.sec(3);

  private bot: TelegramBotApi;
  private updateHandler: UpdateHandler;

  constructor(bot: TelegramBotApi, updateHandler: UpdateHandler) {
    this.bot = bot;
    this.updateHandler = updateHandler;
  }

  /**
   * Starts the polling loop.
   * This method is async but creates a background loop, so it does not resolve until stopped.
   */
  public start(allowedUpdates?: AllowedUpdates) {
    if (this.isPolling) {
      logger.warn('Polling is already active.');
      return;
    }

    this.isPolling = true;
    logger.info('🚀 Telegram Long Polling started.');

    void this.pollLoop(allowedUpdates);
  }

  public stop() {
    this.isPolling = false;
    logger.info('Stopping Telegram Long Polling...');
  }

  private async pollLoop(allowedUpdates?: AllowedUpdates) {
    while (this.isPolling) {
      try {
        const result = await this.bot.getUpdates({
          offset: this.offset,
          timeout: this.POLLING_TIMEOUT,
          ...(allowedUpdates && { allowed_updates: allowedUpdates }),
        });

        if (result.length > 0) {
          for (const update of result) {
            // Update offset to acknowledge this update
            this.offset = update.update_id + 1;
            void this.updateHandler.handleUpdate(update);
          }
        }
      } catch (err: unknown) {
        logger.error('Polling error occurred:', { err });
        // Prevent tight loops on network failure
        await delay(this.RETRY_DELAY);
      }
    }
    logger.info('Telegram Long Polling stopped.');
  }
}
