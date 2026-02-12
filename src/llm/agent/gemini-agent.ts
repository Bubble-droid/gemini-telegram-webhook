import { BotMessages } from '@configs/bot-messages.js';
import type { Content, FunctionCall, FunctionResponse, GenerateContentResponse, Part } from '@google/genai';
import type { GeminiApiClient } from '@llm/client/gemini-api-client.js';
import type { GeminiAgentOpts, StandardizedFunctionResponse } from '@llm/types/agent.js';
import { THOUGHT_SIGNATURE_PLACEHOLDER } from '@shared/core/constants.js';
import { AgentError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { delay, ms } from '@shared/utils/helpers.js';

const MAX_AGENT_ROUNDS = 16;

const createToolResponse = (
  res: StandardizedFunctionResponse,
  name: NonNullable<FunctionResponse['name']>,
  id: FunctionResponse['id'],
): Pick<Part, 'functionResponse'> => {
  return {
    functionResponse: {
      ...(id && { id }),
      name,
      ...res,
    },
  };
};

const handleToolCall = async (
  call: FunctionCall,
  callTool: NonNullable<GeminiAgentOpts['callTool']>,
  responseText: string | undefined,
  onStatusUpdate?: GeminiAgentOpts['onStatusUpdate'],
): Promise<Pick<Part, 'functionResponse'>> => {
  const { id, name, args } = call;

  if (!name) {
    return createToolResponse({ response: { error: 'Tool name not provided' } }, 'N/A', id);
  }

  logger.info(`[ChatAgent] Executing tool: ${name}`, { args });

  if (onStatusUpdate) {
    const statusText = `${responseText?.trim() ?? ''}\n\n🔧 Calling ${name}`.trim();
    await onStatusUpdate(statusText);
  }

  try {
    const result = await callTool(name, args);
    return createToolResponse(result, name, id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`[ChatAgent] Tool execution error: ${name}`, { err });
    return createToolResponse({ response: { error: errorMsg } }, name, id);
  }
};

export class GeminiAgent {
  private client: GeminiApiClient;

  constructor(client: GeminiApiClient) {
    this.client = client;
  }

  public async run(contents: Content[], opts: GeminiAgentOpts): Promise<GenerateContentResponse> {
    const { maxRounds = MAX_AGENT_ROUNDS, onStatusUpdate, callTool, generateConfig, generateModel } = opts;
    const agentContents = [...contents];
    let round = 0;
    let response: GenerateContentResponse;
    do {
      if (round >= maxRounds) {
        throw new AgentError(`Agent exceeded maximum rounds (${maxRounds})`);
      }
      logger.debug(`[GeminiAgent] Round ${round++} started.`);

      response = await this.client.generateContent(agentContents, generateConfig, generateModel);

      if (!response.candidates?.[0]?.content) {
        throw new AgentError('Model returned empty or invalid content.');
      }

      agentContents.push({
        role: 'model',
        parts: response.candidates[0].content.parts!.map((p) => {
          if (p.functionCall && !p.thoughtSignature?.length) {
            return {
              ...p,
              thoughtSignature: THOUGHT_SIGNATURE_PLACEHOLDER,
            };
          }
          return p;
        }),
      });

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

      await onStatusUpdate?.(BotMessages.thinking);
    } while (response.functionCalls);

    logger.info(`[GeminiAgent] Task completed`, { rounds: round + 1 });
    return response;
  }
}
