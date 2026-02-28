import type { Content } from '@google/genai';
import type { ApiMethods, Opts } from '@grammyjs/types';

type Ret<F> = {
  [M in keyof ApiMethods<F>]: ReturnType<ApiMethods<F>[M]>;
};

export interface ApiError {
  ok: false;
  error: string;
}
interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export type Integer = number;
export type ChatId = Integer | string;

export type ApiMethod = keyof ApiMethods<File>;

export type ApiParams<M extends ApiMethod> = Opts<File>[M];

export type ApiReturn<M extends ApiMethod> = Ret<File>[M];

export type ApiResult<M extends ApiMethod> = ApiSuccess<ApiReturn<M>> | ApiError;

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
