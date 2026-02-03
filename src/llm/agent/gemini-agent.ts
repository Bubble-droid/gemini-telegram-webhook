import { BotMessages } from '@configs/bot-messages';
import type { Content, FunctionCall, FunctionResponse, GenerateContentResponse, Part } from '@google/genai';
import type { GeminiApiClient } from '@llm/client/gemini-api-client';
import type { ChatAgentOptions, NormalizedResponse } from '@llm/types/agent';
import { CONFIG } from '@shared/core/config';
import { AgentError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import { delay, ms } from '@shared/utils/helpers';

const createToolResponse = (
  res: NormalizedResponse,
  name: NonNullable<FunctionResponse['name']>,
  id: FunctionResponse['id'],
): Pick<Part, 'functionResponse'> => {
  return {
    functionResponse: {
      ...(id && { id }),
      name,
      response: res,
    },
  };
};

const handleToolCall = async (
  call: FunctionCall,
  callTool: NonNullable<ChatAgentOptions['callTool']>,
  responseText: string | undefined,
  onStatusUpdate?: ChatAgentOptions['onStatusUpdate'],
): Promise<Pick<Part, 'functionResponse'>> => {
  const { id, name, args } = call;

  if (!name) {
    return createToolResponse({ error: 'Tool name not provided' }, 'N/A', id);
  }

  logger.info(`[ChatAgent] Executing tool: ${name}`, { args });

  if (onStatusUpdate) {
    const statusText = `${responseText?.trim() ?? ''}\n\n🔧 Calling \`${name}\`...`.trim();
    await onStatusUpdate(statusText);
  }

  try {
    const result = await callTool(name, args);
    return createToolResponse(result.response, name, id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`[ChatAgent] Tool execution error: ${name}`, { err });
    return createToolResponse({ error: errorMsg }, name, id);
  }
};

export class GeminiAgent {
  private client: GeminiApiClient;

  constructor(client: GeminiApiClient) {
    this.client = client;
  }

  public async run(contents: Content[], options: ChatAgentOptions): Promise<GenerateContentResponse> {
    const { maxRounds = CONFIG.MAX_AGENT_ROUNDS, geminiApiOptions, callTool, onStatusUpdate } = options;
    const agentContents = [...contents];
    let round = 0;
    let response: GenerateContentResponse;
    do {
      if (round >= maxRounds) {
        throw new AgentError(`Agent exceeded maximum rounds (${maxRounds})`);
      }
      logger.debug(`[ChatAgent] Round ${round++} started.`);

      response = await this.client.generateContent(agentContents, geminiApiOptions);

      agentContents.push(response.candidates![0]!.content!);

      const { functionCalls } = response;
      if (!functionCalls?.length) {
        break;
      }

      if (!callTool) {
        throw new AgentError('Model requested tool execution but no toolExecutor provided.');
      }

      logger.debug(`Model requested ${functionCalls.length} tool calls.`);

      const toolResults = await Promise.all(
        functionCalls.map((call) => handleToolCall(call, callTool, response.text, onStatusUpdate)),
      );

      agentContents.push({ role: 'user', parts: toolResults });

      await delay(ms.sec(3));

      await onStatusUpdate(BotMessages.thinking);
    } while (response.functionCalls);

    logger.info(`[ChatAgent] Task completed`, { rounds: round + 1 });
    return response;
  }
}
