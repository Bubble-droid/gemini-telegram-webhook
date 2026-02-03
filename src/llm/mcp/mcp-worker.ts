import type { GenerateContentResponse } from '@google/genai';
import { FunctionCallingConfigMode, type GenerateContentConfig } from '@google/genai';
import type { GeminiApiOptions, StandardizedFunctionResponse } from '@llm/types/agent';
import { logger } from '@shared/core/logger';
import type { McpClient } from './mcp-client';

type AgentWorker = (mcp: McpClient, opts: GeminiApiOptions) => Promise<GenerateContentResponse>;

export const performMcpWork = async (
  client: McpClient,
  config: GenerateContentConfig,
  agentWorker: AgentWorker,
): Promise<StandardizedFunctionResponse<string>['response']> => {
  try {
    await client.connect();
    const mcpTools = client.getTools();
    const geminiApiOptions: GeminiApiOptions = {
      genConfig: {
        ...config,
        tools: [{ functionDeclarations: mcpTools }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        automaticFunctionCalling: { disable: true },
      },
    };
    const result = await agentWorker(client, geminiApiOptions);
    return { output: result.text ?? 'Task completed via tools (no summary text).' };
  } catch (err) {
    logger.error(`[McpWorker] Task failed`, { err });
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    await client.disconnect();
  }
};
