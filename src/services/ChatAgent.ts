import { AppError, geminiApi, logger, type RetryCallback } from '@/services';
import { config } from '@/services/ConfigLoader';
import { sleep } from '@/utils';
import { type Content, type GenerateContentConfig, type GenerateContentResponse, type Part } from '@google/genai';

// 定义工具回调类型
export type OnToolStartCallback = (toolName: string) => void | Promise<void>;

// 定义通用工具执行器签名
export type ToolExecutorFn = (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface ChatAgentOptions {
  maxRounds?: number;
  config?: GenerateContentConfig;
  toolExecutor?: ToolExecutorFn; // 工具的具体执行逻辑
  onRetry?: RetryCallback; // 错误重试回调
  onToolStart?: OnToolStartCallback; // UI 状态更新回调
}

export class ChatAgent {
  private requestRateLimit: number;

  constructor() {
    this.requestRateLimit = config.requestIntervalSecond * 1000;
  }

  /**
   * 执行对话循环
   * @param contents 对话历史 (会原地修改)
   * @param options 配置项
   */
  public async chat(contents: Content[], options: ChatAgentOptions = {}): Promise<GenerateContentResponse> {
    const { maxRounds = 10, config, toolExecutor, onRetry, onToolStart } = options;
    let round = 0;
    while (round < maxRounds) {
      logger.info(`[ChatAgent] Round ${round + 1} started.`);

      const response = await geminiApi.generate(contents, config, onRetry);

      contents.push(response.candidates?.[0]?.content as Content);

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        if (!toolExecutor) {
          throw new AppError('Model requested tool execution but no toolExecutor provided.');
        }

        logger.info(`Model requested ${functionCalls.length} tool calls.`);

        // 4. 执行工具
        const toolResults: Part[] = [];
        for (const call of functionCalls) {
          const { name, args } = call;
          logger.info(`[ChatAgent] Executing tool: ${name}`);
          if (onToolStart) {
            onToolStart(name as string);
          }
          try {
            // 调用注入的执行器
            const result = await toolExecutor(name as string, args as Record<string, unknown>);

            toolResults.push({
              functionResponse: {
                name,
                response: result,
              },
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`[ChatAgent] Tool execution error: ${name}`, { err });
            toolResults.push({
              functionResponse: {
                name,
                response: { error: errorMsg },
              },
            });
          }
          // 5. 将结果加入历史
        }

        contents.push({ role: 'user', parts: toolResults });

        await sleep(this.requestRateLimit);

        round++;

        continue;
      }

      return response;
    }
    throw new AppError(`Max conversation rounds (${maxRounds}) reached.`);
  }
}

export const chatAgent = new ChatAgent();
