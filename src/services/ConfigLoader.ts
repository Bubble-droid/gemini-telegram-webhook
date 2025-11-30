// src/services/ConfigLoader.ts

import { AppError } from '@/services';
import type { Config, Env } from '@/types';
import { isIP } from 'node:net';

// 定义允许的日志级别
const LOGGER_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LoggerLevel = (typeof LOGGER_LEVELS)[number];

/**
 * @class ConfigLoader
 * @description 负责在应用程序启动阶段一次性加载、解析和验证所有环境变量。
 *              确保 Config 对象不可变且类型安全。
 */
class ConfigLoader {
  // 1. 定义默认值常量
  private readonly DEFAULT_LISTEN_HOST = '127.0.0.1';
  private readonly DEFAULT_LISTEN_PORT = 39001;
  private readonly DEFAULT_LOGGER_LEVEL: LoggerLevel = 'info';
  private readonly DEFAULT_ENABLE_KEY_ROTATION = false;
  private readonly DEFAULT_GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';
  private readonly DEFAULT_LOCAL_PROXY_BASE_URL = `http://127.0.0.1:${this.DEFAULT_LISTEN_PORT}/gemini`;
  private readonly DEFAULT_MODEL_NAME = 'gemini-flash-latest';
  private readonly DEFAULT_MODEL_CONFIG_TEMPERATURE = 0.2;
  private readonly DEFAULT_MAX_API_CALL_ROUNDS = 12;
  private readonly DEFAULT_REQUEST_INTERVAL_SECOND = 10;
  private readonly DEFAULT_CONTEXT_EXPIRATION_DAY = 7;
  private readonly DEFAULT_MAX_CONTEXT_LENGTH = 8;
  private readonly REQUIRED_ENV_VARS: (keyof Env)[] = [
    'GEMINI_API_KEYS',
    'GITHUB_ACCESS_TOKEN',
    'WEBHOOK_RECEIVE_URL',
    'WEBHOOK_SECRET_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BOT_USERNAME',
    'TELEGRAM_BOT_ADMIN_ID',
    'ALLOWED_USAGE_GROUPS',
  ];
  private readonly config: Config;
  private readonly env: NodeJS.ProcessEnv;

  constructor() {
    this.env = process.env;
    this.validateRequiredEnv();
    this.config = this.buildConfig();
    Object.freeze(this.config);
  }

  /**
   * 验证所有必须的环境变量是否已设置
   * @private
   */
  private validateRequiredEnv(): void {
    const missing = this.REQUIRED_ENV_VARS.filter((key) => {
      const val = this.env[key as string];
      return !val || val.trim() === '';
    });

    if (missing.length > 0) {
      throw new AppError(`启动失败，缺少必要环境变量：${missing.join(', ')}`);
    }
  }

  /**
   * 获取配置对象
   * @public
   * @returns {Config} 已初始化的配置对象
   */
  public load(): Config {
    return this.config;
  }

