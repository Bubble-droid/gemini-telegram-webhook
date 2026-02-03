import type { LogLevel } from 'fastify';

export interface RawEnv {
  GEMINI_API_KEYS: string[];

  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;

  GITHUB_ACCESS_TOKEN: string;
  GITHUB_REPOSITORY: string;

  WEBHOOK_RECEIVE_URL: string;
  WEBHOOK_SECRET_TOKEN: string;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_ID: number;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_BOT_OWNER_ID: number;
  ALLOWED_USAGE_GROUPS: Set<number>;

  SERVER_LISTEN_HOST?: string;
  SERVER_LISTEN_PORT?: number;
  SERVER_LOG_LEVEL?: LogLevel;

  GOOGLE_AI_BASE_URL?: string;
  LOCAL_PROXY_BASE_URL?: string;

  MAX_AGENT_ROUNDS?: number;
  REQUEST_LIMIT_SECOND?: number;
  HISTORY_TTL_DAY?: number;
  MAX_HISTORY_LENGTH?: number;
}

export type EnvConfig = Required<RawEnv>;
