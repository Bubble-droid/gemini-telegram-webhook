import type { FunctionCall } from '@google/genai';
import type { OpenAiClient } from '@llm/client/openai-client.js';
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
  private client: OpenAiClient;
  private callTool: ToolCall;

  constructor(client: OpenAiClient, callTool: ToolCall) {
    this.client = client;
    this.callTool = callTool;
  }

  public async run(
    messages: ChatCompletionMessageParam[],
    params?: OpenAiClientParams,
  ): Promise<ChatCompletionMessage> {
    const agentMsgs = [...messages];
    let completionMessage: ChatCompletionMessage | undefined;
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
      const res = await this.client.chatCompletion(messages, params);
      completionMessage = res.choices[0]?.message;
      logger.trace(`OpenAI Agent completion response:`, { completion: res });

      if (!completionMessage) {
        throw new AgentError('OpenAI Agent response is empty');
      }

      const toolCalls = completionMessage.tool_calls?.flatMap(
        (call): Required<Pick<FunctionCall, 'id' | 'name' | 'args'>>[] => {
          if (call.type !== 'function') return [];
          const { name, arguments: args } = call.function;
          return [
            {
              id: call.id,
              args: JSON.parse(args) as Recordable,
              name,
            },
          ];
        },
      );

      if (!toolCalls?.length) {
        break;
      }

      agentMsgs.push(completionMessage);

      const toolResults = await Promise.all(
        toolCalls.map(async ({ id, name, args }): Promise<ChatCompletionToolMessageParam> => {
          if (!name) {
            return createToolResponse(id, 'Tool name not provided');
          }
          try {
            const result = await this.callTool(name, args);
            return createToolResponse(id, result.response);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            return createToolResponse(id, { error: errMsg });
          }
        }),
      );
      agentMsgs.push(...toolResults);

      await delay(ms.sec(3));
    } while (completionMessage.tool_calls?.some((call) => call.type === 'function'));

    return completionMessage;
  }
}
