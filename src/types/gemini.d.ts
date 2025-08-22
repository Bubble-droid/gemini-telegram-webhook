// src/types/gemini.d.ts

import type { Content } from '@google/genai';

export interface ChatParams {
  chatId: number;
  thinkMessageId: number;
}

export interface GenerateContentSuccessResponse {
  response: Content;
  apiCallSuccessCount: number;
  totalUsageToken: number;
  usageToolCount: number;
  emptyReplyRetryCount: number; // 空回复重试次数
  errorRetryCount: number; // API 客户端错误重试次数
  totalRetryCount: number; // 记录所有重试次数（空回复重试 + 客户端错误重试）
  totalDurationSecond: number;
  hasToolThoughts: boolean;
}

/**
 * @interface ApiCallContext
 * @description 封装 Gemini API 调用过程中的所有上下文信息和指标。
 */
export interface ApiCallContext {
  chatId: number;
  thinkMessageId: number | undefined; // 考虑到可能没有 thinkMessageId 的情况，设为可选
  systemPrompt: string;
  apiKeys: [string, string][]; // 当前轮换后的 API 密钥组
  modelName: string;
  config: GenerateContentConfig;
  contents: Content[];
  metrics: {
    apiCallSuccessCount: number;
    totalUsageToken: number;
    usageToolCount: number;
    emptyReplyRetryCount: number; // 空回复重试次数
    errorRetryCount: number; // API 客户端错误重试次数
    totalRetryCount: number; // 记录所有重试次数（空回复重试 + 客户端错误重试）
    startProcessTime: number;
    totalDurationSecond: number;
    hasToolThoughts: boolean;
  };
}
