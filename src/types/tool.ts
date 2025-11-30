// src/types/tool_executors.d.ts

import type { OnToolStartCallback, RetryCallback } from '@/services';

type ToolResult<T = unknown> = { result: T };

export interface ToolArgs {
  prompt: string;
}

export interface CallBackFns {
  onToolStart?: OnToolStartCallback;
  onRetry?: RetryCallback;
}

type ToolExecutorFn<Args extends ToolArgs = ToolArgs, ReturnData = unknown> = (
  args?: Args,
  CallBacks?: CallBackFns,
) => ToolResult<ReturnData> | Promise<ToolResult<ReturnData>>;

export interface ToolExecutorsMap {
  [toolName: string]: ToolExecutorFn;
}