  /**
   * 核心构建逻辑：将所有 ENV 转换为 Config
   * @private
   */
  private buildConfig(): Config {
    return {
      nodeEnv: this.env.NODE_ENV || 'production',

      listenHost: this.parseListenHost(this.env.SERVER_LISTEN_HOST),
      listenPort: this.parsePort(this.env.SERVER_LISTEN_PORT),
      loggerLevel: this.parseLoggerLevel(this.env.SERVER_LOGGER_LEVEL),

      enableKeyRotation: this.env.ENABLE_KEY_ROTATION === 'true' || this.DEFAULT_ENABLE_KEY_ROTATION,

      geminiApiBaseUrl: this.env.GEMINI_API_BASE_URL || this.DEFAULT_GEMINI_API_BASE_URL,
      localProxyBaseUrl: this.env.LOCAL_PROXY_BASE_URL || this.DEFAULT_LOCAL_PROXY_BASE_URL,
      geminiApiKeys: this.parseStringArray(this.getEnv('GEMINI_API_KEYS')),
      modelName: this.env.GEMINI_MODEL_NAME || this.DEFAULT_MODEL_NAME,
      modelTemperature: Number(this.env.MODEL_CONFIG_TEMPERATURE) || this.DEFAULT_MODEL_CONFIG_TEMPERATURE,

      maxApiCallRounds: Number(this.env.MAX_API_CALL_ROUNDS) || this.DEFAULT_MAX_API_CALL_ROUNDS,
      requestIntervalSecond: Number(this.env.REQUEST_INTERVAL_SECOND) || this.DEFAULT_REQUEST_INTERVAL_SECOND,

      contextsExpirationSecond:
        (Number(this.env.CONTEXT_EXPIRATION_DAY) || this.DEFAULT_CONTEXT_EXPIRATION_DAY) * 24 * 60 * 60,
      maxContextLength: Number(this.env.MAX_CONTEXT_LENGTH) || this.DEFAULT_MAX_CONTEXT_LENGTH,

      githubToken: this.getEnv('GITHUB_ACCESS_TOKEN'),

      webhookUrl: this.getEnv('WEBHOOK_RECEIVE_URL'),
      secretToken: this.getEnv('WEBHOOK_SECRET_TOKEN'),
      botToken: this.getEnv('TELEGRAM_BOT_TOKEN'),
      botApiUrl: `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}`,
      botName: this.getEnv('TELEGRAM_BOT_USERNAME'),
      adminId: Number(this.getEnv('TELEGRAM_BOT_ADMIN_ID')),
      allowGroups: this.parseNumberArray(this.env.ALLOWED_USAGE_GROUPS),
    };
  }

  /**
   * 安全获取必须存在的环境变量（辅助方法，避免类型断言）
   */
  private getEnv(key: keyof Env): string {
    // 前面 validateRequiredEnv 已经保证了这些值存在
    return this.env[key as string] as string;
  }

  /**
   * 解析逗号分隔的数字字符串数组
   * @param val "123, 456"
   */
  private parseNumberArray(val: string | undefined): number[] {
    if (!val || val.trim() === '') return [];
    return val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '') // 过滤空字符串，防止 Number('') 变成 0
      .map((s) => Number(s))
      .filter((n) => !Number.isNaN(n)); // 过滤无效数字
  }

  private parseStringArray(val: string | undefined): string[] {
    if (!val || val.trim() === '') return [];
    return val
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  // --- 以下为原有的验证逻辑，稍作保留和优化 ---

  private parseListenHost(val: string | undefined): string {
    const host = val?.trim() || this.DEFAULT_LISTEN_HOST;
    if (isIP(host) === 0) {
      throw new AppError(`环境变量 SERVER_LISTEN_HOST 无效："${host}" 不是有效的 IPv4 或 IPv6 地址`);
    }
    return host;
  }

  private parsePort(val: string | undefined): number {
    if (!val || val.trim() === '') {
      return this.DEFAULT_LISTEN_PORT;
    }
    if (!/^\d+$/.test(val)) {
      throw new AppError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 不是纯数字`);
    }
    const n = Number.parseInt(val, 10);
    if (n < 1 || n > 65535) {
      throw new AppError(`环境变量 SERVER_LISTEN_PORT 超出范围：${n}，应在 1-65535 之间`);
    }
    return n;
  }

  private parseLoggerLevel(val: string | undefined): LoggerLevel {
    const levelRaw = val?.trim().toLowerCase();
    if (!levelRaw) {
      return this.DEFAULT_LOGGER_LEVEL;
    }
    if ((LOGGER_LEVELS as readonly string[]).includes(levelRaw)) {
      return levelRaw as LoggerLevel;
    }
    throw new AppError(`环境变量 SERVER_LOGGER_LEVEL 非法："${val}"。可选值为 ${LOGGER_LEVELS.join(', ')}`);
  }
}

const configLoader: ConfigLoader = new ConfigLoader();
export const config: Config = configLoader.load();
