import type { LogLevel } from 'fastify';

export interface RawEnv {
  GEMINI_API_KEYS: string[];

  GITHUB_ACCESS_TOKEN: string;
  GITHUB_REPOSITORY: string;

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

  ENABLE_KEY_ROTATION?: boolean;
  GEMINI_API_BASE_URL?: string;
  LOCAL_PROXY_BASE_URL?: string;

  MODEL_CONFIG_TEMPERATURE?: number;

  MAX_API_CALL_ROUNDS?: number;
  REQUEST_LIMIT_SECOND?: number;
  CONTEXT_TTL_DAY?: number;
  MAX_CONTEXT_LENGTH?: number;
}

export type EnvConfig = Required<RawEnv>;
