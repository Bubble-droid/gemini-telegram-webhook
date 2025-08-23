// src/types/config.d.ts

import type { LoggerLevel } from '@/services';

/**
 * Env 接口定义了应用程序期望从环境变量中读取的所有配置项。
 * 这些属性通常对应于 process.env 中的字符串值。
 */
export interface Env {
  SERVER_LISTEN_HOST?: string; // 服务器监听的主机地址 (可选)
  SERVER_LISTEN_PORT?: string; // 服务器监听的端口号 (可选)
  SERVER_LOGGER_LEVEL?: string; // 服务器日志级别 (可选)

  GEMINI_MODEL_NAME?: string;
  MAX_API_CALL_ROUNDS?: string;

  CLOUDFLARE_API_TOKEN: string; // Cloudflare API Token (必填)
  CLOUDFLARE_ACCOUNT_ID: string; // Cloudflare Account ID (必填)

  SCHEDULER_API_UEL: string;
  SCHEDULER_API_TOKEN: string;

  DURABLE_RESOURCE_NAMESPACE_ID: string;
  SYSTEM_PROMPT_KEY_NAME: string;
  GEMINI_API_KEYS_KEY_NAME: string;
  START_REPLY_TEXT_KEY_NAME: string;
  NEW_MEMBER_WELCOME_TEXT_KEY_NAME: string;

  RATE_LIMIT_NAMESPACE_ID: string;
  REQUEST_INTERVAL_SECOND?: string;

  CHAT_CONTEXT_NAMESPACE_ID: string;
  CONTEXT_EXPIRATION_DAY?: string;
  MAX_CONTEXT_LENGTH?: string;

  GITHUB_ACCESS_TOKEN: string; // GitHub Access Token

  WEBHOOK_SECRET_TOKEN: string; // Telegram Webhook 的安全密钥
  TELEGRAM_BOT_TOKEN: string; // Telegram Bot 的 API Token
  TELEGRAM_BOT_USERNAME: string; // 机器人的用户名，例如 "YourBot"
  TELEGRAM_BOT_ADMIN_ID: string; // 管理员的 Telegram 用户 ID
  ALLOWED_USAGE_GROUPS: string; // 允许使用机器人的群组 ID 列表，逗号分隔
}

/**
 * Config 接口定义了经过解析和验证后，应用程序内部使用的配置对象结构。
 * 这些属性通常具有更强的类型（如 number, LoggerLevel），而不是原始的 string。
 */
export interface Config {
  listenHost: string; // 监听主机地址，已解析为 string
  listenPort: number; // 监听端口号，已解析为 number
  loggerLevel: LoggerLevel; // 日志级别，已解析为 LoggerLevel 类型

  modelName: string;
  maxApiCallRounds: number;

  cloudflareToken: string;
  cloudflareAccountId: string;

  schedulerApiUrl: string;
  schedulerApiToken: string;

  durableResourceId: string;
  systemPromptKeyName: string;
  geminiApiKeysKeyName: string;
  startReplyTextKeyName: string;
  newMemberWelcomeTextKeyName: string;

  rateLimitId: string;
  requestIntervalSecond: number;

  chatContextId: string;
  contextsExpirationSecond: number;
  maxContextLength: number;

  githubToken: string; // GitHub Access Token

  secretToken: string; // Webhook Secret Token
  botToken: string; // Telegram Bot Token
  botApiUrl: string;
  botName: string; // 机器人的用户名，例如 "YourBot"
  adminId: number; // 管理员的 Telegram 用户 ID，已解析为 number
  allowGroups: number[]; // 允许使用机器人的群组 ID 列表，已解析为 string[]
}

export type { LoggerLevel };
