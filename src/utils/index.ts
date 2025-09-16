// src/utils/index.ts

import { Recognizer } from './recognizer';
import type { Blob } from '@google/genai';

export * from './helpers';
export * from './error_notification';
export * from './github_api';
export * from './scheduler_task';
export * from './KvNamespace';
export * from './rate_limiter';
export * from './http_client';

export const handleOCR = async (fileData: Blob): Promise<string | null> => {
  const recognizer = new Recognizer(fileData);
  return recognizer.process();
};
