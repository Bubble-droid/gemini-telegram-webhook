import { type GenerateContentConfig, type ThinkingConfig } from '@google/genai';
import type { OpenAiClientParams } from '@llm/types/agent.js';
import { OpenAiApiError } from '@shared/core/errors.js';
import { ms } from '@shared/utils/helpers.js';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources.js';

interface ExtraGoogleParams {
  google: {
    thinking_config: {
      include_thoughts?: ThinkingConfig['includeThoughts'];
      thinking_level?: ThinkingConfig['thinkingLevel'];
      thinking_budget?: ThinkingConfig['thinkingBudget'];
    };
    safety_settings?: GenerateContentConfig['safetySettings'];
  };
}

interface BaseParams extends Omit<OpenAiClientParams, 'model'> {
  extra_body?: ExtraGoogleParams;
}

export class OpenAiClient {
  private client: OpenAI;

  constructor(
    apiKey: string,
    baseURL: string,
    private readonly baseParams?: BaseParams,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: ms.min(5),
    });
  }

  public async chatCompletion(
    messages: ChatCompletionMessageParam[],
    params?: OpenAiClientParams,
  ): Promise<ChatCompletion> {
    try {
      return await this.client.chat.completions.create({
        ...this.baseParams,
        ...params,
        messages,
        n: 1,
        stream: false,
      } as ChatCompletionCreateParamsNonStreaming);
    } catch (err) {
      throw new OpenAiApiError(`Request to OpenAI API Failed. ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
