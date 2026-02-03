import {
  GoogleGenAI,
  type Content,
  type FileSearchStore,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import type { GeminiApiOptions } from '@llm/types/agent';
import { ListRotator } from '@services/list-rotator';
import { CONFIG } from '@shared/core/config';
import { GEMINI_MODELS } from '@shared/core/constants';
import { AgentError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import { deepClone, delay, ms } from '@shared/utils/helpers';

const FATAL_ERRORS = ['INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'PERMISSION_DENIED', 'NOT_FOUND'];

export class GeminiApiClient {
  private keys = CONFIG.GEMINI_API_KEYS;
  private client: GoogleGenAI;
  private models = new ListRotator(GEMINI_MODELS);
  private baseConfig: GenerateContentConfig;

  constructor(baseUrl: string, baseConfig: GenerateContentConfig) {
    this.client = new GoogleGenAI({
      apiKey: '[KEY]',
      httpOptions: {
        baseUrl,
        timeout: ms.min(5),
      },
    });
    this.baseConfig = baseConfig;
  }

  public async listFileSearchStores(): Promise<FileSearchStore[]> {
    let nextPageToken: string | undefined = undefined;
    const fileSearchStores: FileSearchStore[] = [];

    do {
      const response = await this.client.fileSearchStores.list({
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

  public async generateContent(contents: Content[], options: GeminiApiOptions = {}): Promise<GenerateContentResponse> {
    const { genClient, genModel, genConfig } = options;

    const systemInstruction = genConfig?.systemInstruction as Part[] | undefined;

    logger.trace(`Loading System Instruction:`, {
      preview: (systemInstruction?.[0]?.text ?? contents[0]?.parts?.[0]?.text)?.slice(0, 2000),
    });

    const client = genClient ?? this.client;
    let retryCount = 0; // 当前重试次数计数器
    while (retryCount <= this.keys.length) {
      const model = genModel ?? this.models.next();

      try {
        logger.debug('Request Contents: ', { contents: this.simplifyContentsInLogger(contents) });

        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            ...this.baseConfig,
            ...genConfig,
          },
        });

        logger.debug('Response: ', { response: this.simplifyResponseInLogger(response) });

        if (!this.isValidResponse(response)) {
          throw new AgentError('Response validation failed: Model returned empty or invalid content.');
        }

        return response;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (FATAL_ERRORS.some((msg) => errorMsg.includes(msg))) {
          throw err;
        }

        if (retryCount >= this.keys.length) {
          logger.error(`GeminiAPI: Failed. Max retries reached.`, { err });
          if (errorMsg.includes('Response validation failed')) {
            throw new AgentError(errorMsg);
          }
          throw err;
        }
        const isValidationError = errorMsg.includes('Response validation failed');
        const reason = isValidationError ? '模型响应无效 (空回复/仅思考)' : `API/网络错误: ${errorMsg}`;

        logger.warn(`GeminiAPI: Error detected. Retrying. Reason: ${reason}`);

        retryCount++;

        await delay(ms.sec(3));
      }
    }

    throw new AgentError(`Abnormal from Gemini API`);
  }

  private isValidResponse(response: GenerateContentResponse): boolean {
    return !!response.functionCalls?.length || !!response.text?.length;
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
      if (p.thought) p.text = '[THOUGHT_SUMMARIES]';
      if (p.inlineData?.data) p.inlineData.data = '[BASE64_DATA]';
    });
  }
}
