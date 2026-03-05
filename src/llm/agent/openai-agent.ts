import type { FunctionCall } from '@google/genai';
import type { OpenAiClient } from '@llm/client/openai-client.js';
import { parseToolCalls } from '@llm/lib/tool-call-parser.js';
import type { OpenAiClientParams, StatusUpdateCallback, ToolCall } from '@llm/types/agent.js';
import { AgentError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import type { Recordable } from '@shared/types/common.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources';
import type { ChatCompletion, ChatCompletionContentPart } from 'openai/resources.js';
import { FORCE_BLOCKING_TOOLS, MAX_AGENT_ROUNDS } from './gemini-agent.js';

interface OpenAiAgentOpts {
  ctx?: ResponseContext;
  callTool?: ToolCall;
  updateStatus?: StatusUpdateCallback | undefined;
  params?: OpenAiClientParams | undefined;
}

const createToolResponse = (id: string, content: unknown): ChatCompletionToolMessageParam => {
  return {
    role: 'tool',
    tool_call_id: id,
    content: [
      {
        type: 'text',
        text: typeof content !== 'string' ? JSON.stringify(content) : content,
      },
    ],
  };
};

const simplifyMessageContent = (content: ChatCompletionContentPart): ChatCompletionContentPart => {
  if (content.type === 'image_url') {
    return {
      ...content,
      image_url: {
        url: `${content.image_url.url.split(',')[0]}[BASE64_DATA_MASKED]`,
      },
    };
  }
  return content;
};

export class OpenAiAgent {
  private readonly maxRounds = MAX_AGENT_ROUNDS;

  constructor(private readonly client: OpenAiClient) {}

  public async run(messages: ChatCompletionMessageParam[], opts: OpenAiAgentOpts): Promise<ChatCompletionMessage> {
    const { ctx, updateStatus, callTool, params } = opts;
    const agentMsgs = [...messages];
    let round = 0;
    let response: ChatCompletion;
    let toolCalls: FunctionCall[] | undefined;
    do {
      if (round >= this.maxRounds) {
        throw new AgentError(`Agent exceeded maximum rounds (${this.maxRounds})`);
      }
      logger.debug(`OpenAI Agent Round ${round++} started.`);
      logger.trace(`OpenAI Agent request messages:`, {
        requestMessage: agentMsgs.map((m): ChatCompletionMessageParam => {
          if (m.role === 'user' && Array.isArray(m.content)) {
            return {
              ...m,
              content: m.content.map(simplifyMessageContent),
            };
          }
          return m;
        }),
      });
      response = await this.client.chatCompletion(agentMsgs, params);
      const completionMessage = response.choices[0]?.message;
      logger.trace(`OpenAI Agent completion response:`, { ...response });

      if (!completionMessage?.content?.length && !completionMessage?.tool_calls?.length) {
        throw new AgentError('OpenAI Agent response is empty');
      }

      if (ctx && completionMessage.content) {
        const chunks = markdownToMarkdownV2Chunks(
          completionMessage.content.replace(/<cot>[\s\S]*?<\/cot>|<tool_calls>[\s\S]*?<\/tool_calls>/gi, '').trim(),
          300,
        );
        for (const chunk of chunks) {
          try {
            await ctx.replyWithChatAction('typing');
            await ctx.reply(chunk, {
              parse_mode: 'MarkdownV2',
              deleteAfterMs: ms['1d'],
            });
          } catch (err) {
            await updateStatus?.(err instanceof Error ? err.message : typeof err === 'string' ? err : String(err));
          }
          await delay(1000);
        }
      }

      toolCalls = completionMessage.tool_calls?.flatMap((call): FunctionCall[] => {
        if (call.type !== 'function') return [];
        const { name, arguments: args } = call.function;
        return [
          {
            id: call.id,
            args: JSON.parse(args) as Recordable,
            name,
          },
        ];
      });

      if (!toolCalls?.length) {
        try {
          toolCalls = parseToolCalls(completionMessage.content!);
        } catch {
          break;
        }
      }

      agentMsgs.push(completionMessage);

      if (!callTool) {
        throw new AgentError('Model requested tool calling but no tool executor provided.');
      }

      logger.debug(`Model requested ${toolCalls.length} tool calls.`);

      await updateStatus?.(
        `<tool_calls>\n${toolCalls.map((c) => `🔧 Calling ${c.name}\nParameters: ${JSON.stringify(c.args).slice(0, 200)}...`).join('\n\n')}\n</tool_calls>`.trim(),
      );

      const toolResults = await Promise.all(
        toolCalls.map(async ({ id, name, args }): Promise<ChatCompletionMessageParam> => {
          if (!name) {
            return createToolResponse(id ?? '', 'Tool name not provided');
          }
          logger.info(`OpenAI Agent Calling tool:`, { name, args });
          let response: unknown;
          try {
            const result = await callTool(name, args);
            response = result.response;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            response = { error: errMsg };
          }
          if (!id) {
            return {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool_response: {
                      name,
                      response: response,
                    },
                  }),
                },
              ],
            };
          }
          return createToolResponse(id, response);
        }),
      );

      if (toolCalls.some((call) => !!call.args?.['blocking'] || FORCE_BLOCKING_TOOLS.includes(call.name ?? ''))) {
        logger.info(`Model calling blocking response tools.`);
        break;
      }

      agentMsgs.push(...toolResults);

      await delay(ms.sec(3));
    } while (toolCalls.length > 0);

    return response.choices[0]!.message;
  }
}
