import { type ThinkingConfig } from '@google/genai';
import type { OpenAiClientParams } from '@llm/types/agent.js';
import { OpenAiApiError } from '@shared/core/errors.js';
import { ms } from '@shared/utils/helpers.js';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';
import type { ChatCompletion } from 'openai/resources.js';

interface ExtraGoogleParams {
  google: {
    thinking_config: {
      include_thoughts?: ThinkingConfig['includeThoughts'];
      thinking_level?: ThinkingConfig['thinkingLevel'];
      thinking_budget?: ThinkingConfig['thinkingBudget'];
    };
  };
}

interface BaseParams extends OpenAiClientParams {
  extra_body?: ExtraGoogleParams;
}

export class OpenAiClient {
  private client: OpenAI;
  private baseParams: BaseParams;

  constructor(apiKey: string, baseURL: string, baseParams: BaseParams) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: ms.min(5),
    });
    this.baseParams = baseParams;
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
      });
    } catch (err) {
      throw new OpenAiApiError(`Failed to request to OpenAI API. ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
