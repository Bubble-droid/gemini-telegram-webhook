// src/types/config.d.ts

import type { LoggerLevel } from '@/services';

/**
 * Env 接口定义了应用程序期望从环境变量中读取的所有配置项。
 * 这些属性通常对应于 process.env 中的字符串值。
 */
export interface Env {
  NODE_ENV?: string; // 运行环境 (可选)

  SERVER_LISTEN_HOST?: string; // 服务器监听的主机地址 (可选)
  SERVER_LISTEN_PORT?: string; // 服务器监听的端口号 (可选)
  SERVER_LOGGER_LEVEL?: string; // 服务器日志级别 (可选)

  ENABLE_KEY_ROTATION?: string; // 是否启用密钥轮换 (可选)

  GEMINI_API_BASE_URL?: string; // Gemini API 的基础 URL (可选)
  LOCAL_PROXY_BASE_URL?: string; // 本地代理的基础 URL (可选)
  GEMINI_API_KEYS: string; // 密钥列表 (必填)
  GEMINI_MODEL_NAME?: string;
  MODEL_CONFIG_TEMPERATURE?: string;

  MAX_API_CALL_ROUNDS?: string;
  REQUEST_INTERVAL_SECOND?: string;

  CONTEXT_EXPIRATION_DAY?: string;
  MAX_CONTEXT_LENGTH?: string;

  GITHUB_ACCESS_TOKEN: string; // GitHub Access Token

  WEBHOOK_RECEIVE_URL: string; // Telegram Webhook 的 URL
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
  nodeEnv: string; // 运行环境，已解析为 string

  listenHost: string; // 监听主机地址，已解析为 string
  listenPort: number; // 监听端口号，已解析为 number
  loggerLevel: LoggerLevel; // 日志级别，已解析为 LoggerLevel 类型

  enableKeyRotation: boolean; // 是否启用密钥轮换

  geminiApiBaseUrl: string; // Gemini API 的基础 URL，已解析为 string
  localProxyBaseUrl: string; // 本地代理的基础 URL，已解析为 string
  geminiApiKeys: string[]; // 密钥列表，已解析为 string[]
  modelName: string;
  modelTemperature: number;

  maxApiCallRounds: number;
  requestIntervalSecond: number;

  contextsExpirationSecond: number;
  maxContextLength: number;

  githubToken: string; // GitHub Access Token

  webhookUrl: string; // Webhook URL
  secretToken: string; // Webhook Secret Token
  botToken: string; // Telegram Bot Token
  botApiUrl: string;
  botName: string; // 机器人的用户名，例如 "YourBot"
  adminId: number; // 管理员的 Telegram 用户 ID，已解析为 number
  allowGroups: number[]; // 允许使用机器人的群组 ID 列表，已解析为 string[]
}

export type { LoggerLevel };
