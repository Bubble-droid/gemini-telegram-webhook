// src/utils/index.ts

import { Recognizer } from './recognizer';
import { KvNamespace } from './KvNamespace';
import { SimpleFormatter } from './helpers';
import type { Blob } from '@google/genai';

export * from './helpers';
export * from './error_notification';
export * from './github_api';
export * from './scheduler_task';
export * from './rate_limiter';
export * from './http_client';

export const handleOCR = async (fileData: Blob): Promise<string | null> => {
  const recognizer = new Recognizer(fileData);
  return recognizer.process();
};

const simpleFormatter: SimpleFormatter = new SimpleFormatter();

export const toHtml = (markdownText: string): string => {
  return simpleFormatter.toHtml(markdownText);
};

export const toMarkdownV2 = (markdownText: string): string => {
  return simpleFormatter.toMarkdownV2(markdownText);
};

export const kv: KvNamespace = new KvNamespace();
