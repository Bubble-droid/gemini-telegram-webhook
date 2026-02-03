import { longTermMemory } from '@data/long-term-memory';
import { promptStore } from '@data/prompt-store';
import type { Content, GenerateContentConfig } from '@google/genai';
import type { GeminiAgent } from '@llm/agent/gemini-agent';
import { McpClient } from '@llm/mcp/mcp-client';
import { performMcpWork } from '@llm/mcp/mcp-worker';
import type { StatusUpdateCallback } from '@llm/types/agent';
import type { ToolCallers } from '@llm/types/tool';
import { logger } from '@shared/core/logger';
import { addCitations } from '@shared/utils/citation-generate';
import { ms } from '@shared/utils/helpers';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api';

const githubClient = new McpClient('github-toolset');

export const createToolCaller = (
  bot: TelegramBotApi,
  geminiAgent: GeminiAgent,
  onStatusUpdate: StatusUpdateCallback,
): ToolCallers => ({
  file_search: async (args) => {
    const { prompt, fileStores } = args;
    if (!fileStores.length) {
      logger.warn(`No file stores provided.`);
      return { response: { error: 'No file stores provided.' } };
    }
    const systemPrompt = promptStore.get('file-search');
    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const config: GenerateContentConfig = {
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ fileSearch: { fileSearchStoreNames: fileStores } }],
    };
    const result = await geminiAgent.run(contents, {
      onStatusUpdate,
      geminiApiOptions: {
        genConfig: config,
      },
    });
    return {
      response: {
        output: {
          queryResults: addCitations(result),
          groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata?.groundingChunks),
        } as unknown as string,
      },
    };
  },

  call_github_tool: async (args) => {
    logger.info('[Tool] Spawning GitHub Worker...');
    const systemPrompt = promptStore.get('github-toolset');
    const config: GenerateContentConfig = {
      systemInstruction: [{ text: systemPrompt }],
    };
    const contents: Content[] = [{ role: 'user', parts: [{ text: args.prompt }] }];
    const result = await performMcpWork(githubClient, config, (mcp, opts) => {
      return geminiAgent.run(contents, {
        geminiApiOptions: opts,
        callTool: (name, args) => {
          return mcp.callTool(name, args);
        },
        onStatusUpdate,
      });
    });
    return { response: result };
  },

  web_research: async (args) => {
    const { prompt } = args;
    const systemPrompt = promptStore.get('builtin-tools');
    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const config: GenerateContentConfig = {
      systemInstruction: [{ text: systemPrompt }],
      tools: [
        {
          googleSearch: {},
        },
        { urlContext: {} },
      ],
    };
    const result = await geminiAgent.run(contents, {
      onStatusUpdate,
      geminiApiOptions: {
        genConfig: config,
      },
    });
    return {
      response: {
        output: {
          queryResults: addCitations(result),
          groundingMetadata: JSON.stringify(result.candidates?.[0]?.groundingMetadata?.groundingChunks),
        } as unknown as string,
      },
    };
  },

  code_interpreter: async (args) => {
    const { prompt } = args;
    const systemPrompt = promptStore.get('builtin-tools');
    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const config: GenerateContentConfig = {
      systemInstruction: [{ text: systemPrompt }],
      tools: [
        { codeExecution: {} },
        {
          googleSearch: {},
        },
      ],
    };
    const result = await geminiAgent.run(contents, {
      onStatusUpdate,
      geminiApiOptions: {
        genConfig: config,
      },
    });
    return { response: { output: addCitations(result) } };
  },

  reply_to_file: async (args) => {
    const { chatId, messageId, content, name, type } = args;
    const file = new File([content], name, { type });
    const res = await bot.sendDocument(chatId, file, {
      deleteAfterMs: ms['1d'],
      replyToMessageId: messageId,
    });
    if (!res.ok) {
      return { response: { error: 'Failed to send file.' } };
    }
    return { response: { output: 'File sent successfully.' } };
  },

  set_message_reaction: async (args) => {
    const { chatId, messageId, reaction } = args;
    const res = await bot.setMessageReaction(chatId, messageId, reaction);
    if (!res.ok) {
      return { response: { error: 'Failed to set message reaction.' } };
    }
    return { response: { output: 'Message reaction set successfully.' } };
  },

  memory_manage: (args) => {
    const { action, userId, memory, index } = args;
    switch (action) {
      case 'add':
        return { response: { output: longTermMemory.addMemory(userId, memory ?? '') } };
      case 'get':
        return { response: { output: longTermMemory.getMemories(userId) } };
      case 'remove':
        return { response: { output: longTermMemory.removeMemory(userId, index ?? -1) } };
    }
  },
});
