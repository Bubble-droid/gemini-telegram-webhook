// src/utils/recognizer.ts

import { geminiApi } from '@/services';
import { logger } from '@/services/LoggerService';
import { promptStore } from '@/utils';
import type { BlobImageUnion, Content, GenerateContentConfig } from '@google/genai';

class Recognizer {
  private model = 'gemma-3-27b-it';

  /**
   * 公共入口：处理图片
   */
  public async handle(fileData: BlobImageUnion): Promise<string | null> {
    const prompt = promptStore.get('ocr');

    const config: GenerateContentConfig = {
      temperature: 1,
    };

    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            inlineData: fileData,
          },
          {
            text: `Just recognize the text in the image, do not provide any explanation.`,
          },
        ],
      },
    ];

    try {
      const result = await geminiApi.generate(contents, {
        genModel: this.model,
        genConfig: config,
        onRetry: () => {
          logger.warn('[Recognizer] Retrying...');
        },
      });

      return result.text as string;
    } catch (err) {
      logger.error(`[Recognizer] 图片识别失败`, { err });
      return null;
    }
  }
}

export const recognizer = new Recognizer();
