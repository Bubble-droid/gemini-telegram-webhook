// src/services/QuestionHandler.ts

import { functionDeclarations } from '@/configs';
import { config, logger } from '@/services';
import { chatAgent, ToolExecutors } from '@/services/agents';
import type { GeminiApiOptions, StatusUpdateCallback, ToolExecutorFn, ToolName } from '@/types';
import type { ResponseContext } from '@/utils';
import { promptStore } from '@/utils';
import { AppError } from '@/utils/errors';
import { toHtml } from '@/utils/markdown';
import {
  FunctionCallingConfigMode,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from '@google/genai';

export const processQuestion = async (contents: Content[], ctx: ResponseContext): Promise<GenerateContentResponse> => {
  const systemPrompt = promptStore.get('assistant');

  // 1. 定义 UI 更新回调 (用于重试和工具执行)
  const updateStatus: StatusUpdateCallback = (text) => {
    void ctx.edit(toHtml(text), { parse_mode: 'HTML' });
  };

  const customToolExecutor: ToolExecutorFn = (name, args) => {
    return ToolExecutors[name as ToolName](args as never, { onStatusUpdate: updateStatus });
  };

  try {
    logger.info(`Handing over to ChatAgent`, { chatId: ctx.chat.id });

    const genConfig: GenerateContentConfig = {
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ functionDeclarations: functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    };

    const geminiApiOptions: GeminiApiOptions = {
      genConfig: genConfig,
      onStatusUpdate: updateStatus,
    };

    const finalResponse = await chatAgent([...contents], {
      maxRounds: config.maxApiCallRounds,
      geminiApiOptions,
      toolExecutor: customToolExecutor,
      onStatusUpdate: updateStatus,
    });

    return finalResponse;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.error('QuestionHandler failed', { err, chatId: ctx.chat.id });

    if (errMessage.includes('Max conversation rounds')) {
      throw new AppError('任务过于复杂，已达到对话上限，强制终止。', 'MAX_ROUNDS');
    }
    throw new AppError(`处理失败: ${errMessage}`, 'HANDLER_ERROR');
  }
};
