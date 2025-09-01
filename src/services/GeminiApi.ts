// src/services/GeminiApi.ts

import { GoogleGenAI, FunctionCallingConfigMode, HarmCategory, HarmBlockThreshold } from '@google/genai';
import type { Content, GenerateContentConfig, GenerateContentResponse, Part, SafetySetting } from '@google/genai';
import { BotConfig, GeminiError, Log, TelegramBot, ToolExecutors } from '@/services';
import { geminiTools } from '@/configs';
import { KvNamespace, rotateArray, shortenString, sleep } from '@/utils';
import { escapeHtml } from '@/utils/formatting';
import type { ChatParams, GenerateContentSuccessResponse, ApiCallContext, ToolExecArgs, ToolName } from '@/types';

/**
 * @class GeminiApi
 * @description 封装与 Google Gemini API 的交互逻辑。
 */
export class GeminiApi {
  // 定义最大无效回复和客户端错误重试次数，以及基础重试延迟
  private static readonly MAX_RETRIES_COMMON: number = 3; // 无效回复和客户端错误共用最大重试次数
  private static readonly BASE_RETRY_DELAY_MS: number = 10_000; // 10 秒
  public static readonly SAFETY_SETTINGS: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  /**
   * 初始化 API 调用所需的配置和状态上下文。
   * @param {ChatParams} chatParams - 聊天参数。
   * @param {Content[]} initialContents - 初始对话历史记录。
   * @returns {Promise<ApiCallContext>} 初始化后的上下文对象。
   * @throws {GeminiError} 如果 API 密钥未找到或初始化失败。
   */
  private static async _initializeApiCallContext(chatParams: ChatParams, initialContents: Content[]): Promise<ApiCallContext> {
    const { durableResourceId, systemPromptKeyName, geminiApiKeysKeyName, modelName } = BotConfig.load();
    const { chatId, userMessageId, thinkMessageId } = chatParams;

    // 从 KvNamespace 读取系统提示，如果不存在则使用默认值
    const systemPrompt = (await KvNamespace.read<string>(durableResourceId, systemPromptKeyName, 'text')) || 'You are a helpful assistant.';

    // 读取 API 密钥，如果不存在则抛出错误
    const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
    if (!apiKeys || apiKeys.length === 0) {
      Log.error('未找到有效的 Gemini API 密钥。', { durableResourceId, geminiApiKeysKeyName });
      // 初始化阶段，通常没有工具思考，所以 hasToolThoughts 为 false
      throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
    }

    Log.info(`系统提示 (systemPrompt):`, { systemPrompt: systemPrompt.slice(0, 200) });

    // 构建 Gemini API 请求配置
    const config: GenerateContentConfig = {
      maxOutputTokens: 65536,
      temperature: 0,
      thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
      tools: geminiTools,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
      responseMimeType: 'text/plain',
      safetySettings: GeminiApi.SAFETY_SETTINGS,
      systemInstruction: [{ text: systemPrompt }],
    };

    // 返回初始化后的上下文对象
    return {
      chatId,
      userMessageId,
      thinkMessageId,
      systemPrompt,
      apiKeys,
      modelName,
      config,
      contents: [...initialContents], // 复制初始对话历史，避免副作用
      metrics: {
        apiCallSuccessCount: 0,
        totalUsageToken: 0,
        usageToolCount: 0,
        emptyReplyRetryCount: 0,
        errorRetryCount: 0, // 初始化客户端错误重试计数
        totalRetryCount: 0,
        startProcessTime: Date.now(),
        totalDurationSecond: 0,
        hasToolThoughts: false, // 初始化为 false
      },
    };
  }

