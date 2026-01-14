import type { FunctionResponse, GenerateContentConfig, GoogleGenAI } from '@google/genai';
import type { MaybePromise, Recordable } from './common';

export type CommonToolResult<R> = MaybePromise<StandardizedFunctionResponse<R>>;

export type StatusUpdateCallback = (text: string) => MaybePromise<void>;

export type ToolExecutorFn<R = unknown> = (name: string, args?: Recordable) => CommonToolResult<R>;

export interface CallBackFns {
  onStatusUpdate?: StatusUpdateCallback;
}

export interface ChatAgentOptions {
  maxRounds?: number;
  geminiApiOptions?: GeminiApiOptions;
  toolExecutor?: ToolExecutorFn;
  onStatusUpdate?: StatusUpdateCallback;
}

export interface GeminiApiOptions {
  genClient?: GoogleGenAI;
  genModel?: string;
  genConfig?: GenerateContentConfig;
  onStatusUpdate?: StatusUpdateCallback;
}

type NormalizedResponse<T = unknown> = { output: T; error?: never } | { error: string; output?: never };

export type StandardizedFunctionResponse<T = unknown> = Omit<FunctionResponse, 'response'> & {
  response: NormalizedResponse<T>;
};
