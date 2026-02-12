import {
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import type { GeminiAgentOpts } from '@llm/types/agent.js';
import { GeminiApiError } from '@shared/core/errors.js';
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
    model?: GenerateContentParameters['model'],
  ): Promise<GenerateContentResponse> {
    try {
      return await this.client.models.generateContent({
        model: model ?? 'gemini',
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
