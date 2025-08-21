// src/types/webhook.d.ts

import type { Update } from '@/types'; // 导入 Telegram Update 接口

/**
 * RequestHeaders 接口定义了 Fastify 请求的 HTTP 头部中我们所关心的特定字段。
 */
export interface RequestHeaders {
  'content-type': 'application/json'; // 明确 Content-Type 必须为 application/json
  'x-telegram-bot-api-secret-token': string; // Telegram Webhook 用于验证请求的秘密令牌
}

/**
 * RequestBody 接口定义了 Fastify 请求体所期望的结构。
 * 这里它扩展了 Telegram 的 Update 接口，意味着请求体应该是一个 Telegram Update 对象。
 */
export type RequestBody = Update;
