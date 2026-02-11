import type { FunctionResponse, GenerateContentConfig } from '@google/genai';
import type { MaybePromise, Recordable } from '@shared/types/common.js';
import type { JSONSchema } from '@shared/types/schema.js';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.mjs';

export type BaseToolResult<R> = MaybePromise<StandardizedFunctionResponse<R>>;

export type StatusUpdateCallback = (text: string) => MaybePromise;

export type ToolCall<R = unknown> = (name: string, args?: Recordable) => BaseToolResult<R>;

export interface CallBackFns {
  onStatusUpdate?: StatusUpdateCallback;
}

export interface GeminiAgentOpts {
  maxRounds?: number;
  callTool?: ToolCall;
  onStatusUpdate?: StatusUpdateCallback | undefined;
  generateConfig?: GenerateContentConfig | undefined;
}

export type NormalizedResponse<T = unknown> = { output: T; error?: never } | { error: string; output?: never };

export type StandardizedFunctionResponse<T = unknown> = Omit<FunctionResponse, 'response'> & {
  response: NormalizedResponse<T>;
};

export interface GeneralFunctionSchema {
  name: string;
  description?: string;
  parametersJsonSchema?: JSONSchema;
}

export type OpenAiClientParams = Omit<ChatCompletionCreateParamsBase, 'messages' | 'n' | 'stream'>;
