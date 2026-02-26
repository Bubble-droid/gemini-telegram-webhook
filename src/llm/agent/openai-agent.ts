import type { FunctionCall } from '@google/genai';
import type { OpenAiClient } from '@llm/client/openai-client.js';
import { parseToolCalls } from '@llm/lib/tool-call-parse.js';
import type { OpenAiClientParams, ToolCall } from '@llm/types/agent.js';
import { AgentError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources';
import type { ChatCompletionContentPart } from 'openai/resources.js';

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
  private readonly client: OpenAiClient;

  constructor(client: OpenAiClient) {
    this.client = client;
  }

  public async run(
    messages: ChatCompletionMessageParam[],
    opts: { params?: OpenAiClientParams; callTool: ToolCall },
  ): Promise<ChatCompletionMessage> {
    const { params, callTool } = opts;
    const agentMsgs = [...messages];
    let completionMessage: ChatCompletionMessage | undefined;
    let toolCalls: FunctionCall[] | undefined;
    do {
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
      const res = await this.client.chatCompletion(agentMsgs, params);
      completionMessage = res.choices[0]?.message;
      logger.trace(`OpenAI Agent completion response:`, { completion: res });

      if (!completionMessage?.content?.length && !completionMessage?.tool_calls?.length) {
        throw new AgentError('OpenAI Agent response is empty');
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
      agentMsgs.push(...toolResults);

      await delay(ms.sec(3));
    } while (toolCalls.length > 0);

    return completionMessage;
  }
}
