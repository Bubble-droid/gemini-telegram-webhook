// src/utils/helpers.ts

import { fileHandler } from '@/handlers';
import { logger } from '@/services';
import type { Message } from '@/types';
import { formatter, splitAstAndGenerateChunks } from '@/utils/formatters';
import type { Part } from '@google/genai';

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
export const formatTime = (time: Date | number | string, pattern: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  const date: Date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    console.warn(`[TimeFormatter] Received invalid date: ${String(time)}`);
    return 'Invalid Date';
  }

  // --- 1. 格式化日期时间部分 (YYYY-MM-DD HH:mm:ss) ---
  const partsStr = timeFormatter.format(date);

  const tokenMap: Readonly<Record<string, string>> = {
    YYYY: partsStr.substring(0, 4),
    MM: partsStr.substring(5, 7),
    DD: partsStr.substring(8, 10),
    HH: partsStr.substring(11, 13),
    mm: partsStr.substring(14, 16),
    ss: partsStr.substring(17, 19),
  };

  const timeStr = pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => tokenMap[match]);

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

  return JSON.parse(JSON.stringify(obj));
};

/**
 * 并发处理消息中的媒体文件
 * @param messages 消息数组
 * @param predicate 过滤函数，用于判断消息是否包含需要处理的文件 (如 isContainsImage 或 isContainsFile)
 * @returns Promise<Part[]> Gemini 的 Part 数组
 */
export const handleMediaFiles = async (messages: Message[], predicate: (msg: Message) => boolean): Promise<Part[]> => {
  // 1. 过滤并映射为 Promise 数组
  const mediaPromises = messages.filter(predicate).map(async (msg) => {
    try {
      const fileData = await fileHandler.handle(msg);
      return fileData ? { inlineData: fileData } : null;
    } catch (err) {
      logger.error('Failed to process media file:', { err, msgId: msg.message_id });
      return null;
    }
  });

  if (mediaPromises.length === 0) {
    return [];
  }

  // 2. 并发执行所有下载/转换任务
  const results = await Promise.all(mediaPromises);

  return results.filter((r) => !!r);
};
