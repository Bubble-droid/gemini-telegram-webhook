import type {
  FunctionDeclaration,
  FunctionResponse,
  GenerateContentConfig,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { MaybePromise, Recordable } from '@shared/types/common.js';
import type { JSONSchema } from '@shared/types/schema.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.mjs';

export type BaseToolResult<R = unknown> = MaybePromise<StandardizedFunctionResponse<R>>;

export type StatusUpdateCallback = (text: string) => MaybePromise;

export type ToolCall<R = unknown> = (name: string, args?: Recordable) => BaseToolResult<R>;

export interface CallBackFns {
  onStatusUpdate?: StatusUpdateCallback;
}

export interface GeminiAgentOpts {
  ctx?: ResponseContext;
  callTool?: ToolCall;
  updateStatus?: StatusUpdateCallback | undefined;
  generateConfig?: GenerateContentConfig | undefined;
  generateModel?: GenerateContentParameters['model'];
}

export interface GeminiAgentResponse extends Pick<GenerateContentResponse, 'candidates' | 'modelVersion'> {
  text?: string | undefined;
  executableCode?: string | undefined;
  codeExecutionResult?: string | undefined;
}

export type NormalizedResponse<T = unknown> = { output: T; error?: never } | { error: string; output?: never };

export interface StandardizedFunctionResponse<T = unknown> extends Omit<FunctionResponse, 'response'> {
  response: NormalizedResponse<T>;
}

export interface GeneralFunctionSchema extends Omit<
  FunctionDeclaration,
  'name' | 'parametersJsonSchema' | 'responseJsonSchema'
> {
  name: string;
  parametersJsonSchema?: JSONSchema;
  responseJsonSchema?: JSONSchema;
}

export type OpenAiClientParams = Omit<ChatCompletionCreateParamsBase, 'messages' | 'n' | 'stream'>;
