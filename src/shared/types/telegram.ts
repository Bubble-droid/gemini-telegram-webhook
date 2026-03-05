import type { ApiMethods, Opts } from '@grammyjs/types';
import type { ChatCompletionMessageParam } from 'openai/resources.js';

type Ret<F> = {
  [M in keyof ApiMethods<F>]: ReturnType<ApiMethods<F>[M]>;
};

export type Integer = number;
export type ChatId = Integer | string;

export type ApiMethod = keyof ApiMethods<File>;

export type ApiParams<M extends ApiMethod> = Opts<File>[M];

export type ApiReturn<M extends ApiMethod> = Ret<File>[M];

export interface CustomReplyParams {
  replyToMessageId?: number | undefined;
}

export interface AutoDeleteParams {
  deleteAfterMs?: number;
}

export interface ChitchatState {
  maxScore: number;
  currentScore: number;
  groupHistory: ChatCompletionMessageParam[];
}
