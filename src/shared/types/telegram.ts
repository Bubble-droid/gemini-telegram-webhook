import type { Content } from '@google/genai';
import type { ApiMethods } from 'grammy/types';
import type { Methods, RawApi } from 'node_modules/grammy/out/core/client.js';

export type Integer = number;
export type ChatId = Integer | string;

export type ApiMethod = Methods<RawApi>;

export type ApiParams<M extends ApiMethod> = Parameters<ApiMethods[M]>[0];

export type ApiReturn<M extends ApiMethod> = ReturnType<ApiMethods[M]>;

export interface ApiErrorResult {
  ok: false;
  error: string;
}

interface ApiSuccessResult<T> {
  ok: true;
  data: T;
}

export type ApiResult<M extends ApiMethod> = ApiSuccessResult<ApiReturn<M>> | ApiErrorResult;

export interface CustomReplyParams {
  replyToMessageId?: number | undefined;
}

export interface AutoDeleteParams {
  deleteAfterMs?: number;
}

export interface ChitchatState {
  maxScore: number;
  currentScore: number;
  groupHistory: Content[];
}
