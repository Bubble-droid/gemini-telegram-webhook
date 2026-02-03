import type { FUNCTION_TOOLS } from '@configs/function-tools';
import type { InferSchema } from '@shared/types/schema';
import type { BaseToolResult } from './agent';

export type ToolName = (typeof FUNCTION_TOOLS)[number]['name'];

type GetToolDef<TName extends ToolName> = Extract<(typeof FUNCTION_TOOLS)[number], { name: TName }>;

type InferToolArgs<TName extends ToolName> =
  GetToolDef<TName> extends { parametersJsonSchema: infer TParams } ? InferSchema<TParams> : undefined;

type ToolCaller<TName extends ToolName> = (args: InferToolArgs<TName>) => BaseToolResult<string>;

export type ToolCallers = {
  [K in ToolName]: ToolCaller<K>;
};
