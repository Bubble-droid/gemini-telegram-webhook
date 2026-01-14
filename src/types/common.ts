// src/types/common.d.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface FaqItem {
  keywordGroups: string[][];
  excludeKeywords?: string[][];
  answer: string;
}

export type Recordable<T = unknown> = Record<string, T>;

export type MaybePromise<T> = T | Promise<T>;

export type Evaluate<T> = T extends object ? (T extends infer O ? { [K in keyof O]: Evaluate<O[K]> } : never) : T;

export type ExtractMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
