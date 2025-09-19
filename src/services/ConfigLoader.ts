// src/services/ConfigLoader.ts

import { isIP } from 'node:net';
import process from 'node:process';
import type { Env, Config } from '@/types';
import { ConfigError } from '@/services'; // 导入自定义错误类型

const LOGGER_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LoggerLevel = (typeof LOGGER_LEVELS)[number];

/**
 * @class ConfigLoader
 * @description 负责加载、解析和验证应用程序的环境变量，并将其转换为强类型的配置对象。
 *              采用静态方法，使其可以直接通过类名调用，无需实例化。
 *              这确保了配置加载的集中化和一致性。
 */
class ConfigLoader {
  // 定义默认配置常量，用于当对应的环境变量未设置时提供回退值
  private readonly DEFAULT_LISTEN_HOST: string = '127.0.0.1';
  private readonly DEFAULT_LISTEN_PORT: number = 39001;
  private readonly DEFAULT_LOGGER_LEVEL: LoggerLevel = 'info';
  private readonly DEFAULT_MODEL_NAME: string = 'gemini-2.5-flash';
  private readonly DEFAULT_CONTEXT_EXPIRATION_DAY: number = 7;
  private readonly DEFAULT_MAX_CONTEXT_LENGTH: number = 8;
  private readonly DEFAULT_REQUEST_INTERVAL_SECOND: number = 30;
  private readonly DEFAULT_MAX_API_CALL_ROUNDS: number = 12;
  private readonly DEFAULT_SYSTEM_PROMPT_KEY_NAME: string = 'system_prompt';
  private readonly DEFAULT_GEMINI_API_KEYS_KEY_NAME: string = 'gemini_api_keys';
  private readonly DEFAULT_START_REPLY_TEXT_KEY_NAME: string = 'start_reply_text';
  private readonly DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME: string = 'new_member_welcome_text';

  // 定义必填环境变量的键名列表。
  // 在加载配置时，会检查这些环境变量是否都已设置且非空。
  private readonly REQUIRED_ENV_VARS: (keyof Env)[] = [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'SCHEDULER_API_URL',
    'SCHEDULER_API_TOKEN',
    'DURABLE_RESOURCE_NAMESPACE_ID',
    'SYSTEM_PROMPT_KEY_NAME',
    'GEMINI_API_KEYS_KEY_NAME',
    'SCRIPTS_STORAGE_NAMESPACE_ID',
    'RATE_LIMIT_NAMESPACE_ID',
    'CHAT_CONTEXT_NAMESPACE_ID',
    'GITHUB_ACCESS_TOKEN',
    'WEBHOOK_SECRET_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BOT_USERNAME',
    'TELEGRAM_BOT_ADMIN_ID',
    'ALLOWED_USAGE_GROUPS',
  ];

