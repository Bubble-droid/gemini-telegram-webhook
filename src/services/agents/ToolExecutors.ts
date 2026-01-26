import { FILE_SEARCH_MODEL } from '@/configs/constant';
import { logger } from '@/services';
import type { GeminiApiOptions, ToolExecutorsMap } from '@/types';
import { addCitations, promptStore } from '@/utils';
import type { Content, GenerateContentConfig, Tool } from '@google/genai';
import { ThinkingLevel } from '@google/genai';
import { chatAgent } from './ChatAgent';
import { MCPClient } from './MCPClient';
import { performTask } from './MCPWorker';

const githubClient = new MCPClient('github-toolset');

export const ToolExecutors: ToolExecutorsMap = {
  use_file_search: async (args, { onStatusUpdate } = {}) => {
    const { prompt, fileStores } = args;
    if (!fileStores.length) {
      logger.warn(`No file stores provided.`);
      return { response: { error: 'No file stores provided.' } };
    }

    const systemPrompt = promptStore.get('file-search');

    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

    const config: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ fileSearch: { fileSearchStoreNames: fileStores } }],
    };

    const geminiApiOptions: GeminiApiOptions = {
      genModel: FILE_SEARCH_MODEL,
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

  use_builtin_tools: async (args, { onStatusUpdate } = {}) => {
    const { prompt, tools } = args;
    if (!tools.length) {
      logger.warn(`No tools provided.`);
      return { response: { error: 'No tools provided.' } };
    }

    const systemPrompt = promptStore.get('builtin-tools');

    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

    const toolSchemas: Tool[] = tools.map((t) => Object.fromEntries([[t, {}]]));

    const config: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools: toolSchemas,
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
