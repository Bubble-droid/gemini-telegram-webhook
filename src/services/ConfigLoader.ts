import { GEMINI_API_BASE_URL, GEMINI_GENERATE_MODEL } from '@/configs/constant';
import type { EnvConfig, ExtractAndMakeRequired, RawEnv, StringifyProps } from '@/types';
import { AppError } from '@/utils/errors';
import type { LogLevel } from 'fastify';
import { isIP } from 'node:net';

const LOG_LEVELS = new Set<LogLevel>(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

const REQUIRED_ENV_VARS: (keyof RawEnv)[] = [
  'GEMINI_API_KEYS',
  'GITHUB_ACCESS_TOKEN',
  'GITHUB_REPOSITORY',
  'WEBHOOK_RECEIVE_URL',
  'WEBHOOK_SECRET_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_ID',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_BOT_OWNER_ID',
  'ALLOWED_USAGE_GROUPS',
];

const DEFAULT_ENV = {
  SERVER_LISTEN_HOST: '127.0.0.1',
  SERVER_LISTEN_PORT: 39001,
  SERVER_LOG_LEVEL: 'info',

  ENABLE_KEY_ROTATION: false,
  GEMINI_API_BASE_URL: GEMINI_API_BASE_URL,
  LOCAL_PROXY_BASE_URL: `http://127.0.0.1:39001/gemini`,

  GEMINI_MODEL_NAME: GEMINI_GENERATE_MODEL,
  MODEL_CONFIG_TEMPERATURE: 1.0,

  MAX_API_CALL_ROUNDS: 16,
  REQUEST_LIMIT_SECOND: 20,

  CONTEXT_TTL_DAY: 7,
  MAX_CONTEXT_LENGTH: 8,
} as const satisfies ExtractAndMakeRequired<RawEnv>;

type Split<T extends 'string' | 'number'> = T extends 'string' ? string[] : number[];

const splitArray = <T extends 'string' | 'number'>(val: string | undefined, type: T): Split<T> => {
  if (!val?.trim().length) return [];
  return val.split(',').flatMap((s) => {
    const trimmed = s.trim();
    if (!trimmed.length) return [];
    const value = type === 'string' ? trimmed : Number(trimmed);
    return [value];
  }) as Split<T>;
};

const parseListenHost = (val: string | undefined): string => {
  if (!val?.trim().length) return DEFAULT_ENV.SERVER_LISTEN_HOST;
  const host = val.trim();
  if (isIP(host) === 0) {
    throw new AppError(`环境变量 SERVER_LISTEN_HOST 无效："${host}" 不是有效的 IPv4 或 IPv6 地址`);
  }
  return host;
};

const parsePort = (val: string | undefined): number => {
  if (!val?.trim().length) return DEFAULT_ENV.SERVER_LISTEN_PORT;
  if (!/^\d+$/.test(val)) {
    throw new AppError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 不是纯数字`);
  }
  const n = Number.parseInt(val, 10);
  if (n < 1 || n > 65535) {
    throw new AppError(`环境变量 SERVER_LISTEN_PORT 超出范围：${n}，应在 1-65535 之间`);
  }
  return n;
};

const parseLogLevel = (val: string | undefined): LogLevel => {
  const levelRaw = val?.trim().toLowerCase() as LogLevel | undefined;
  if (!levelRaw?.length) return DEFAULT_ENV.SERVER_LOG_LEVEL;
  if (LOG_LEVELS.has(levelRaw)) return levelRaw;
  throw new AppError(`环境变量 SERVER_LOGGER_LEVEL 非法："${val}"。可选值为 ${[...LOG_LEVELS].join(', ')}`);
};

class ConfigLoader {
  private readonly env: StringifyProps<RawEnv>;
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
      throw new AppError(`启动失败，缺少必要的环境变量：${missing.join(', ')}`);
    }
  }

  private parseEnv(): EnvConfig {
    return {
      GEMINI_API_KEYS: splitArray(this.getEnv('GEMINI_API_KEYS'), 'string'),

      GITHUB_ACCESS_TOKEN: this.getEnv('GITHUB_ACCESS_TOKEN'),
      GITHUB_REPOSITORY: this.getEnv('GITHUB_REPOSITORY'),

      WEBHOOK_RECEIVE_URL: this.getEnv('WEBHOOK_RECEIVE_URL'),
      WEBHOOK_SECRET_TOKEN: this.getEnv('WEBHOOK_SECRET_TOKEN'),

      TELEGRAM_BOT_TOKEN: this.getEnv('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_BOT_ID: Number(this.getEnv('TELEGRAM_BOT_ID')),
      TELEGRAM_BOT_USERNAME: this.getEnv('TELEGRAM_BOT_USERNAME'),
      TELEGRAM_BOT_OWNER_ID: Number(this.getEnv('TELEGRAM_BOT_OWNER_ID')),
      ALLOWED_USAGE_GROUPS: splitArray(this.getEnv('ALLOWED_USAGE_GROUPS'), 'number'),

      SERVER_LISTEN_HOST: parseListenHost(this.env.SERVER_LISTEN_HOST),
      SERVER_LISTEN_PORT: parsePort(this.env.SERVER_LISTEN_PORT),
      SERVER_LOG_LEVEL: parseLogLevel(this.env.SERVER_LOG_LEVEL),

      ENABLE_KEY_ROTATION: this.env.ENABLE_KEY_ROTATION === 'true',
      GEMINI_API_BASE_URL: this.env.GEMINI_API_BASE_URL ?? DEFAULT_ENV.GEMINI_API_BASE_URL,
      LOCAL_PROXY_BASE_URL: this.env.LOCAL_PROXY_BASE_URL ?? DEFAULT_ENV.LOCAL_PROXY_BASE_URL,

      GEMINI_MODEL_NAME: this.env.GEMINI_MODEL_NAME ?? DEFAULT_ENV.GEMINI_MODEL_NAME,
      MODEL_CONFIG_TEMPERATURE: Number(this.env.MODEL_CONFIG_TEMPERATURE) || DEFAULT_ENV.MODEL_CONFIG_TEMPERATURE,

      MAX_API_CALL_ROUNDS: Number(this.env.MAX_API_CALL_ROUNDS) || DEFAULT_ENV.MAX_API_CALL_ROUNDS,
      REQUEST_LIMIT_SECOND: Number(this.env.REQUEST_LIMIT_SECOND) || DEFAULT_ENV.REQUEST_LIMIT_SECOND,
      CONTEXT_TTL_DAY: Number(this.env.CONTEXT_TTL_DAY) || DEFAULT_ENV.CONTEXT_TTL_DAY,
      MAX_CONTEXT_LENGTH: Number(this.env.MAX_CONTEXT_LENGTH) || DEFAULT_ENV.MAX_CONTEXT_LENGTH,
    };
  }

  private getEnv(key: keyof RawEnv): string {
    return this.env[key]!;
  }
}

const configLoader = new ConfigLoader();
export const CONFIG = configLoader.load();
