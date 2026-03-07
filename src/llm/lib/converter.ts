import type { Content } from '@google/genai';
import type { GeneralFunctionSchema } from '@llm/types/agent.js';
import type { ChatCompletionContentPart, ChatCompletionMessageParam, FunctionParameters } from 'openai/resources.js';
import type { FunctionTool } from 'openai/resources/beta.js';

export const mappingGeminiToolsToOpenAi = (functions: GeneralFunctionSchema[]): FunctionTool[] => {
  return functions.map(
    (f): FunctionTool => ({
      type: 'function',
      function: {
        name: f.name,
        ...(f.description && { description: f.description }),
        ...(f.parametersJsonSchema && { parameters: f.parametersJsonSchema as FunctionParameters }),
        strict: true,
      },
    }),
  );
};

export const mappingGeminiContentsToOpenAiMessages = (contents: Content[]): ChatCompletionMessageParam[] => {
  return contents.map((c): ChatCompletionMessageParam => {
    const { role, parts } = c;
    const chatRole = role === 'user' ? 'user' : 'assistant';
    return {
      role: chatRole as 'user',
      content: parts!.flatMap((p): ChatCompletionContentPart[] => {
        if (p.inlineData?.mimeType?.startsWith('image/')) {
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
