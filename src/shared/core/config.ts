import type { EnvConfig, RawEnv } from '@shared/types/env';
import type { ExtractAndMakeRequired, RequiredKeys, StringifyProps, VerifyExactKeys } from '@shared/types/utils';
import type { LogLevel } from 'fastify';
import { GOOGLE_AI_BASE_URL } from './constants';

type Split<T extends 'string' | 'number'> = T extends 'string' ? string[] : number[];

const defineRequiredKeys =
  <T>() =>
  <K extends readonly RequiredKeys<T>[]>(keys: K & VerifyExactKeys<RequiredKeys<T>, K>) =>
    keys;

const REQUIRED_ENV_VARS = defineRequiredKeys<RawEnv>()([
  'GEMINI_API_KEYS',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'GITHUB_ACCESS_TOKEN',
  'GITHUB_REPOSITORY',
  'WEBHOOK_RECEIVE_URL',
  'WEBHOOK_SECRET_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_ID',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_BOT_OWNER_ID',
  'ALLOWED_USAGE_GROUPS',
] as const);

const DEFAULT_SERVER_LISTEN_PORT = 39001;

const DEFAULT_ENV = {
  SERVER_LISTEN_HOST: '127.0.0.1',
  SERVER_LISTEN_PORT: DEFAULT_SERVER_LISTEN_PORT,
  SERVER_LOG_LEVEL: 'info',

  GOOGLE_AI_BASE_URL: GOOGLE_AI_BASE_URL,
  LOCAL_PROXY_BASE_URL: `http://127.0.0.1:${DEFAULT_SERVER_LISTEN_PORT}/gemini`,

  MAX_AGENT_ROUNDS: 16,
  REQUEST_LIMIT_SECOND: 20,

  HISTORY_TTL_DAY: 7,
  MAX_HISTORY_LENGTH: 16,
} as const satisfies ExtractAndMakeRequired<RawEnv>;

const splitArray = <T extends 'string' | 'number'>(val: string | undefined, type: T): Split<T> => {
  if (!val?.trim().length) return [];
  return val.split(',').flatMap((s) => {
    const trimmed = s.trim();
    if (!trimmed.length) return [];
    const value = type === 'string' ? trimmed : Number(trimmed);
    return [value];
  }) as Split<T>;
};

class ConfigLoader {
  private readonly env: Partial<StringifyProps<RawEnv>>;
  private readonly config: EnvConfig;

  constructor() {
    this.env = process.env as StringifyProps<RawEnv>;
    this.validateRequiredEnv();
    this.config = this.parseEnv();
    Object.freeze(this.config);
  }

  public load(): EnvConfig {
    return this.config;
  }

  private validateRequiredEnv(): void {
    const missing = REQUIRED_ENV_VARS.filter((key) => !this.env[key]?.trim().length);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables：${missing.join(', ')}`);
    }
  }

  private parseEnv(): EnvConfig {
    return {
      GEMINI_API_KEYS: splitArray(this.getEnv('GEMINI_API_KEYS'), 'string'),

      OPENAI_API_KEY: this.getEnv('OPENAI_API_KEY'),
      OPENAI_BASE_URL: this.getEnv('OPENAI_BASE_URL'),

      GITHUB_ACCESS_TOKEN: this.getEnv('GITHUB_ACCESS_TOKEN'),
      GITHUB_REPOSITORY: this.getEnv('GITHUB_REPOSITORY'),

      WEBHOOK_RECEIVE_URL: this.getEnv('WEBHOOK_RECEIVE_URL'),
      WEBHOOK_SECRET_TOKEN: this.getEnv('WEBHOOK_SECRET_TOKEN'),

      TELEGRAM_BOT_TOKEN: this.getEnv('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_BOT_ID: Number(this.getEnv('TELEGRAM_BOT_ID')),
      TELEGRAM_BOT_USERNAME: this.getEnv('TELEGRAM_BOT_USERNAME'),
      TELEGRAM_BOT_OWNER_ID: Number(this.getEnv('TELEGRAM_BOT_OWNER_ID')),
      ALLOWED_USAGE_GROUPS: new Set(splitArray(this.getEnv('ALLOWED_USAGE_GROUPS'), 'number')),

      SERVER_LISTEN_HOST: this.env.SERVER_LISTEN_HOST ?? DEFAULT_ENV.SERVER_LISTEN_HOST,
      SERVER_LISTEN_PORT: this.env.SERVER_LISTEN_PORT
        ? Number(this.env.SERVER_LISTEN_PORT)
        : DEFAULT_ENV.SERVER_LISTEN_PORT,
      SERVER_LOG_LEVEL: (this.env.SERVER_LOG_LEVEL ?? DEFAULT_ENV.SERVER_LOG_LEVEL) as LogLevel,

      GOOGLE_AI_BASE_URL: this.env.GOOGLE_AI_BASE_URL ?? DEFAULT_ENV.GOOGLE_AI_BASE_URL,
      LOCAL_PROXY_BASE_URL: this.env.LOCAL_PROXY_BASE_URL ?? DEFAULT_ENV.LOCAL_PROXY_BASE_URL,

      MAX_AGENT_ROUNDS: Number(this.env.MAX_AGENT_ROUNDS) || DEFAULT_ENV.MAX_AGENT_ROUNDS,
      REQUEST_LIMIT_SECOND: Number(this.env.REQUEST_LIMIT_SECOND) || DEFAULT_ENV.REQUEST_LIMIT_SECOND,
      HISTORY_TTL_DAY: Number(this.env.HISTORY_TTL_DAY) || DEFAULT_ENV.HISTORY_TTL_DAY,
      MAX_HISTORY_LENGTH: Number(this.env.MAX_HISTORY_LENGTH) || DEFAULT_ENV.MAX_HISTORY_LENGTH,
    };
  }

  private getEnv(key: keyof RawEnv): string {
    return this.env[key]!;
  }
}

const configLoader = new ConfigLoader();
export const CONFIG = configLoader.load();
