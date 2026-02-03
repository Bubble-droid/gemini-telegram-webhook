import { CONFIG } from '@shared/core/config';
import { DAY, GITHUB_RAW_URL, HOUR, MIN, SEC } from '@shared/core/constants';
import { logger } from '@shared/core/logger';
import type { Recordable } from '@shared/types/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * 将时间格式化为指定的 UTC+8 格式，并包含中文小写数字的星期几。
 *  @param time 要格式化的时间 (Date | number | string)
 * @param pattern 格式化模板 (默认: 'YYYY-MM-DD HH:mm:ss')
 * @returns 格式化后的时间字符串 (例如: '2025-12-10 15:34:10 周幺 UTC+8')
 */
export const formatTime = (time: Date | number | string, pattern = 'YYYY-MM-DD HH:mm:ss'): string => {
  const date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    logger.warn(`[TimeFormatter] Received invalid date: ${String(time)}`);
    return 'Invalid Date';
  }

  const partsStr = date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const tokenMap: Recordable<string> = {
    YYYY: partsStr.substring(0, 4),
    MM: partsStr.substring(5, 7),
    DD: partsStr.substring(8, 10),
    HH: partsStr.substring(11, 13),
    mm: partsStr.substring(14, 16),
    ss: partsStr.substring(17, 19),
  };

  const timeStr = pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => tokenMap[match] ?? '');

  const weekdayStrLarge = date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  });

  return `${timeStr} ${weekdayStrLarge} UTC+8`;
};

/**
 * 异步暂停
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 数组轮换
 */
export const rotateArray = <T>(arr: readonly T[], steps = 1, direction: 'left' | 'right' = 'left'): T[] => {
  const len = arr.length;
  if (len === 0) return [];

  let actualSteps = Math.abs(steps) % len;

  if (direction === 'right' || steps < 0) {
    actualSteps = (len - actualSteps) % len;
  }

  return [...arr.slice(actualSteps), ...arr.slice(0, actualSteps)];
};

/**
 * 截断长字符串
 */
export const shortenString = (input: string): string => {
  const MAX = 4000;
  const HEAD = 2000;
  const TAIL = 2000;

  const chars = [...input];

  if (chars.length <= MAX) return input;

  const headPart = chars.slice(0, HEAD).join('');
  const tailPart = chars.slice(chars.length - TAIL).join('');
  return `${headPart}\n\n......\n\n${tailPart}`;
};

/**
 * 深度克隆，支持 Date, Set, Map, RegExp 等类型
 */
export const deepClone = <T>(obj: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj)) as T;
};

export const generateUuid = (): string => {
  return randomUUID();
};

export const ms = {
  '3m': 3 * MIN,
  '5m': 5 * MIN,
  '10m': 10 * MIN,
  '1d': 1 * DAY,

  sec: (seconds: number): number => seconds * SEC,
  min: (minutes: number): number => minutes * MIN,
  hour: (hours: number): number => hours * HOUR,
  day: (days: number): number => days * DAY,
} as const;

export const readTextFile = (path: string): Promise<string> => {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  logger.info(`Reading text from file ${path}`);
  return readFile(path, 'utf-8');
};

export const writeTextFile = async (path: string, content: string) => {
  logger.info(`Writing text to file ${path}`);
  await writeFile(path, content, 'utf-8');
};

export const generateRawUrl = (path: string): string => {
  return `${GITHUB_RAW_URL}/${CONFIG.GITHUB_REPOSITORY}/refs/heads/main/${path.startsWith('/') ? path.slice(1) : path}`;
};

export const generateStrMask = (str: string, len: number, mask = '***'): string => {
  if (len <= 0) return mask;
  if (str.length <= len * 2) return str;
  return `${str.slice(0, len)}${mask}${str.slice(-len)}`;
};

export const invertObject = <T extends Record<PropertyKey, PropertyKey>>(
  obj: T | undefined,
): { [K in keyof T as T[K]]: K } => {
  if (!obj) return {} as { [K in keyof T as T[K]]: K };
  const inverted = Object.entries(obj).map(([key, value]) => [value, key]);
  return Object.fromEntries(inverted) as { [K in keyof T as T[K]]: K };
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const uniqueByProperty = <T, K extends keyof T>(list: T[], key: K): T[] => {
  const map = new Map<T[K], T>();
  for (const item of list) {
    const propertyValue = item[key];
    if (!map.has(propertyValue)) {
      map.set(propertyValue, item);
    }
  }
  return [...map.values()];
};
