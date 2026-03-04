import { Messages } from '@configs/messages.js';
import { type Content, type FunctionCall, type FunctionResponse, type Part } from '@google/genai';
import type { GeminiApiClient } from '@llm/client/gemini-api-client.js';
import { parseToolCalls } from '@llm/lib/tool-call-parser.js';
import type { GeminiAgentOpts, GeminiAgentResponse, StandardizedFunctionResponse } from '@llm/types/agent.js';
import type { ToolName } from '@llm/types/tool.js';
import { THOUGHT_SIGNATURE_PLACEHOLDER } from '@shared/core/constants.js';
import { AgentError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import { delay, ms } from '@shared/utils/helpers.js';

export const MAX_AGENT_ROUNDS = 16;

export const FORCE_BLOCKING_TOOLS: string[] = ['seek_clarification'] satisfies ToolName[];

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
  updateStatus?: GeminiAgentOpts['updateStatus'],
): Promise<Pick<Part, 'functionResponse'>> => {
  const { id, name, args } = call;
  if (!name) {
    return createToolResponse({ response: { error: 'Tool name not provided' } }, 'N/A', id);
  }
  logger.info(`Gemini Agent Calling tool:`, { name, args });
  try {
    const result = await callTool(name, args);
    return createToolResponse(result, name, id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`Gemini Agent Tool execution error: ${name}`, { err });
    await updateStatus?.(`Agent Tool ${name} execution error: ${errorMsg}`);
    return createToolResponse({ response: { error: errorMsg } }, name, id);
  }
};

export class GeminiAgent {
  private readonly maxRounds = MAX_AGENT_ROUNDS;

  constructor(private readonly client: GeminiApiClient) {}

  public async run(contents: Content[], opts: GeminiAgentOpts): Promise<GeminiAgentResponse> {
    const { ctx, updateStatus, callTool, generateConfig, generateModel } = opts;
    const agentContents = [...contents];
    let round = 0;
    let agentResponse: GeminiAgentResponse = {};
    let functionCalls: FunctionCall[] | undefined;
    do {
      if (round >= this.maxRounds) {
        throw new AgentError(`Agent exceeded maximum rounds (${this.maxRounds})`);
      }
      logger.debug(`[GeminiAgent] Round ${round++} started.`);

      const response = await this.client.generateContent(agentContents, generateConfig, generateModel);

      if (!response.candidates?.[0]?.content) {
        throw new AgentError('Model returned empty or invalid content.');
      }

      if (ctx) {
        for (const part of response.candidates[0].content.parts!) {
          if (part.text) {
            const chunks = markdownToMarkdownV2Chunks(
              part.text.replace(/<cot>[\s\S]*?<\/cot>|<tool_calls>[\s\S]*?<\/tool_calls>/gi, '').trim(),
              300,
            );
            for (const chunk of chunks) {
              await ctx.replyWithChatAction('typing').catch((err: unknown) => {
                logger.warn(`Send chat action failed.`, { err });
              });
              await ctx
                .send(chunk, {
                  parse_mode: 'MarkdownV2',
                  deleteAfterMs: ms['1d'],
                })
                .catch(async (err: unknown) => {
                  logger.warn(`Send message failed.`, { err });
                  await updateStatus?.(
                    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err),
                  );
                });
              await delay(500);
            }
          }
        }
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

      agentResponse = {
        candidates: response.candidates,
        modelVersion: response.modelVersion!,
        text: response.text,
        executableCode: response.executableCode,
        codeExecutionResult: response.codeExecutionResult,
      };

      functionCalls = response.functionCalls;
      if (!functionCalls?.length) {
        try {
          functionCalls = parseToolCalls(response.text!);
        } catch {
          break;
        }
      }

      if (!callTool) {
        throw new AgentError('Model requested tool execution but no tool executor provided.');
      }

      logger.debug(`Model requested ${functionCalls.length} tool calls.`);

      await updateStatus?.(
        `<tool_calls>\n${functionCalls.map((c) => `🔧 Calling ${c.name}\nParameters: ${JSON.stringify(c.args).slice(0, 50)}...`).join('\n\n')}\n</tool_calls>`.trim(),
      );

      const toolResults = await Promise.all(
        functionCalls.map(async (call): Promise<Part> => {
          const result = await handleToolCall(call, callTool);
          if (generateModel?.startsWith('gemma-')) {
            return {
              text: JSON.stringify(result),
            };
          } else {
            return result;
          }
        }),
      );

      if (functionCalls.some((call) => !!call.args?.['blocking'] || FORCE_BLOCKING_TOOLS.includes(call.name ?? ''))) {
        logger.info(`Model calling blocking response tools.`);
        agentResponse.candidates![0]!.content = agentContents.at(-1)!;
        break;
      }

      agentContents.push({ role: 'user', parts: toolResults });

      await delay(ms.sec(3));

      await updateStatus?.(Messages.thinking);
    } while (functionCalls.length > 0);

    logger.info(`[GeminiAgent] Task completed`, { rounds: round + 1 });

    await updateStatus?.(`Response successful. *Reply by ${agentResponse.modelVersion}*`);

    return agentResponse;
  }
}
