import type { LogLevel } from 'fastify';

export interface RawEnv {
  GEMINI_API_KEYS: string[];

  GEMINI_CREDENTIALS: string;
  GOOGLE_CLOUD_PROJECT: string;

  PROXY_AUTH_TOKEN: string;

  OPENAI_API_KEY: string;

  GITHUB_ACCESS_TOKEN: string;
  GITHUB_REPOSITORY: string;

  TELEGRAPH_ACCOUNT_INFO: string;

  WEBHOOK_RECEIVE_URL: string;
  WEBHOOK_SECRET_TOKEN: string;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_ID: number;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_BOT_OWNER_ID: number;
  ALLOWED_USAGE_GROUPS: number[];

  SERVER_LISTEN_HOST?: string;
  SERVER_LISTEN_PORT?: number;
  SERVER_LOG_LEVEL?: LogLevel;
}

export type EnvConfig = Required<RawEnv>;
