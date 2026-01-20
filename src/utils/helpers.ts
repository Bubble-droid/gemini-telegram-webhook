import type { Recordable } from '@/types';
import { randomUUID } from 'node:crypto';

// 1. 用于格式化 YYYY-MM-DD HH:mm:ss 部分 (使用 'sv-SE' + 'Asia/Shanghai' 确保 ISO 格式)
const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// 2. 用于获取中文星期几 (使用 'zh-CN' + 'Asia/Shanghai' 确保中文输出)
const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short', // 例如: '周一', '周二', ..., '周日'
});

/**
 * 将时间格式化为指定的 UTC+8 格式，并包含中文小写数字的星期几。
 *  @param time 要格式化的时间 (Date | number | string)
 * @param pattern 格式化模板 (默认: 'YYYY-MM-DD HH:mm:ss')
 * @returns 格式化后的时间字符串 (例如: '2025-12-10 15:34:10 周幺 UTC+8')
 */
export const formatTime = (time: Date | number | string, pattern = 'YYYY-MM-DD HH:mm:ss'): string => {
  const date: Date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    console.warn(`[TimeFormatter] Received invalid date: ${String(time)}`);
    return 'Invalid Date';
  }

  // --- 1. 格式化日期时间部分 (YYYY-MM-DD HH:mm:ss) ---
  const partsStr = timeFormatter.format(date);

  const tokenMap: Recordable<string> = {
    YYYY: partsStr.substring(0, 4),
    MM: partsStr.substring(5, 7),
    DD: partsStr.substring(8, 10),
    HH: partsStr.substring(11, 13),
    mm: partsStr.substring(14, 16),
    ss: partsStr.substring(17, 19),
  };

  const timeStr = pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => tokenMap[match] ?? '');

  // --- 2. 获取并转换星期几部分 ---
  const weekdayStrLarge = weekdayFormatter.format(date);

  return `${timeStr} ${weekdayStrLarge} UTC+8`;
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
  const MAX = 4096;
  const HEAD = 2020;
  const TAIL = 2020;

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
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }

  return JSON.parse(JSON.stringify(obj)) as T;
};

export const generateUuid = (): string => {
  return randomUUID();
};

export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const MsgPTTL = {
  '3m': 3 * MIN,
  '5m': 5 * MIN,
  '10m': 10 * MIN,
  '1d': 1 * DAY,

  sec: (seconds: number): number => seconds * SEC,
  min: (minutes: number): number => minutes * MIN,
  hour: (hours: number): number => hours * HOUR,
  day: (days: number): number => days * DAY,
} as const;