  /**
   * 执行 Gemini API 调用（不包含重试逻辑，仅负责调用和指标更新）。
   * @param {ApiCallContext} context - API 调用上下文。
   * @returns {Promise<GenerateContentResponse>} Gemini API 的原始响应。
   * @throws {Error} 如果 API 调用失败，将抛出原始错误。
   */
  private static async _callGeminiApi(context: ApiCallContext): Promise<GenerateContentResponse> {
    Log.info(
      `API 调用轮次: ${context.metrics.apiCallSuccessCount}, 无效回复重试: ${context.metrics.emptyReplyRetryCount}, 客户端错误重试: ${context.metrics.errorRetryCount}`,
    );
    Log.info('当前发送的 contents:', {
      // 为了日志输出，复制并修改 contents，避免影响原始数据
      contents: context.contents.map((content) => ({
        ...content,
        parts: content.parts?.map((part) => {
          if (part.inlineData && part.inlineData.data) {
            // 对于包含 inlineData 的部分，替换 data 为占位符
            return { ...part, inlineData: { ...part.inlineData, data: 'BASE64_ENCODED_DATA' } };
          } else if (part.thoughtSignature) {
            return { ...part, thoughtSignature: 'THOUGHT_SIGNATURE' };
          } else if (part.thought) {
            return { ...part, text: 'THOUGHT_TEXT' };
          } else if (part.functionResponse && part.functionResponse.response?.success) {
            return {
              ...part,
              functionResponse: { ...part.functionResponse, response: { ...part.functionResponse.response, data: 'FUNCTION_RESPONSE_DATA' } },
            };
          }
          return part; // 否则返回原始部分
        }),
      })),
    });

    // 轮换 API 密钥并获取当前使用的密钥
    const newApiKeys: [string, string][] = rotateArray<[string, string]>(context.apiKeys);
    const [apiKey, apiKeyId] = newApiKeys[0];
    const ai = new GoogleGenAI({ apiKey });
    Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
    context.apiKeys = newApiKeys; // 更新上下文中的 API 密钥列表以供后续轮次使用

    Log.info('发送 Gemini API 请求...');
    // 直接执行 API 调用，如果失败则将原始错误抛出，由调用者处理重试
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: context.modelName,
      config: context.config,
      contents: context.contents,
    });

    // 更新总使用 Token 计数
    context.metrics.totalUsageToken =
      response.usageMetadata?.totalTokenCount && !isNaN(response.usageMetadata.totalTokenCount)
        ? context.metrics.totalUsageToken + response.usageMetadata.totalTokenCount
        : context.metrics.totalUsageToken;

    Log.info(`Gemini API 响应: `, {
      response: simpleGeminiApiResponse(response),
    });
    return response;
  }

  /**
   * 执行 Gemini API 调用，并处理客户端错误重试。
   * @param {ApiCallContext} context - API 调用上下文。
   * @returns {Promise<GenerateContentResponse>} Gemini API 的原始响应。
   * @throws {GeminiError} 如果所有客户端错误重试均失败。
   */
  private static async _executeApiCallWithRetries(context: ApiCallContext): Promise<GenerateContentResponse> {
    for (let attempt = 0; attempt <= GeminiApi.MAX_RETRIES_COMMON; attempt++) {
      try {
        const response = await GeminiApi._callGeminiApi(context);
        return response; // 成功获取响应，返回
      } catch (error: unknown) {
        const err = error instanceof GeminiError ? error : new GeminiError(String(error), 'API_CLIENT_ERROR', context.metrics.hasToolThoughts);
        Log.error(`Gemini API 客户端或网络错误 (尝试 ${attempt + 1}/${GeminiApi.MAX_RETRIES_COMMON}):`, { err });

        if (attempt < GeminiApi.MAX_RETRIES_COMMON) {
          const delay = Math.floor(GeminiApi.BASE_RETRY_DELAY_MS * Math.pow(2, attempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.errorRetryCount++; // 递增客户端错误重试计数
          // 注意：这里没有重置 errorRetryCount，它会持续累积

          if (context.thinkMessageId !== undefined) {
            const errorRetryText = `Gemini API 客户端错误，将在 ${Math.floor(delay / 1000)} 秒后，进行第 ${attempt + 1} 次重试...`;
            await TelegramBot.editMessageText(context.chatId, context.thinkMessageId, errorRetryText);
          }
          await sleep(delay);
          Log.info(`Gemini API 客户端错误，进行第 ${attempt + 1} 次重试...`);
        } else {
          // 达到最大客户端错误重试次数
          const finalError = new GeminiError(
            `Gemini API 客户端错误，已达最大重试次数 (${GeminiApi.MAX_RETRIES_COMMON})。\n\n${err}`,
            'MAX_API_CLIENT_RETRIES_REACHED',
            context.metrics.hasToolThoughts,
          );
          await GeminiApi._writeApiKeysToKv(context.apiKeys); // 在抛出错误前写入 API 密钥
          throw finalError;
        }
      }
    }
    // 理论上不会执行到这里，因为上述循环要么返回response，要么抛出finalError
    // 但为了确保类型安全和代码完整性，添加一个防御性抛出
    throw new GeminiError('未知错误：客户端重试循环异常退出。', 'UNKNOWN_RETRY_LOOP_EXIT', context.metrics.hasToolThoughts);
  }

  /**
   * 处理模型返回的工具调用（functionCall）和伴随的思考文本。
   * @param {ApiCallContext} context - API 调用上下文。
   * @param {Part[]} modelParts - 模型响应中的所有 parts。
   * @returns {Promise<Part[]>} 包含所有工具执行结果的 parts 数组。
   */
  private static async _handleToolCalls(context: ApiCallContext, modelParts: Part[]): Promise<Part[]> {
    const functionCalls = modelParts.filter((part) => part.functionCall);
    const functionTexts = modelParts.filter((part) => part.text);

    // 处理并显示模型思考文本
    if (functionTexts.length > 0) {
      const thoughtTexts = functionTexts
        .map((part) => part.text)
        .join('')
        .trim();
      if (thoughtTexts) {
        context.metrics.hasToolThoughts = true;
        // 如果存在 thinkMessageId，更新 Telegram 消息
        if (context.thinkMessageId !== undefined) {
          const displayThoughtText = `<b>Thoughts</b>:\n\n<blockquote expandable>${escapeHtml(shortenString(thoughtTexts))}</blockquote>`;
          await TelegramBot.editMessageText(context.chatId, context.thinkMessageId, displayThoughtText, { parseMode: 'HTML' });
        }
      }
    }

    Log.info(`检测到工具调用 (${functionCalls.length} 个)`);
    context.metrics.usageToolCount += functionCalls.length;

    const toolResponseParts: Part[] = []; // 存储本次轮次所有工具的执行结果

    // 遍历并执行每个工具调用
    for (const functionCall of functionCalls) {
      const functionName = functionCall.functionCall?.name;
      const functionArgs = functionCall.functionCall?.args;
      const toolExecArgs = {
        chatId: context.chatId,
        userMessageId: context.userMessageId,
        currentApiKey: context.apiKeys[0][0],
        ...functionArgs,
      } as ToolExecArgs;

      if (typeof functionName === 'string' && functionName in ToolExecutors) {
        try {
          // 执行工具函数
          const executor = ToolExecutors[functionName as ToolName];
          const toolResult = (await executor(toolExecArgs)) as unknown as Record<string, unknown>;
          toolResponseParts.push({
            functionResponse: {
              name: functionName,
              response: toolResult,
            },
          });
          Log.info(`工具 ${functionName} 执行成功，结果已记录`);
        } catch (toolError: unknown) {
          // 工具执行失败，记录错误并报告给模型
          // 确保新创建的 GeminiError 包含 hasToolThoughts
          const err =
            toolError instanceof GeminiError
              ? toolError
              : new GeminiError(String(toolError), 'TOOL_EXECUTION_ERROR', context.metrics.hasToolThoughts);
          Log.error(`执行工具 ${functionName} 失败:`, { err });
          toolResponseParts.push({
            functionResponse: {
              name: functionName,
              response: {
                error: `错误：执行工具 ${functionName} 失败 - ${err.message || '未知错误'}`,
              },
            },
          });
        }
      } else {
        // 模型调用了未实现的工具
        const errorMsg = `模型调用了未实现的工具: ${functionName || '未知工具'}`;
        Log.warn(errorMsg);
        toolResponseParts.push({
          functionResponse: {
            name: functionName || 'unknown_tool',
            response: {
              error: `错误：工具 ${functionName || '未知工具'} 未实现`,
            },
          },
        });
      }
    }
    return toolResponseParts;
  }

  /**
   * 构造最终的成功响应对象。
   * @param {ApiCallContext} context - API 调用上下文。
   * @param {Part[]} textParts - 模型返回的文本 parts。
   * @returns {GenerateContentSuccessResponse} 最终的成功响应。
   */
  private static _buildSuccessResponse(context: ApiCallContext, textParts: Part[]): GenerateContentSuccessResponse {
    const finishedTime = Date.now();
    context.metrics.totalDurationSecond = Math.round((finishedTime - context.metrics.startProcessTime) / 1000);

    return {
      response: {
        role: 'model',
        parts: textParts,
      },
      totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
      apiCallSuccessCount: context.metrics.apiCallSuccessCount,
      totalUsageToken: context.metrics.totalUsageToken,
      usageToolCount: context.metrics.usageToolCount,
      totalDurationSecond: context.metrics.totalDurationSecond,
      hasToolThoughts: context.metrics.hasToolThoughts,
      emptyReplyRetryCount: context.metrics.emptyReplyRetryCount, // 单独返回无效回复重试次数
      errorRetryCount: context.metrics.errorRetryCount, // 单独返回客户端错误重试次数
    };
  }

  /**
   * 将当前轮换后的 API 密钥组写入 KvNamespace。
   * @param {[string, string][]} apiKeys - 当前的 API 密钥组。
   */
  private static async _writeApiKeysToKv(apiKeys: [string, string][]): Promise<void> {
    const { durableResourceId, geminiApiKeysKeyName } = BotConfig.load();
    try {
      // 显式指定类型为 'json'，与读取时保持一致
      await KvNamespace.write(durableResourceId, geminiApiKeysKeyName, JSON.stringify(apiKeys));
      Log.info('已将最新的 API 密钥组写入 KvNamespace。');
    } catch (error) {
      Log.error('写入 API 密钥到 KvNamespace 失败:', { error });
    }
  }

  /**
   * 调用 Gemini API 进行对话或生成内容，支持工具调用。
   * 这是主要的协调函数，它使用私有辅助方法来管理整个流程。
   * @param {Content[]} initialContents - 初始对话历史记录。
   * @param {ChatParams} chatParams - 聊天参数。
   * @returns {Promise<GenerateContentSuccessResponse>} Gemini API 的最终响应对象，包含文本或工具调用结果。
   * @throws {GeminiError} 如果在任何阶段发生不可恢复的错误。
   */
  public static generateContent = async (initialContents: Content[], chatParams: ChatParams): Promise<GenerateContentSuccessResponse> => {
    const { maxApiCallRounds } = BotConfig.load();
    let context: ApiCallContext;

    try {
      // 1. 初始化 API 调用上下文
      context = await GeminiApi._initializeApiCallContext(chatParams, initialContents);
    } catch (error: unknown) {
      // 初始化失败，直接抛出错误。
      // 这里确保即使在 context 未完全初始化的情况下，也能传递 hasToolThoughts（此时应为 false）
      const err = error instanceof GeminiError ? error : new GeminiError(String(error), 'INITIALIZATION_ERROR', false);
      Log.error('初始化 API 调用上下文失败:', { err });
      throw err;
    }

    let apiCallRoundCounter = 0; // 跟踪实际的 API 调用轮次，不包括重试

    // 主循环，控制最大逻辑 API 调用轮次
    while (apiCallRoundCounter < maxApiCallRounds) {
      let response: GenerateContentResponse;
      try {
        // 2. 调用 Gemini API，并处理客户端错误重试
        // _executeApiCallWithRetries 保证返回一个 GenerateContentResponse 或抛出错误
        response = await GeminiApi._executeApiCallWithRetries(context);
      } catch (error: unknown) {
        // _executeApiCallWithRetries 已经处理了所有客户端错误重试，并最终抛出了 GeminiError
        // 所以这里直接 re-throw 即可
        throw error as GeminiError;
      }

      let candidate = response.candidates?.[0]; // 此时 response 保证已赋值

      // 3. 内部循环：处理无效回复重试
      let currentEmptyReplyAttempt = 0;
      while (!candidate || !candidate.content || !candidate.content.parts) {
        if (currentEmptyReplyAttempt < GeminiApi.MAX_RETRIES_COMMON) {
          const delay = Math.floor(GeminiApi.BASE_RETRY_DELAY_MS * Math.pow(2, currentEmptyReplyAttempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.emptyReplyRetryCount++; // 递增全局无效回复重试计数
          currentEmptyReplyAttempt++; // 递增当前无效回复重试的局部计数

          if (context.thinkMessageId !== undefined) {
            const emptyReplyRetryText = `Gemini API 响应为空，将在 ${Math.floor(delay / 1000)} 秒后，进行第 ${currentEmptyReplyAttempt} 次重试...`;
            await TelegramBot.editMessageText(context.chatId, context.thinkMessageId, emptyReplyRetryText);
          }
          Log.warn(
            `Gemini API 返回结果不包含有效的 candidate 或 content，尝试重试 (无效回复重试 ${currentEmptyReplyAttempt}/${GeminiApi.MAX_RETRIES_COMMON})。`,
            { response },
          );
          await sleep(delay);

          // 重新尝试调用 API，获取有效响应
          try {
            response = await GeminiApi._executeApiCallWithRetries(context);
            candidate = response.candidates?.[0]; // 更新 candidate 以供下一轮 while 循环检查
          } catch (error: unknown) {
            throw error as GeminiError;
          }
        } else {
          // 达到最大无效回复重试次数
          const errorMsg = `Gemini API 未返回有效结果，已达最大无效回复重试次数 (${GeminiApi.MAX_RETRIES_COMMON})，请稍后再重新提问。`;
          Log.error(errorMsg);
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
          throw new GeminiError(errorMsg, 'MAX_EMPTY_REPLY_RETRIES_REACHED', context.metrics.hasToolThoughts);
        }
      }

      // 如果代码执行到这里，说明已经成功获取到一个非空且有效的 candidate
      // 此时才算作一次实际的 API 调用轮次完成
      apiCallRoundCounter++;
      currentEmptyReplyAttempt = 0;
      context.metrics.apiCallSuccessCount++;

      const parts: Part[] = candidate.content.parts;
      const functionCalls = parts.filter((part) => part.functionCall);

      // 4. 将模型的原始响应（包括文本和工具调用）添加到对话历史
      context.contents.push({
        role: 'model',
        parts: parts,
      });

      // 5. 判断是否需要处理工具调用
      if (functionCalls.length > 0) {
        const toolResponseParts = await GeminiApi._handleToolCalls(context, parts);

        if (toolResponseParts.length > 0) {
          context.contents.push({
            role: 'user',
            parts: toolResponseParts,
          });
          Log.info('工具执行结果已添加到消息历史，准备下一轮 API 调用');
          // 继续外部 while 循环，进行下一轮实际 API 调用
        } else {
          // 理论上不应该发生：模型调用了工具但没有工具执行结果
          Log.warn('模型调用了工具，但没有工具执行结果被记录，可能出现逻辑问题。');
          await GeminiApi._writeApiKeysToKv(context.apiKeys); // 在返回前写入 API 密钥
          return {
            response: { role: 'model', parts: [{ text: '😥 抱歉，模型尝试使用工具但未能获取结果。' }] },
            ...context.metrics, // 返回当前已收集的指标
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount,
          };
        }
      } else {
        // 6. 没有工具调用，提取最终的文本回复
        const textParts = parts.filter((part) => part.text);

        if (textParts.length > 0) {
          Log.info(`Gemini API 请求成功，返回文本响应。`);
          await GeminiApi._writeApiKeysToKv(context.apiKeys); // 在成功返回前写入 API 密钥
          // 构建并返回最终的成功响应
          return GeminiApi._buildSuccessResponse(context, textParts);
        } else {
          // 7. 既没有工具调用也没有文本回复
          Log.warn('Gemini API 返回非工具调用响应，但没有文本内容或其他可处理的 parts。', { response });
          const finishReason = candidate.finishReason;
          await GeminiApi._writeApiKeysToKv(context.apiKeys); // 在返回前写入 API 密钥
          // 返回一个包含提示的响应
          return {
            response: {
              role: 'model',
              parts: [{ text: `😥 抱歉，未能获取有效的文本回复。Finish Reason: ${finishReason || '未知'}` }],
            },
            ...context.metrics, // 返回当前已收集的指标
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount,
          };
        }
      }
    }

    // 如果循环次数达到上限，仍然没有最终回复，抛出错误
    const errorMsg = `达到最大 API 调用轮次 (${maxApiCallRounds})，未能获取最终回复。`;
    Log.error(errorMsg);
    // 确保新创建的 GeminiError 包含 hasToolThoughts
    await GeminiApi._writeApiKeysToKv(context.apiKeys); // 在抛出错误前写入 API 密钥
    throw new GeminiError(errorMsg, 'MAX_CALL_ROUNDS_REACHED', context.metrics.hasToolThoughts);
  };
}

export const simpleGeminiApiResponse = (response: GenerateContentResponse): GenerateContentResponse => {
  const simpleResponse = {
    ...response,
    candidates: response.candidates?.map((candidate) => ({
      ...candidate,
      content: {
        ...candidate.content,
        parts: candidate.content?.parts?.map((part) => {
          if (part.thought) {
            return { ...part, text: 'THOUGHT_TEXT' };
          } else if (part.thoughtSignature) {
            return { ...part, thoughtSignature: 'THOUGHT_SIGNATURE' };
          } else if (part.inlineData && part.inlineData.data) {
            return { ...part, inlineData: { ...part.inlineData, data: 'BASE64_ENCODED_DATA' } };
          } else if (part.text) {
            return { ...part, text: 'TEXT_CONTENT' };
          }
          return part;
        }),
      },
    })),
  };
  return simpleResponse as GenerateContentResponse;
};
