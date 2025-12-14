import { chatAgent, logger, type GeminiApiOptions, type MCPClient } from '@/services';
import type { CallBackFns } from '@/types';
import { FunctionCallingConfigMode, type Content, type GenerateContentConfig } from '@google/genai';

/**
 * @class MCPWorker
 * @description 负责管理一次 MCP 子任务的完整生命周期。
 *              连接 -> 执行子 Agent -> 断开连接。
 */
export class MCPWorker {
  /**
   * 执行特定的 MCP 任务
   * @param taskPrompt 用户任务描述
   * @param systemPrompt Worker 的人设
   * @param parentOnToolStart 来自上层的 UI 回调函数 (关键)
   */
  public async performTask(
    client: MCPClient,
    taskPrompt: string,
    systemPrompt: string,
    { onToolStart: parentOnToolStart, onRetry }: CallBackFns,
  ): Promise<string> {
    try {
      // 1. 请求连接 (Client 内部处理引用计数)
      await client.connect();

      // 2. 获取工具 (此时已连接，可以获取)
      const mcpTools = client.getTools();

      // 3. 定义执行器 (闭包持有 client)
      const workerToolExecutor = async (
        name: string,
        args: Record<string, unknown>,
      ): Promise<Record<string, unknown> | { error: string }> => {
        // [递归 UI 更新]
        // 当 Worker 内部的 Agent 调用 MCP 工具时，依然更新最外层的 Telegram 消息
        if (parentOnToolStart) {
          parentOnToolStart(name);
        }

        // 调用 MCP SDK
        const results = await client.executeTools([{ name, args }]);

        // 解析 executeTools 返回的 Part[]
        if (results.length > 0 && results[0].functionResponse?.response) {
          return results[0].functionResponse.response;
        }
        return { error: 'No response from MCP tool' };
      };

      const contents: Content[] = [{ role: 'user', parts: [{ text: taskPrompt }] }];

      const config: GenerateContentConfig = {
        temperature: 1,
        thinkingConfig: { thinkingBudget: -1 },
        systemInstruction: [{ text: systemPrompt }],
        tools: mcpTools,
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        automaticFunctionCalling: { disable: true },
      };

      const geminiApiOptions: GeminiApiOptions = {
        genConfig: config,
        onRetry,
      };

      // 4. 使用全局单例 ChatAgent
      const result = await chatAgent.chat(contents, {
        maxRounds: 5,
        geminiApiOptions,
        toolExecutor: workerToolExecutor,
        onToolStart: parentOnToolStart, // 将回调传给子 Agent 逻辑
      });

      // 7. 返回结果文本
      return result.text || 'Task completed via tools (no summary text).';
    } catch (err) {
      logger.error(`[McpWorker] Task failed`, { err });
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      // 5. 释放连接 (计数器 -1，归零时断开)
      await client.disconnect();
    }
  }
}

export const mcpWorker = new MCPWorker();
