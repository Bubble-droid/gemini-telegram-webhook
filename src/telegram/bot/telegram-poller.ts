import { logger } from '@shared/core/logger.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import type { UpdateHandler } from '@telegram/handlers/update-handler.js';
import type { Update } from 'grammy/types';

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
  public async start() {
    if (this.isPolling) {
      logger.warn('Polling is already active.');
      return;
    }

    this.isPolling = true;
    logger.info('🚀 Telegram Long Polling started.');

    await this.bot.deleteWebhook(true);

    void this.pollLoop();
  }

  public stop() {
    this.isPolling = false;
    logger.info('Stopping Telegram Long Polling...');
  }

  private async pollLoop() {
    while (this.isPolling) {
      try {
        const result = await this.bot.getUpdates({
          offset: this.offset,
          timeout: this.POLLING_TIMEOUT,
          allowed_updates: ['message', 'callback_query'], // Adjust based on your needs
        });

        if (result.ok && result.data.length > 0) {
          this.processUpdates(result.data);
        }
      } catch (err: unknown) {
        logger.error('Polling error occurred:', { err });
        // Prevent tight loops on network failure
        await delay(this.RETRY_DELAY);
      }
    }
    logger.info('Telegram Long Polling stopped.');
  }

  private processUpdates(updates: Update[]) {
    for (const update of updates) {
      // Update offset to acknowledge this update
      this.offset = update.update_id + 1;
      void this.updateHandler.handle(update);
    }
  }
}
