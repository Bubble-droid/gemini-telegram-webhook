// src/utils/helpers.ts

import { formatter, splitAstAndGenerateChunks } from '@/utils/formatters';

export const toHtml = (text: string): string => {
  const ast = formatter.parse(text);
  const generator = formatter.getGenerator('HTML');
  const chunks = splitAstAndGenerateChunks(ast, generator);
  return chunks.join('');
};

export const toMarkdownV2 = (text: string): string => {
  const ast = formatter.parse(text);
  const generator = formatter.getGenerator('MarkdownV2');
  const chunks = splitAstAndGenerateChunks(ast, generator);
  return chunks.join('');
};

// 提前实例化 Formatter，避免每次调用重新创建 (性能优化)
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

/**
 * 将时间格式化为 UTC+8 时间
 */
export const formatTime = (time: Date | number = Date.now()): string => {
  const timeDate = typeof time === 'number' ? new Date(time) : time;

  const parts = timeFormatter.formatToParts(timeDate).reduce(
    (acc, { type, value }) => {
      if (type !== 'literal') acc[type] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC+8`;
};

/**
 * 异步暂停
 */
export const sleep = (delayMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

/**
 * 数组轮换
 */
export const rotateArray = <T>(arr: readonly T[], steps: number = 1, direction: 'left' | 'right' = 'left'): T[] => {
  const len = arr.length;
  if (len === 0) return [];

  let actualSteps = Math.abs(steps) % len;

  if (direction === 'right' || steps < 0) {
    actualSteps = (len - actualSteps) % len;
  }

  // 使用 Array.slice 性能通常优于循环 push
  return [...arr.slice(actualSteps), ...arr.slice(0, actualSteps)];
};

/**
 * 截断长字符串
 */
export const shortenString = (input: string): string => {
  const MAX = 4096;
  const HEAD = 2040;
  const TAIL = 2040;

  const chars = [...input];

  if (chars.length <= MAX) return input;

  const headPart = chars.slice(0, HEAD).join('');
  const tailPart = chars.slice(chars.length - TAIL).join('');
  return `${headPart}\n...\n${tailPart}`;
};

/**
 * 深度克隆 (使用原生 structuredClone 替代 JSON hack)
 * 支持 Date, Set, Map, RegExp 等类型，且性能更好
 */
export const deepClone = <T>(obj: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // 回退方案 (仅当 Node 版本极低时)
  return JSON.parse(JSON.stringify(obj));
};
