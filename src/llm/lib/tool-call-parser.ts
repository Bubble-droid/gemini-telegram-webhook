import type { FunctionCall } from '@google/genai';
import { DataError } from '@shared/core/errors.js';
import type { Recordable } from '@shared/types/common.js';

const REGEX_TAG = /<tool_calls>(?<content>[\s\S]*?)<\/tool_calls>/gi;
const REGEX_CODE_BLOCK = /`{3,6}(?:\w+)?\n?(?<content>[\s\S]+?)\n?`{3,6}/g;
const REGEX_RAW_ARRAY = /\[\s*\{[\s\S]*"name"[\s\S]*"args"[\s\S]*\}\s*\]/gs;

export const parseToolCalls = (input: string): FunctionCall[] => {
  const results: FunctionCall[] = [];

  const tagMatches = [...input.matchAll(REGEX_TAG)];
  for (const match of tagMatches) {
    const content = match.groups?.['content'];
    if (content) {
      try {
        const cleaned = stripMarkdownHooks(content);
        const parsed = JSON.parse(cleaned) as unknown;
        if (isValidToolCallArray(parsed)) {
          results.push(...parsed);
        }
      } catch {
        continue;
      }
    }
  }

  const blockMatches = [...input.matchAll(REGEX_CODE_BLOCK)];
  for (const match of blockMatches) {
    const content = match.groups?.['content'];
    if (content) {
      try {
        const parsed = JSON.parse(content.trim()) as unknown;
        if (isValidToolCallArray(parsed)) {
          results.push(...parsed);
        }
      } catch {
        continue;
      }
    }
  }

  const rawMatches = [...input.matchAll(REGEX_RAW_ARRAY)];
  for (const match of rawMatches) {
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (isValidToolCallArray(parsed)) {
        results.push(...parsed);
      }
    } catch {
      continue;
    }
  }

  const uniqueCall = new Map<string, FunctionCall>();
  results.forEach((call) => {
    const { name, args } = call;
    const key = JSON.stringify({ name, args });
    if (!uniqueCall.has(key)) {
      uniqueCall.set(key, call);
    }
  });

  if (uniqueCall.size > 0) {
    return [...uniqueCall.values()];
  }

  throw new DataError('Could not find any valid ToolCall array in the provided input.');
};

const isValidToolCallArray = (data: unknown): data is FunctionCall[] => {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;

  return data.every((item) => {
    const isObject = typeof item === 'object' && item !== null;
    if (!isObject) return false;

    const candidate = item as Recordable;
    const hasRequiredFields =
      typeof candidate['name'] === 'string' && typeof candidate['args'] === 'object' && candidate['args'] !== null;

    if (!hasRequiredFields) {
      throw new DataError(`Invalid ToolCall structure: ${JSON.stringify(item)}`);
    }
    return true;
  });
};

const stripMarkdownHooks = (text: string): string => {
  return text
    .trim()
    .replace(/^`{3,6}(?:\w+)?\n?([\s\S]+?)\n?`{3,6}$/, '$1')
    .trim();
};
