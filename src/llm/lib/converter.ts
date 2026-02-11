import type { Part } from '@google/genai';
import type { GeneralFunctionSchema } from '@llm/types/agent.js';
import type { ChatCompletionContentPart, FunctionParameters } from 'openai/resources';
import type { FunctionTool } from 'openai/resources/beta.js';

export const convertGeminiToolToOpenAiTool = (tool: GeneralFunctionSchema): FunctionTool => {
  return {
    type: 'function',
    function: {
      name: tool.name,
      ...(tool.description && { description: tool.description }),
      parameters: tool.parametersJsonSchema as FunctionParameters,
      strict: true,
    },
  };
};

export const convertGeminiPartToOpenAiContent = (part: Part): ChatCompletionContentPart => {
  if (part.inlineData) {
    return {
      type: 'image_url',
      image_url: {
        url: `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`,
      },
    };
  }
  return {
    type: 'text',
    text: part.text ?? "what's in this image?",
  };
};
