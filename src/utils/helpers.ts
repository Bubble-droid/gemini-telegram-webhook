// src/utils/helpers.ts

import { randomBytes } from 'node:crypto';
import * as lame from '@breezystack/lamejs';

/**
 * 将时间格式化为 UTC+8 时间
 * @param {Date|number} time 时间对象或时间戳（毫秒），默认为当前时间
 * @returns {string} 格式化后的时间字符串 (YYYY-MM-DD HH:mm:ss UTC+8)
 */
export const formatTime = (time: Date | number = Date.now()): string => {
  // 确保 time 是 Date 对象
  const timeDate: Date = typeof time === 'number' ? new Date(time) : time;

  // 使用 Intl.DateTimeFormat 进行格式化，指定时区为 'Asia/Shanghai' (UTC+8)
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 使用24小时制
    timeZone: 'Asia/Shanghai',
  });

  // 使用 reduce 更简洁地从 formatToParts 中提取日期时间部分
  const parts = formatter.formatToParts(timeDate).reduce(
    (acc, { type, value }) => {
      if (type !== 'literal') {
        acc[type] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  ); // 使用类型断言确保 acc 的类型

  // 拼接成目标格式字符串
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC+8`;
};

/**
 * 生成指定长度的16进制字符串 (加密安全)。
 * 此函数依赖 Node.js 的 `crypto` 模块。
 * @param {number} [length=16] 需要生成的字符串长度。必须是非负数。
 * @returns {string} 生成的16进制字符串。
 * @throws {Error} 如果 length 为负数。
 */
export const secureHex = (length: number = 16): string => {
  // 计算所需的字节长度，向上取整以确保能生成足够长的16进制字符
  const byteLength: number = Math.ceil(length / 2);
  // 生成随机字节，转换为16进制字符串，然后截取到指定长度
  return randomBytes(byteLength).toString('hex').slice(0, length);
};

/**
 * 异步暂停指定毫秒数。
 * 此函数返回一个 Promise，该 Promise 在指定延迟后解析。
 * 它可以用于在异步函数中引入延迟，避免阻塞主线程。
 *
 * @param {number} delayMs - 延迟的毫秒数。必须是非负数。
 * @returns {Promise<void>} 一个 Promise，该 Promise 在 `delayMs` 毫秒后解析。
 * @throws {Error} 如果 delayMs 为负数。
 */
export const sleep = async (delayMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

/**
 * 通用数组轮换器（不改变原数组，返回新数组）
 * @param arr 源数组（支持任意元素）
 * @param steps 轮换步数（默认 1）。若为负数，等价于相反方向的正数。
 * @param direction 'left' | 'right'（默认 'left'）。指定轮换方向。
 * @returns 轮换后的新数组
 */
export const rotateArray = <T>(arr: readonly T[], steps: number = 1, direction: 'left' | 'right' = 'left'): T[] => {
  const len = arr.length;
  if (len === 0) return []; // 空数组直接返回空数组

  // 计算实际的轮换步数，取绝对值并模数组长度，确保步数在 [0, len-1] 范围内
  let actualSteps = Math.abs(steps) % len;

  // 根据方向和原始 steps 的正负，统一转换为“向左轮换”的等效步数
  // 如果是向右轮换，或者原始 steps 为负数（表示反方向），则将步数调整为向左轮换的等效步数
  if (direction === 'right' || steps < 0) {
    actualSteps = (len - actualSteps) % len; // N 步右旋等价于 (len - N) 步左旋
  }

  // 执行左轮换：将数组从 actualSteps 位置分割，然后拼接
  return arr.slice(actualSteps).concat(arr.slice(0, actualSteps));
};

export const sampleByShuffle = <T>(arr: readonly T[], k: number = 3): T[] => {
  if (k <= 0) return [];
  if (k >= arr.length) return arr.slice();
  const a = arr.slice(); // 复制一份不修改原数组
  // 完整洗牌（也可做部分洗牌以优化，但这里简单明了）
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
};

/**
 * @param input 要简化的字符串
 * @returns 简化后的字符串或原字符串
 */
export const shortenString = (input: string): string => {
  const MAX = 4096;
  const HEAD = 2000;
  const TAIL = 2000;

  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }

  // 使用 Array.from 保持对 Unicode 代码点（包括 emoji）的正确处理
  const chars = getUTF8Byte(input);

  if (chars.length <= MAX) return input;

  const headPart = chars.slice(0, HEAD).join('');
  const tailPart = chars.slice(chars.length - TAIL).join('');
  return `${headPart}\n\n......\n\n${tailPart}`;
};

/**
 * 计算字符串的 UTF-8 字节数
 * @param {string} str 需要计算的字符串
 * @returns {Uint8Array} 字符串的 UTF-8 字节数
 */
export function getUTF8Byte(str: string): Uint8Array {
  // 使用 TextEncoder API 来获取字符串的 UTF-8 编码字节数
  // TextEncoder 是一个 Web API，在 Node.js 中也可以使用
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  return encoded;
}

/**
 * 将 Gemini API 返回的原始 PCM (s16le, 24000Hz, 单声道) Buffer 转换为 MP3 Buffer。
 *
 * @param {Buffer} pcmBuffer 原始 PCM 音频数据的 Buffer。
 * @returns 包含 MP3 格式音频数据的 Promise<Buffer>。
 */
export const convertPcmToMp3 = async (pcmBuffer: Buffer): Promise<Buffer> => {
  const sampleRate = 24000; // Gemini API 返回的采样率
  const channels = 1; // Gemini API 返回的声道数 (单声道)
  const kbps = 128; // MP3 编码的比特率，可根据需求调整

  // 创建 MP3 编码器
  const mp3encoder = new lame.Mp3Encoder(channels, sampleRate, kbps);

  // 将 Node.js Buffer 转换为 Int16Array
  // `pcmBuffer.buffer` 获取底层的 ArrayBuffer，`pcmBuffer.byteOffset` 和 `pcmBuffer.length / 2`
  // 用于确保视图正确地指向 PCM 数据。
  const pcm16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

  const mp3Data: Buffer[] = [];
  // MP3 编码通常以 1152 个样本为一帧
  const samplesPerFrame = 1152;

  // 分块编码 PCM 数据
  for (let i = 0; i < pcm16.length; i += samplesPerFrame) {
    const chunk = pcm16.subarray(i, i + samplesPerFrame);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(Buffer.from(mp3buf));
    }
  }

  // 刷新编码器以获取剩余的数据
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(Buffer.from(mp3buf));
  }

  return Buffer.concat(mp3Data);
};
