// src/configs/tool_executors.ts

import { logger } from '@/services';
import { chatAgent, MCPClient, performTask } from '@/services/agents';
import { geminiApi } from '@/services/apis';
import type { FileStoreName, GeminiApiOptions, ToolExecutorsMap } from '@/types';
import { addCitations, promptStore } from '@/utils';
import type { Content, GenerateContentConfig, Tool } from '@google/genai';
import { ThinkingLevel } from '@google/genai';

const githubClient = new MCPClient('github-toolset');

export const ToolExecutors: ToolExecutorsMap = {
  use_file_search: async (args, { onStatusUpdate } = {}) => {
    const systemPrompt = promptStore.get('file-search');

    const contents: Content[] = [{ role: 'user', parts: [{ text: args.prompt }] }];

    const fileSearchStores = await geminiApi.listFileSearchStores();

    const names = fileSearchStores.flatMap((s) => {
      return args.fileStores.includes(s.displayName as FileStoreName) && s.name ? [s.name] : [];
    });

    if (names.length !== args.fileStores.length) {
      logger.warn(`No found file search stores.`);
      return { response: { error: 'No found file search stores. (Missing some stores or not creation)' } };
    }

    const config: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ fileSearch: { fileSearchStoreNames: names } }],
    };

    const geminiApiOptions: GeminiApiOptions = {
      genConfig: config,
      ...(onStatusUpdate && { onStatusUpdate }),
    };

    const result = await chatAgent(contents, {
      geminiApiOptions,
    });

    return { response: { output: addCitations(result) } };
  },

  use_github_toolset: async (args, { onStatusUpdate } = {}) => {
    logger.info('[Tool] Spawning GitHub Worker...');

    const systemPrompt = promptStore.get('github-toolset');

    const result = await performTask(githubClient, args.prompt, systemPrompt, {
      ...(onStatusUpdate && { onStatusUpdate }),
    });

    return { response: result };
  },

  'use_built-in_tools': async (args, { onStatusUpdate } = {}) => {
    const systemPrompt = promptStore.get('built-in-tools');

    const contents: Content[] = [{ role: 'user', parts: [{ text: args.prompt }] }];

    const tools: Tool[] = args.tools.map((t) => ({ [t]: {} }));

    const config: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools,
    };

    const geminiApiOptions: GeminiApiOptions = {
      genConfig: config,
      ...(onStatusUpdate && { onStatusUpdate }),
    };

    const result = await chatAgent(contents, {
      geminiApiOptions,
    });

    return { response: { output: addCitations(result) } };
  },
};
