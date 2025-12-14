// src/services/QuestionHandler.ts

import { functionDeclarations } from '@/configs';
import { bot, chatAgent, config, logger, ToolExecutors, type GeminiApiOptions, type RetryCallback } from '@/services';
import type { ToolName } from '@/types';
import { promptStore } from '@/utils';
import { AppError } from '@/utils/errors';
import {
  FunctionCallingConfigMode,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from '@google/genai';

interface ChatInfos {
  chatId: number;
  userMessageId: number;
  statusMessageId: number;
}

/**
 * API 调用上下文
 * 封装单次请求生命周期内的所有可变状态
 */
interface QuestionContext extends ChatInfos {
  contents: Content[];
}

class QuestionHandler {
  private maxConversationRounds: number;

  constructor() {
    this.maxConversationRounds = config.maxApiCallRounds;
  }

  /**
   * 初始化 API 调用上下文
   */
  private createContext(chatInfos: ChatInfos, initContents: Content[]): QuestionContext {
    return {
      chatId: chatInfos.chatId,
      userMessageId: chatInfos.userMessageId,
      statusMessageId: chatInfos.statusMessageId,
      contents: [...initContents],
    };
  }

  /**
   * 核心处理逻辑
   */
  public async handle(chatInfos: ChatInfos, initContents: Content[]): Promise<GenerateContentResponse> {
    const ctx = this.createContext(chatInfos, initContents);
    const systemPrompt = promptStore.get('assistant');

    // 1. 定义 UI 更新回调 (用于重试和工具执行)
    const updateStatus = (text: string) => {
      bot.editMessageText(ctx.chatId, ctx.statusMessageId, text);
    };

    const onRetryHandler: RetryCallback = (reason, attempt, delayMs) => {
      const delaySeconds = Math.floor(delayMs / 1000);

      let msg = '';
      if (reason.includes('模型响应无效')) {
        msg = `模型响应异常，正在进行第 ${attempt} 次修正重试... (${delaySeconds}s)`;
      } else {
        msg = `网络或接口波动，${delaySeconds} 秒后重试... (Attempt ${attempt})\n原因: ${reason}`;
      }
      updateStatus(msg);
    };

    // 3. 定义工具状态回调 (将被递归传递到 MCP Worker)
    const onToolStartHandler = (toolName: string) => {
      logger.info(`[UI] Updating status for tool: ${toolName}`);
      updateStatus(`🔧 Executing: ${toolName}...`);
    };

    // 4. 构建注入了回调的本地工具执行器
    // ChatAgent 调用此函数时，只传 (name, args)
    // 我们在这里闭包注入 onToolStartHandler
    const scopedToolExecutor = async (name: string, args: Record<string, unknown>) => {
      const executor = ToolExecutors[name as ToolName];
      if (!executor) {
        throw new AppError(`Local tool "${name}" not found in ToolExecutors.`);
      }
      // 调用 ToolExecutors.ts 中的函数，并传入回调
      return await executor(args as never, { onToolStart: onToolStartHandler, onRetry: onRetryHandler });
    };

    try {
      logger.info(`Handing over to ChatAgent`, { chatId: ctx.chatId });

      const config: GenerateContentConfig = {
        thinkingConfig: { thinkingBudget: -1 },
        systemInstruction: [{ text: systemPrompt }],
        tools: [{ functionDeclarations: functionDeclarations }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      };

      const geminiApiOptions: GeminiApiOptions = {
        genConfig: config,
        onRetry: onRetryHandler,
      };

      const finalResponse = await chatAgent.chat(ctx.contents, {
        maxRounds: this.maxConversationRounds,
        geminiApiOptions,
        toolExecutor: scopedToolExecutor, // 注入了逻辑的执行器
        onToolStart: onToolStartHandler, // 主流程的工具也会触发
      });

      return finalResponse;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error('QuestionHandler failed', { err, chatId: ctx.chatId });

      if (errMessage.includes('Max conversation rounds')) {
        throw new AppError('任务过于复杂，已达到最大对话轮次。', 'MAX_ROUNDS');
      }
      throw new AppError(`处理失败: ${errMessage}`, 'HANDLER_ERROR');
    }
  }
}

export const questionHandler = new QuestionHandler();