  /**
   * 解析并验证监听主机地址。
   * @private
   * @param {string | undefined} val - 环境变量 `SERVER_LISTEN_HOST` 的原始值。
   * @param {string} [fallback=this.DEFAULT_LISTEN_HOST] - 当环境变量未设置或为空时使用的默认值。
   * @returns {string} 经过验证的有效监听主机地址（IPv4 或 IPv6）。
   * @throws {ConfigError} 如果主机地址无效（例如不是有效的 IP 地址）。
   */
  private parseListenHost = (val: string | undefined, fallback: string = this.DEFAULT_LISTEN_HOST): string => {
    if (!val || val.trim() === '') {
      return fallback;
    }
    const host: string = val.trim();
    // isIP 返回 0 表示不是有效的 IPv4 或 IPv6 地址
    if (isIP(host) === 0) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_HOST 无效："${host}" 不是有效的 IPv4 或 IPv6 地址`);
    }
    return host;
  };

  /**
   * 解析并验证监听端口号。
   * @private
   * @param {string | undefined} val - 环境变量 `SERVER_LISTEN_PORT` 的原始值。
   * @param {number} [fallback=this.DEFAULT_LISTEN_PORT] - 当环境变量未设置或为空时使用的默认值。
   * @returns {number} 经过验证的有效监听端口号。
   * @throws {ConfigError} 如果端口号无效（例如不是数字、超出范围 1-65535）。
   */
  private parsePort = (val: string | undefined, fallback: number = this.DEFAULT_LISTEN_PORT): number => {
    if (!val || val.trim() === '') {
      return fallback;
    }

    // 使用正则表达式检查字符串是否完全由数字组成，确保是合法的数字字符串
    if (!/^\d+$/.test(val)) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 不是纯数字`);
    }

    const n: number = Number.parseInt(val, 10);

    // 额外的数值有效性检查：确保解析结果是有限的数字，防止 Number.parseInt 无法处理的极端情况
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 无法解析为有效数值`);
    }

    // 检查端口号是否在标准有效范围内 (1-65535)
    if (n < 1 || n > 65535) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 超出范围：${n}，应在 1-65535 之间`);
    }
    return n;
  };

  /**
   * 解析并验证日志级别。
   * @private
   * @param {string | undefined} val - 环境变量 `SERVER_LOGGER_LEVEL` 的原始值。
   * @param {LoggerLevel} [fallback=this.DEFAULT_LOGGER_LEVEL] - 当环境变量未设置或为空时使用的默认值。
   * @returns {LoggerLevel} 经过验证的有效日志级别。
   * @throws {ConfigError} 如果日志级别非法（不在预定义的 `LOGGER_LEVELS` 中）。
   */
  private parseLoggerLevel = (val: string | undefined, fallback: LoggerLevel = this.DEFAULT_LOGGER_LEVEL): LoggerLevel => {
    if (!val || val.trim() === '') {
      return fallback;
    }
    // 检查传入的日志级别字符串是否包含在预定义的枚举中，并转换为小写进行比较
    const trimmedVal: string = val.trim().toLowerCase();
    if ((LOGGER_LEVELS as readonly string[]).includes(trimmedVal)) {
      return trimmedVal as LoggerLevel;
    }
    throw new ConfigError(`环境变量 SERVER_LOGGER_LEVEL 非法："${val.trim()}"。可选值为 ${LOGGER_LEVELS.join(', ')}`);
  };

  /**
   * 加载并返回应用程序的配置对象。
   * 这是外部调用的主要入口点，它会读取环境变量，进行解析、验证和转换。
   * @public
   * @returns {Config} 应用程序的强类型配置对象。
   * @throws {ConfigError} 如果缺少必要的环境变量或任何环境变量的值无效。
   */
  public load = (): Config => {
    // 将 `process.env` 断言为 `Env` 类型，以便进行类型安全的属性访问。
    // 这是一个运行时断言，不会在编译时检查 `process.env` 的实际内容，
    // 因此依赖于后续的运行时验证来确保数据完整性。
    const ENV = process.env as unknown as Env;

    // 检查所有必填环境变量是否都已设置且不为空字符串
    const missing: (keyof Env)[] = this.REQUIRED_ENV_VARS.filter(
      (k) => !ENV[k] || (ENV[k] as string).trim() === '', // 将值强制转换为 string 以便使用 trim()
    );

    if (missing.length > 0) {
      // 如果存在缺失的必填环境变量，则抛出配置错误
      throw new ConfigError(`缺少必要环境变量：${missing.join(', ')}`);
    }

    // 解析各个配置项，并使用私有静态方法进行验证和转换，确保数据类型和有效性
    const listenHost: string = this.parseListenHost(ENV.SERVER_LISTEN_HOST);
    const listenPort: number = this.parsePort(ENV.SERVER_LISTEN_PORT);
    const loggerLevel: LoggerLevel = this.parseLoggerLevel(ENV.SERVER_LOGGER_LEVEL);

    const modelName: string = ENV.GEMINI_MODEL_NAME || this.DEFAULT_MODEL_NAME;
    const modelTemperature: number = Number(ENV.MODEL_CONFIG_TEMPERATURE) || 0.2;
    const maxApiCallRounds: number = Number(ENV.MAX_API_CALL_ROUNDS) || this.DEFAULT_MAX_API_CALL_ROUNDS;

    const cloudflareToken: string = ENV.CLOUDFLARE_API_TOKEN;
    const cloudflareAccountId: string = ENV.CLOUDFLARE_ACCOUNT_ID;

    const schedulerApiUrl: string = ENV.SCHEDULER_API_URL;
    const schedulerApiToken: string = ENV.SCHEDULER_API_TOKEN;

    const durableResourceId: string = ENV.DURABLE_RESOURCE_NAMESPACE_ID;
    const systemPromptKeyName: string = ENV.SYSTEM_PROMPT_KEY_NAME || this.DEFAULT_SYSTEM_PROMPT_KEY_NAME;
    const geminiApiKeysKeyName: string = ENV.GEMINI_API_KEYS_KEY_NAME || this.DEFAULT_GEMINI_API_KEYS_KEY_NAME;
    const startReplyTextKeyName: string = ENV.START_REPLY_TEXT_KEY_NAME || this.DEFAULT_START_REPLY_TEXT_KEY_NAME;
    const newMemberWelcomeTextKeyName: string = ENV.NEW_MEMBER_WELCOME_TEXT_KEY_NAME || this.DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME;

    const scriptsStorageId: string = ENV.SCRIPTS_STORAGE_NAMESPACE_ID;

    const rateLimitId: string = ENV.RATE_LIMIT_NAMESPACE_ID;
    const chatContextId: string = ENV.CHAT_CONTEXT_NAMESPACE_ID;

    const contextsExpirationSecond: number = (Number(ENV.CONTEXT_EXPIRATION_DAY) || this.DEFAULT_CONTEXT_EXPIRATION_DAY) * 24 * 60 * 60;
    const maxContextLength: number = Number(ENV.MAX_CONTEXT_LENGTH) || this.DEFAULT_MAX_CONTEXT_LENGTH;
    const requestIntervalSecond: number = Number(ENV.REQUEST_INTERVAL_SECOND) || this.DEFAULT_REQUEST_INTERVAL_SECOND;

    const githubToken: string = ENV.GITHUB_ACCESS_TOKEN;

    const secretToken: string = ENV.WEBHOOK_SECRET_TOKEN;
    const botToken: string = ENV.TELEGRAM_BOT_TOKEN;
    const botApiUrl: string = `https://api.telegram.org/bot${botToken}`;
    const botName: string = ENV.TELEGRAM_BOT_USERNAME;
    const adminId: number = Number(ENV.TELEGRAM_BOT_ADMIN_ID);

    const allowGroups: number[] = ENV.ALLOWED_USAGE_GROUPS.split(',').map((s) => Number(s.trim())) || [];

    // 返回一个完整的、类型安全的配置对象
    return {
      listenHost,
      listenPort,
      loggerLevel,
      modelName,
      modelTemperature,
      maxApiCallRounds,
      cloudflareToken,
      cloudflareAccountId,
      schedulerApiUrl,
      schedulerApiToken,
      durableResourceId,
      systemPromptKeyName,
      geminiApiKeysKeyName,
      startReplyTextKeyName,
      newMemberWelcomeTextKeyName,
      scriptsStorageId,
      rateLimitId,
      chatContextId,
      contextsExpirationSecond,
      maxContextLength,
      requestIntervalSecond,
      githubToken,
      secretToken,
      botToken,
      botApiUrl,
      botName,
      adminId,
      allowGroups,
    };
  };
}

export const config: ConfigLoader = new ConfigLoader();
