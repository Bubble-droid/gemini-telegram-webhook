import { formatTime, shortenString } from '@shared/utils/helpers';
import type { ResponseContext } from '@telegram/bot/response-context';
import { Escaper } from '@telegram/markdown/Escaper';
import { CONFIG } from './config';
import { logger } from './logger';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  public async notify(error: unknown, ctx: ResponseContext, context = 'N/A') {
    const { TELEGRAM_BOT_OWNER_ID: ownerId } = CONFIG;

    if (!ownerId) {
      logger.warn('Owner ID is not set, skipping error notification.', {
        context,
      });
      return;
    }

    try {
      const err = error instanceof Error ? error : new AppError(String(error));
      const rawStack = err.stack ?? 'No stack trace available';
      const truncatedStack = shortenString(rawStack);

      const currentTime = formatTime(Date.now());
      const safeContext = Escaper.html(context);
      const safeMessage = Escaper.html(err.message);
      const safeStack = Escaper.html(truncatedStack);

      const htmlMessage =
        `🚨 <b>[错误告警]</b> 🚨\n\n` +
        `🕒 <b>时间:</b> ${currentTime}\n` +
        `📂 <b>上下文:</b> <code>${safeContext}</code>\n\n` +
        `❌ <b>错误信息:</b>\n<pre>${safeMessage}</pre>\n\n` +
        `🛠 <b>堆栈追踪:</b>\n<pre><code class="language-javascript">${safeStack}</code></pre>`;

      await ctx.api.sendMessage(ownerId, htmlMessage, {
        parse_mode: 'HTML',
      });

      logger.info('Error notification sent to owner.', { context });
    } catch (err) {
      logger.warn('Failed to send error notification.', {
        err,
        originalError: error,
      });
    }
  }
}

export class NetworkError extends AppError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class HttpError extends AppError {
  constructor(
    message: string,
    public status?: number,
    public details?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ParseError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ApiError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AgentError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AgentError';
  }
}

export class DataError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}
