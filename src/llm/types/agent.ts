import type { FunctionResponse, GenerateContentConfig, GoogleGenAI } from '@google/genai';
import type { MaybePromise, Recordable } from '@shared/types/common';
import type { JSONSchema } from '@shared/types/schema';

export type BaseToolResult<R> = MaybePromise<StandardizedFunctionResponse<R>>;

export type StatusUpdateCallback = (text: string) => MaybePromise<unknown>;

export type ToolCall<R = unknown> = (name: string, args?: Recordable) => BaseToolResult<R>;

export interface CallBackFns {
  onStatusUpdate?: StatusUpdateCallback;
}

export interface ChatAgentOptions {
  onStatusUpdate: StatusUpdateCallback;
  maxRounds?: number;
  geminiApiOptions?: GeminiApiOptions;
  callTool?: ToolCall;
}

export interface GeminiApiOptions {
  genClient?: GoogleGenAI;
  genModel?: string;
  genConfig?: GenerateContentConfig;
}

export type NormalizedResponse<T = unknown> = { output: T; error?: never } | { error: string; output?: never };

export type StandardizedFunctionResponse<T = unknown> = Omit<FunctionResponse, 'response'> & {
  response: NormalizedResponse<T>;
};

export interface GeneralFunctionSchema {
  name: string;
  description?: string;
  parametersJsonSchema: JSONSchema;
}
