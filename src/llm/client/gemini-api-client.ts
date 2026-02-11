import {
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import type { GeminiAgentOpts } from '@llm/types/agent.js';
import { GEMINI_MODELS } from '@shared/core/constants.js';
import { GeminiApiError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { ms } from '@shared/utils/helpers.js';

export class GeminiApiClient {
  private client: GoogleGenAI;
  private baseConfig: GenerateContentConfig;

  constructor(apiKey: string, baseUrl: string, baseConfig: GenerateContentConfig) {
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        baseUrl,
        timeout: ms.min(5),
      },
    });
    this.baseConfig = baseConfig;
  }

  public async generateContent(
    contents: Content[],
    config?: GeminiAgentOpts['generateConfig'],
  ): Promise<GenerateContentResponse> {
    const systemInstruction = config?.systemInstruction as Part[] | undefined;
    logger.trace(`Loading System Instruction:`, {
      preview: (systemInstruction?.[0]?.text ?? contents[0]?.parts?.[0]?.text)?.slice(0, 100),
    });

    try {
      return await this.client.models.generateContent({
        model: GEMINI_MODELS[0]!,
        contents,
        config: {
          ...this.baseConfig,
          ...config,
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new GeminiApiError(`Failed to request to Gemini API. ${errMsg}`);
    }
  }
}
