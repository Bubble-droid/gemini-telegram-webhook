// src/types/common.d.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface FaqItem {
  keywordGroups: string[][];
  excludeKeywords?: string[][];
  answer: string;
}

export type Recordable<T = unknown> = Record<string, T>;

export type MaybePromise<T> = T | Promise<T>;
