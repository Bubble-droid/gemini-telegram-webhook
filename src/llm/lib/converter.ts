import type { Content } from '@google/genai';
import type { GeneralFunctionSchema } from '@llm/types/agent.js';
import type { FunctionParameters } from 'openai/resources';
import type { ChatCompletionContentPart, ChatCompletionMessage, ChatCompletionMessageParam } from 'openai/resources.js';
import type { FunctionTool } from 'openai/resources/beta.js';

export const convertGeminiFunctionsToOpenAi = (functions: GeneralFunctionSchema[]): FunctionTool[] => {
  return functions.map((f) => ({
    type: 'function',
    function: {
      name: f.name,
      ...(f.description && { description: f.description }),
      parameters: f.parametersJsonSchema as FunctionParameters,
      strict: true,
    },
  }));
};

export const convertGeminiContentsToOpenAiMessages = (contents: Content[]): ChatCompletionMessageParam[] => {
  return contents.map((c): ChatCompletionMessageParam => {
    const { role, parts } = c;
    const chatRole = role === 'user' ? 'user' : 'assistant';
    return {
      role: chatRole as 'user',
      content: parts!.flatMap((p): ChatCompletionContentPart[] => {
        if (p.inlineData) {
          return [
            {
              type: 'image_url',
              image_url: {
                url: `data:${p.inlineData.mimeType ?? 'image/jpeg'};base64,${p.inlineData.data}`,
              },
            },
          ];
        } else if (p.text) {
          return [
            {
              type: 'text',
              text: p.text,
            },
          ];
        }
        return [];
      }),
    };
  });
};

export const convertChatCompletionMessageToGeminiContent = (message: ChatCompletionMessage): Content => {
  return {
    role: 'model',
    parts: [
      {
        text: message.content!,
      },
    ],
  };
};
