import { convertToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import type { ApiResult } from '@shared/types/telegram.js';
import { formatTime, makeFile } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import { CONFIG } from './config.js';
import { logger } from './logger.js';

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
      const currentTime = formatTime(Date.now());

      const message =
        `🚨 **[错误告警]** 🚨\n\n` +
        `🕒 **时间:** ${currentTime}\n` +
        `📂 **上下文:** \`${context}\`\n\n` +
        `❌ **错误信息:**\n\`\`\`\n${err.message}\n\`\`\`\n\n` +
        `🛠 **堆栈追踪:**\n\`\`\`javascript\n${rawStack}\n\`\`\``;

      const chunks = convertToMarkdownV2Chunks(message);

      let res: ApiResult<'sendDocument' | 'sendMessage'>;
      if (chunks.length > 1) {
        const file = makeFile(message, 'error-report.md', 'text/markdown');
        res = await ctx.api.sendDocument(ownerId, file, {
          caption: 'Too long error report, sent as a file.',
        });
      } else {
        res = await ctx.api.sendMessage(ownerId, chunks.join(''), {
          parse_mode: 'MarkdownV2',
        });
      }
      if (!res.ok) {
        throw new TelegramError(`Failed to send error notification. ${res.error}`);
      }
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

export class AuthError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class GeminiApiError extends AppError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class OpenAiApiError extends AppError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'OpenAiApiError';
  }
}

export class AgentError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AgentError';
  }
}

export class McpError extends AppError {
  constructor(
    message: string,
    public serverName?: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export class DataError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}

export class TelegramError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramError';
  }
}

export class TelegraphError extends AppError {
  constructor(message: string) {
    super(`Telegraph API Error: ${message}`);
    this.name = 'TelegraphError';
  }
}
