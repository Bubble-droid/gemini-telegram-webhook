import { BotMessages } from '@/configs';
import { logger } from '@/services';
import { CONFIG } from '@/services/ConfigLoader';
import { geminiClient } from '@/services/apis';
import type { ChatAgentOptions } from '@/types';
import { sleep } from '@/utils';
import { AppError } from '@/utils/errors';
import type { Content, GenerateContentResponse, Part } from '@google/genai';

export const chatAgent = async (
  contents: Content[],
  options: ChatAgentOptions = {},
): Promise<GenerateContentResponse> => {
  const { maxRounds = CONFIG.MAX_API_CALL_ROUNDS, geminiApiOptions, toolExecutor, onStatusUpdate } = options;
  let round = 0;
  let response: GenerateContentResponse;
  while (round < maxRounds) {
    logger.debug(`[ChatAgent] Round ${round + 1} started.`);

    response = await geminiClient.generate(contents, geminiApiOptions);

    if (response.candidates?.[0]?.content) contents.push(response.candidates[0].content);

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      if (!toolExecutor) {
        throw new AppError('Model requested tool execution but no toolExecutor provided.');
      }

      logger.debug(`Model requested ${functionCalls.length} tool calls.`);

      let updated: string | undefined = undefined;
      // 4. 执行工具
      const toolResults: Part[] = [];
      for (const { name, args } of functionCalls) {
        if (!name) {
          toolResults.push({
            functionResponse: {
              name: 'N/A',
              response: { error: 'Tool name not provided' },
            },
          });
          continue;
        }

        logger.info(`[ChatAgent] Executing tool: ${name}`, { args });

        const updateText = `${response.text ?? ''}\n\n🔧 Executing: \`${name}\`...`.trim();

        if (updated !== updateText && onStatusUpdate) {
          logger.debug(`[UI] Updating status for tool: ${name}`);
          await onStatusUpdate(updateText);
          updated = updateText;
        }

        try {
          // 调用注入的执行器
          const result = await toolExecutor(name, args);

          toolResults.push({
            functionResponse: {
              name,
              response: result.response,
            },
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.warn(`[ChatAgent] Tool execution error: ${name}`, { err });
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

      await sleep(CONFIG.REQUEST_LIMIT_SECOND * 1000);

      if (updated) await onStatusUpdate?.(BotMessages.thinking);

      round++;

      continue;
    }
    logger.info(`[ChatAgent] Task completed`, { rounds: round + 1 });
    return response;
  }
  throw new AppError(`Max conversation rounds (${maxRounds}) reached. Response: ${JSON.stringify(response!)}`);
};
