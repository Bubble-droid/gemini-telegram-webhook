import { logger } from '@/services';
import type { CallBackFns, GeminiApiOptions, StandardizedFunctionResponse, ToolExecutorFn } from '@/types';
import { FunctionCallingConfigMode, ThinkingLevel, type Content, type GenerateContentConfig } from '@google/genai';
import { chatAgent } from './ChatAgent';
import type { MCPClient } from './MCPClient';

/**
 * @description 负责管理一次 MCP 子任务的完整生命周期。
 *              连接 -> 执行子 Agent -> 断开连接。
 */
export const performTask = async (
  client: MCPClient,
  taskPrompt: string,
  systemPrompt: string,
  { onStatusUpdate }: CallBackFns,
): Promise<StandardizedFunctionResponse<string>['response']> => {
  try {
    // 1. 请求连接 (Client 内部处理引用计数)
    await client.connect();

    // 2. 获取工具 (此时已连接，可以获取)
    const mcpTools = client.getTools();

    // 3. 定义执行器 (闭包持有 client)
    const workerToolExecutor: ToolExecutorFn = (name, args) => {
      // 调用 MCP SDK
      return client.executeTools(name, args);
    };

    const contents: Content[] = [{ role: 'user', parts: [{ text: taskPrompt }] }];

    const config: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools: mcpTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      automaticFunctionCalling: { disable: true },
    };

    const geminiApiOptions: GeminiApiOptions = {
      genConfig: config,
      ...(onStatusUpdate && { onStatusUpdate }),
    };

    const result = await chatAgent(contents, {
      maxRounds: 8,
      geminiApiOptions,
      toolExecutor: workerToolExecutor,
      ...(onStatusUpdate && { onStatusUpdate }),
    });

    // 7. 返回结果文本
    return { output: result.text ?? 'Task completed via tools (no summary text).' };
  } catch (err) {
    logger.error(`[McpWorker] Task failed`, { err });
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    // 5. 释放连接 (计数器 -1，归零时断开)
    await client.disconnect();
  }
};
