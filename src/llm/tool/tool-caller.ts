import { longTermMemory } from '@data/long-term-memory.js';
import { FunctionCallingConfigMode, type Content } from '@google/genai';
import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { ToolCallerInjectedDeps } from '@llm/types/tool.js';
import { logger } from '@shared/core/logger.js';
import { addCitations } from '@shared/utils/citation-generate.js';
import { makeFile, ms } from '@shared/utils/helpers.js';

interface ToolCallerDeps {
  geminiApiAgent: GeminiAgent;
  geminiCliAgent: GeminiAgent;
  mcpClient: McpClient;
}

export const createToolCaller = (deps: ToolCallerDeps): ToolCallerInjectedDeps => {
  const { geminiApiAgent, geminiCliAgent, mcpClient } = deps;

  return (ctx, onStatusUpdate) => ({
    file_search: async (args) => {
      const { prompt, file_search_stores, system_prompt } = args;
      if (!file_search_stores.length) {
        logger.warn(`No file stores provided.`);
        return { response: { error: 'No file stores provided.' } };
      }
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
          tools: [{ fileSearch: { fileSearchStoreNames: file_search_stores } }],
        },
      });
      return {
        response: {
          output: {
            queryResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          } as unknown as string,
        },
      };
    },

    web_search: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiCliAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
          tools: [{ googleSearch: {} }],
        },
      });
      return {
        response: {
          output: {
            queryResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          } as unknown as string,
        },
      };
    },

    web_fetch: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiCliAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
          tools: [{ urlContext: {} }],
        },
      });
      return {
        response: {
          output: {
            queryResults: addCitations(result),
            groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata),
          } as unknown as string,
        },
      };
    },

    delegate_to_agent: async (args) => {
      const { agent_name, objective, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
      const result = await geminiCliAgent.run(contents, {
        onStatusUpdate,
        callTool: (name, args) => {
          return mcpClient.callTool(name, args);
        },
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
          tools: [{ functionDeclarations: mcpClient.getTools(agent_name) }],
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
      const result = await geminiCliAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
        },
      });
      return { response: { output: result.text! } };
    },

    code_execution: async (args) => {
      const { prompt, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const result = await geminiApiAgent.run(contents, {
        onStatusUpdate,
        generateConfig: {
          systemInstruction: [{ text: system_prompt }],
          tools: [{ codeExecution: {} }],
        },
      });
      return { response: { output: addCitations(result) } };
    },

    reply_to_file: async (args) => {
      const { message_id, content, name, type } = args;
      const file = makeFile(content, name, type);
      const res = await ctx.api.sendDocument(ctx.chat.id, file, {
        deleteAfterMs: ms['1d'],
        replyToMessageId: message_id,
      });
      if (!res.ok) {
        return { response: { error: `Failed to send file. Error: ${res.error}` } };
      }
      return { response: { output: 'File sent successfully.' } };
    },

    set_message_reaction: async (args) => {
      const { message_id, reaction } = args;
      const res = await ctx.api.setMessageReaction(ctx.chat.id, message_id, reaction);
      if (!res.ok) {
        return { response: { error: `Failed to set message reaction. Error: ${res.error}` } };
      }
      return { response: { output: 'Message reaction set successfully.' } };
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
