import { longTermMemory } from '@data/long-term-memory.js';
import { FunctionCallingConfigMode, type Content } from '@google/genai';
import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { OpenAiAgent } from '@llm/agent/openai-agent.js';
import { mergeSystemPrompt } from '@llm/lib/helper.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { ToolCallerInjectedDeps } from '@llm/types/tool.js';
import { logger } from '@shared/core/logger.js';
import { addCitations } from '@shared/utils/citation-generate.js';
import { makeFile, ms } from '@shared/utils/helpers.js';

interface ToolCallerDeps {
  geminiApiAgent: GeminiAgent;
  geminiCliAgent: GeminiAgent;
  gemmaAgent: GeminiAgent;
  openAiAgent: OpenAiAgent;
  mcpClient: McpClient;
}

export const createToolCaller = (deps: ToolCallerDeps): ToolCallerInjectedDeps => {
  const { geminiApiAgent, mcpClient } = deps;
  // const multimodalModelRotator = new ListRotator(shuffleArray(GEMINI_MULTIMODAL_MODELS));

  return (ctx, onStatusUpdate) => ({
    file_search: async (args) => {
      const { prompt, file_search_stores, system_prompt } = args;
      if (!file_search_stores.length) {
        logger.warn(`No file stores provided.`);
        return { response: { error: 'No file stores provided.' } };
      }
      if (
        file_search_stores.includes('documents/gui-for-cores') &&
        !file_search_stores.includes('sourcecode/plugin-hub')
      ) {
        file_search_stores.push('sourcecode/plugin-hub');
      }
      if (!file_search_stores.includes('documents/gui-for-cores')) {
        file_search_stores.push('documents/gui-for-cores');
      }
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ fileSearch: { fileSearchStoreNames: file_search_stores } }],
        },
      });
      return {
        response: {
          output: {
            queryResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          },
        },
      };
    },

    web_search: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ googleSearch: {} }],
        },
      });
      return {
        response: {
          output: {
            queryResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          },
        },
      };
    },

    web_fetch: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0.4,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ urlContext: {} }],
        },
      });
      return {
        response: {
          output: {
            fetchResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          },
        },
      };
    },

    delegate_to_agent: async (args) => {
      const { agent_name, objective, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        callTool: (name, args) => {
          return mcpClient.callTool(name, args);
        },
        generateConfig: {
          temperature: 0.4,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ functionDeclarations: mcpClient.getTools(agent_name.toLowerCase()) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          automaticFunctionCalling: { disable: true },
        },
      });
      return { response: { output: result.text! } };
    },

    analyze_youtube_video: async (args) => {
      const { video_url, prompt, system_prompt } = args;
      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: video_url,
              },
            },
            { text: prompt },
          ],
        },
      ];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
        },
      });
      return { response: { output: result.text! } };
    },

    /*  generate_image: async (args) => {
      const { message_id, prompt, aspect_ratio, image_size, system_prompt } = args;
      const model = multimodalModelRotator.next();
      const contents: Content[] = [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ];
      const result = await geminiCliAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspect_ratio,
            ...(model.startsWith('gemini-3') && image_size && { imageSize: image_size }),
          },
          ...(model.startsWith('gemini-3') && { tools: [{ googleSearch: {} }] }),
        },
        generateModel: 'gemini-2.5-flash-image',
      });
      const imageData = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!imageData) {
        return { response: { error: 'Failed to generate image, missing valid image data.' } };
      }
      const buffer = Buffer.from(imageData.inlineData!.data!, 'base64');
      const photo = makeFile(buffer, `generated-by-${model}.png`, imageData.inlineData?.mimeType ?? 'image/png');
      const res = await ctx.api.sendPhoto(ctx.chat.id, photo, {
        deleteAfterMs: ms['1d'],
        replyToMessageId: message_id,
      });
      if (!res.ok) {
        return { response: { error: `Failed to send image. ${res.error}` } };
      }
      return {
        response: { output: 'Image generated successfully.', ...(result.text && { result: result.text }) },
        parts: [imageData],
      };
    }, */

    code_execution: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          temperature: 0,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ codeExecution: {} }],
        },
      });
      return { response: { output: addCitations(result) } };
    },

    reply_file: async (args) => {
      const { message_id, content, name, type, describe } = args;
      const file = makeFile(content, name, type);
      const result = await ctx.api.sendDocument(ctx.chat.id, file, {
        ...(describe && { caption: describe }),
        deleteAfterMs: ms['1d'],
        replyToMessageId: message_id,
      });
      return { response: { output: JSON.stringify(result) } };
    },

    publish_post: async (args) => {
      const { title, content } = args;
      const page = await ctx.api.publishTelegraphPost(title, content);
      return { response: { output: JSON.stringify(page) } };
    },

    reaction_to_message: async (args) => {
      const { message_id, reaction } = args;
      const result = await ctx.api.setMessageReaction(ctx.chat.id, message_id, reaction);
      return { response: { output: JSON.stringify(result) } };
    },

    save_memory: (args) => {
      const { user_id, fact } = args;
      return { response: { output: longTermMemory.addMemory(user_id ?? ctx.chat.id, fact) } };
    },

    discover_mcp_servers: async () => {
      await mcpClient.discoverMcpServers();
      const mcpServers = mcpClient.getLoadedServers();
      return { response: { output: JSON.stringify(mcpServers) } };
    },
  });
};
