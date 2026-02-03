import { type ThinkingConfig } from '@google/genai';
import { ApiError } from '@shared/core/errors';
import { ms } from '@shared/utils/helpers';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';
import type { ChatCompletion } from 'openai/resources.js';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.mjs';

interface ExtraGoogleParams {
  google: {
    thinking_config: {
      include_thoughts?: ThinkingConfig['includeThoughts'];
      thinking_level?: ThinkingConfig['thinkingLevel'];
      thinking_budget?: ThinkingConfig['thinkingBudget'];
    };
  };
}

interface BaseParams extends Omit<ChatCompletionCreateParamsBase, 'messages'> {
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
    params?: Omit<ChatCompletionCreateParamsBase, 'messages'>,
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
      throw new ApiError(`Failed to request to OpenAI API. ${err instanceof Error ? err.message : 'Unknown Error'}`);
    }
  }
}
