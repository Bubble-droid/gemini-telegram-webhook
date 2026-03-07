import type { EnvConfig, RawEnv } from '@shared/types/env.js';
import type { ExtractAndMakeRequired, RequiredKeys, StringifyProps, VerifyExactKeys } from '@shared/types/utils.js';
import type { LogLevel } from 'fastify';
import { DEFAULT_SERVER_LISTEN_PORT } from './constants.js';

type Split<T extends 'string' | 'number'> = T extends 'string' ? string[] : number[];

const defineRequiredKeys =
  <T>() =>
  <K extends readonly RequiredKeys<T>[]>(keys: K & VerifyExactKeys<RequiredKeys<T>, K>) =>
    keys;

const REQUIRED_ENV_VARS = defineRequiredKeys<RawEnv>()([
  'GEMINI_API_KEYS',
  'PROXY_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'GITHUB_ACCESS_TOKEN',
  'GITHUB_REPOSITORY',
  'TELEGRAPH_ACCOUNT_INFO',
  'WEBHOOK_RECEIVE_URL',
  'WEBHOOK_SECRET_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_OWNER_ID',
  'ALLOWED_USAGE_GROUPS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const);

const DEFAULT_ENV = {
  SERVER_LISTEN_HOST: '127.0.0.1',
  SERVER_LISTEN_PORT: DEFAULT_SERVER_LISTEN_PORT,
  SERVER_LOG_LEVEL: 'info',
  GEMINI_CREDENTIALS: undefined,
  GOOGLE_CLOUD_PROJECT: undefined,
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

      GEMINI_CREDENTIALS: this.getEnv('GEMINI_CREDENTIALS'),
      GOOGLE_CLOUD_PROJECT: this.getEnv('GOOGLE_CLOUD_PROJECT'),

      PROXY_AUTH_TOKEN: this.getEnv('PROXY_AUTH_TOKEN'),

      OPENAI_API_KEY: this.getEnv('OPENAI_API_KEY'),

      GITHUB_ACCESS_TOKEN: this.getEnv('GITHUB_ACCESS_TOKEN'),
      GITHUB_REPOSITORY: this.getEnv('GITHUB_REPOSITORY'),

      TELEGRAPH_ACCOUNT_INFO: this.getEnv('TELEGRAPH_ACCOUNT_INFO'),

      WEBHOOK_RECEIVE_URL: this.getEnv('WEBHOOK_RECEIVE_URL'),
      WEBHOOK_SECRET_TOKEN: this.getEnv('WEBHOOK_SECRET_TOKEN'),

      TELEGRAM_BOT_TOKEN: this.getEnv('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_BOT_OWNER_ID: Number(this.getEnv('TELEGRAM_BOT_OWNER_ID')),
      ALLOWED_USAGE_GROUPS: splitArray(this.getEnv('ALLOWED_USAGE_GROUPS'), 'number'),

      UPSTASH_REDIS_REST_URL: this.getEnv('UPSTASH_REDIS_REST_URL'),
      UPSTASH_REDIS_REST_TOKEN: this.getEnv('UPSTASH_REDIS_REST_TOKEN'),

      SERVER_LISTEN_HOST: this.env.SERVER_LISTEN_HOST ?? DEFAULT_ENV.SERVER_LISTEN_HOST,
      SERVER_LISTEN_PORT: this.env.SERVER_LISTEN_PORT
        ? Number(this.env.SERVER_LISTEN_PORT)
        : DEFAULT_ENV.SERVER_LISTEN_PORT,
      SERVER_LOG_LEVEL: (this.env.SERVER_LOG_LEVEL ?? DEFAULT_ENV.SERVER_LOG_LEVEL) as LogLevel,
    };
  }

  private getEnv(key: keyof RawEnv): string {
    return this.env[key]!;
  }
}

const configLoader = new ConfigLoader();
export const CONFIG = configLoader.load();
