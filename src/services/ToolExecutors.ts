// src/configs/tool_executors.ts

import { chatAgent, logger, MCPClient, mcpWorker, promptStore } from '@/services';
import type { ToolExecutorsMap } from '@/types';
import type { Content, GenerateContentConfig, GenerateContentResponse } from '@google/genai';

const ragClient = new MCPClient('local_rag');
const githubClient = new MCPClient('github_toolset');

export const ToolExecutors: ToolExecutorsMap = {
  use_rag_system: async (args, { onToolStart, onRetry } = {}) => {
    logger.info('[Tool] Spawning RAG Worker...');

    const systemPrompt = promptStore.get('rag_system');

    const result = await mcpWorker.performTask(ragClient, args?.prompt as string, systemPrompt, {
      onToolStart,
      onRetry,
    });

    return { result };
  },

  use_github_toolset: async (args, { onToolStart, onRetry } = {}) => {
    logger.info('[Tool] Spawning GitHub Worker...');

    const systemPrompt = promptStore.get('github_toolset');

    const result = await mcpWorker.performTask(githubClient, args?.prompt as string, systemPrompt, {
      onToolStart,
      onRetry,
    });

    return { result };
  },

  use_native_tools: async (args, { onRetry } = {}) => {
    const systemPrompt = promptStore.get('native_tools');

    const contents: Content[] = [{ role: 'user', parts: [{ text: args?.prompt as string }] }];

    const config: GenerateContentConfig = {
      temperature: 1,
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ googleSearch: {} }, { codeExecution: {} }, { urlContext: {} }],
    };

    const result = await chatAgent.chat(contents, {
      config,
      onRetry,
    });

    return { result: addCitations(result) };
  },

  reload_prompts: async () => {
    promptStore.reload();

    return { result: 'All prompts reloaded' };
  },
};

const addCitations = (response: GenerateContentResponse): string => {
  let text = response.text || '';
  const supports = response.candidates?.[0]?.groundingMetadata?.groundingSupports || [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  // Sort supports by end_index in descending order to avoid shifting issues when inserting.
  const sortedSupports = [...supports].sort((a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0));

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue;
    }

    const citationLinks = support.groundingChunkIndices
      .map((i) => {
        const uri = chunks[i]?.web?.uri;
        if (uri) {
          return `[${i + 1}](${uri})`;
        }
        return null;
      })
      .filter(Boolean);

    if (citationLinks.length > 0) {
      const citationString = citationLinks.join(', ');
      text = text.slice(0, endIndex) + citationString + text.slice(endIndex);
    }
  }

  return text;
};
