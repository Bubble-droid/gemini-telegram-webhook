import { BotMessages } from '@/configs';
import { config, logger } from '@/services';
import type { GeminiApiOptions } from '@/types';
import { deepClone, sleep } from '@/utils';
import { AppError } from '@/utils/errors';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
  type FileSearchStore,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';

// 固定的不可重试错误列表
const NonRetryErrors = [
  'Unsupported MIME type',
  'User location is not supported for the API use',
  'API key not valid',
  '400 Bad Request',
];

export class GeminiAPI {
  private gemini: GoogleGenAI;
  private baseConfig: GenerateContentConfig;
  private defaultGenerateModel = config.modelName;

  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY_MS: number = 30_000;

  constructor() {
    this.gemini = new GoogleGenAI({
      apiKey: config.geminiApiKeys[0] ?? '',
      httpOptions: {
        baseUrl: config.enableKeyRotation ? config.localProxyBaseUrl : config.geminiApiBaseUrl,
        timeout: 60 * 60_000,
      },
    });
    this.baseConfig = {
      temperature: config.modelTemperature,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    };
  }

  public async listFileSearchStores(): Promise<FileSearchStore[]> {
    let nextPageToken: string | undefined = undefined;
    const fileSearchStores: FileSearchStore[] = [];

    do {
      const response = await this.gemini.fileSearchStores.list({
        config: {
          pageSize: 20,
          ...(nextPageToken && { pageToken: nextPageToken }),
        },
      });

      fileSearchStores.push(...response.page);
      nextPageToken = response.params.config?.pageToken;
    } while (nextPageToken);

    return fileSearchStores;
  }

  /**
   * 调用 Gemini API 生成内容
   * @param contents 对话上下文
   */
  public async generate(contents: Content[], options: GeminiApiOptions = {}): Promise<GenerateContentResponse> {
    const { genClient, genModel, genConfig, onStatusUpdate } = options;
    let retryCount = 0; // 当前重试次数计数器

    const systemInstruction = genConfig?.systemInstruction as Part[] | undefined;

    logger.debug(`加载的系统指令:`, {
      preview: (systemInstruction?.[0]?.text ?? contents[0]?.parts?.[0]?.text)?.slice(0, 100),
    });

    const client = genClient ?? this.gemini;

    while (retryCount <= this.MAX_RETRIES) {
      try {
        logger.debug('Request Contents: ', { contents: this.simplifyContentsInLogger(contents) });
        // 1. 发起请求
        const response = await client.models.generateContent({
          model: genModel ?? this.defaultGenerateModel,
          contents,
          config: {
            ...this.baseConfig,
            ...genConfig,
          },
        });

        logger.debug('Response: ', { response: this.simplifyResponseInLogger(response) });

        // 2. 验证响应 (逻辑层验证)
        if (!this.isValidResponse(response)) {
          throw new AppError('Response validation failed: Model returned empty or invalid content.');
        }

        // 3. 成功返回
        return response;
      } catch (err) {
        // --- 错误处理与重试判定 ---
        const errorMsg = err instanceof Error ? err.message : String(err);

        // 1. 检查是否致命错误 (永远不重试)
        if (NonRetryErrors.some((fatalMsg) => errorMsg.includes(fatalMsg))) {
          throw err;
        }

        // 2. 检查是否允许重试 (未达最大次数)
        if (retryCount >= this.MAX_RETRIES || !onStatusUpdate) {
          logger.error(`GeminiAPI: Failed. Max retries reached.`, { err });
          // 如果是因为无效响应导致的重试耗尽，抛出特定错误以便上层识别
          if (errorMsg.includes('Response validation failed')) {
            throw new AppError(errorMsg);
          }
          throw err;
        }

        // 3. 执行重试流程

        const delayMs = this.calculateDelay(retryCount);

        // 区分错误类型用于日志或显示，但处理逻辑一致
        const isValidationError = errorMsg.includes('Response validation failed');
        const reason = isValidationError ? '模型响应无效 (空回复/仅思考)' : `API/网络错误: ${errorMsg}`;

        retryCount++; // 消耗一次重试机会

        logger.warn(`GeminiAPI: Error detected. Retrying (${retryCount}/${this.MAX_RETRIES}). Reason: ${reason}`);

        const delaySeconds = Math.floor(delayMs / 1000);

        let msg = '';
        if (reason.includes('模型响应无效')) {
          msg = `模型响应异常，将在 ${delaySeconds} 秒后进行第 ${retryCount} 次重试...`;
        } else {
          msg = `网络或接口波动，将在${delaySeconds} 秒后进行第 ${retryCount} 次重试...\n原因: \n\`\`\`txt\n${reason}\n\`\`\``;
        }

        void onStatusUpdate(msg);

        // 等待
        await sleep(delayMs);

        void onStatusUpdate(BotMessages.thinking);

        // 进入下一次循环
      }
    }

    throw new AppError(`Abnormal from Gemini API`);
  }

  /**
   * 响应验证：确保内容非空且不仅仅是思考过程
   */
  private isValidResponse(response: GenerateContentResponse): boolean {
    return !!(response.functionCalls ?? response.text);
  }

  /**
   * 计算重试延迟 (指数退避 + 随机抖动)
   */
  private calculateDelay(attempt: number): number {
    return Math.floor(this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4));
  }

  private simplifyContentsInLogger(contents: Content[]): Content[] {
    const copy = deepClone(contents);
    copy.forEach((c) => {
      this.simplifyParts(c.parts);
    });
    return copy;
  }

  private simplifyResponseInLogger(res: GenerateContentResponse): GenerateContentResponse {
    const copy = deepClone(res);
    copy.candidates?.forEach((c) => {
      this.simplifyParts(c.content?.parts);
    });
    return copy;
  }

  private simplifyParts(parts: Part[] | undefined): void {
    if (!parts) return;
    parts.forEach((p) => {
      if (p.thought) p.text = '[THOUGHT_LOG_OMITTED]';
      if (p.inlineData?.data) p.inlineData.data = '[BASE64_DATA]';
    });
  }
}

export const geminiApi = new GeminiAPI();
