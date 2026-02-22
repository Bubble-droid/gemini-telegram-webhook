import { getFunctionTools } from '@configs/function-tools.js';
import type { InferSchema } from '@shared/types/schema.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { BaseToolResult, StatusUpdateCallback } from './agent.js';

const _FUNCTION_TOOLS = getFunctionTools([]);

export type ToolName = (typeof _FUNCTION_TOOLS)[number]['name'];

type GetToolDef<TName extends ToolName> = Extract<(typeof _FUNCTION_TOOLS)[number], { name: TName }>;

type InferToolArgs<TName extends ToolName> =
  GetToolDef<TName> extends { parametersJsonSchema: infer TParams } ? InferSchema<TParams> : undefined;

type ToolCaller<TName extends ToolName> = (args: InferToolArgs<TName>) => BaseToolResult;

export type ToolCallers = {
  [K in ToolName]: ToolCaller<K>;
};

export type ToolCallerInjectedDeps = (ctx: ResponseContext, onStatusUpdate?: StatusUpdateCallback) => ToolCallers;
