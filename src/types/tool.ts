// src/types/tool.ts

import type { FileStores, functionDeclarations } from '@/configs';
import type { CallBackFns, CommonToolResult } from './agent';
import type { InferSchema } from './schema';

type FileStoreType = keyof typeof FileStores;

export type FileStoreName = {
  [K in FileStoreType]: `${K}/${(typeof FileStores)[K][number]}`;
}[FileStoreType];

export type ToolName = (typeof functionDeclarations)[number]['name'];

type GetToolDef<TName extends ToolName> = Extract<(typeof functionDeclarations)[number], { name: TName }>;

export type InferToolArgs<TName extends ToolName> =
  GetToolDef<TName> extends { parameters: infer TParams } ? InferSchema<TParams> : undefined;

type ToolExecutorFn<TName extends ToolName> = (
  args: InferToolArgs<TName>,
  callBacks?: CallBackFns,
) => CommonToolResult<string>;

export type ToolExecutorsMap = {
  [K in ToolName]: ToolExecutorFn<K>;
};
