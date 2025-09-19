// src/utils/rate_limiter.ts

import { config, Log } from '@/services';
import { kv } from '@/utils';

const DEFAULT_RETRY_SECONDS = 60;

/**
 * 记录用户操作的时间戳到 KV 存储。
 * @param {string} namespaceId - Cloudflare Workers KV Namespace 绑定。
 * @param {string} keyName - 用于存储时间戳的 KV 键名（例如，用户 ID）。
 * @param {number} timestamp - 要记录的时间戳（毫秒）。
 * @returns {Promise<void>}
 */
const recordTimestamp = async (namespaceId: string, keyName: string, timestamp: number): Promise<void> => {
  // KV 存储的值必须是字符串或 ArrayBuffer
  await kv.write(namespaceId, keyName, timestamp.toString());
};

/**
 * 从 KV 存储获取用户上次操作的时间戳。
 * @param {string} namespaceId - Cloudflare Workers KV Namespace 绑定。
 * @param {string} keyName - 用于存储时间戳的 KV 键名。
 * @returns {Promise<number|null>} - 返回时间戳（毫秒）或 null（如果不存在或无效）。
 */
const getTimestamp = async (namespaceId: string, keyName: string): Promise<number | null> => {
  const timestampStr = await kv.read<string>(namespaceId, keyName, 'text');
  if (timestampStr.success) {
    const timestamp: number = parseInt(timestampStr.data, 10);
    // 检查解析结果是否是有效的数字
    if (!isNaN(timestamp)) {
      return timestamp;
    } else {
      // 如果 KV 中存储的值不是有效的数字，记录警告并视为不存在时间戳
      Log.warn(`KV 中键 ${keyName} 存储了无效的时间戳: ${timestampStr}`);
      return null;
    }
  }
  return null;
};

type RateLimiterCheckResult = NotRateLimit | HasRateLimiter;

interface NotRateLimit {
  canProceed: true;
}

interface HasRateLimiter {
  canProceed: false;
  retryAfterSeconds: number;
}

/**
 * 检查自上次操作以来是否已间隔指定的分钟数，并返回是否可以继续操作以及（如果不能）冷却剩余秒数。
 * @param {number} chatId - 用于标识用户的唯一 ID。
 * @returns {Promise<RateLimiterCheckResult>} - 返回一个对象，包含 canProceed 状态和（如果 canProceed 为 false）冷却剩余秒数。
 */
const rateLimiterCheck = async (chatId: number): Promise<RateLimiterCheckResult> => {
  const { rateLimitId: namespaceId, requestIntervalSecond: intervalSecond } = config.load();
  const keyName: string = `rate_limit_${chatId}`; // 使用更具描述性的键前缀
  const now: number = Date.now();
  const intervalMilliseconds = intervalSecond * 1000;

  try {
    const lastTimestamp = await getTimestamp(namespaceId, keyName);

    if (lastTimestamp === null || now - lastTimestamp >= intervalMilliseconds) {
      // 如果是首次操作或已间隔足够时间，则记录当前时间戳并允许操作
      await recordTimestamp(namespaceId, keyName, now);
      return { canProceed: true };
    } else {
      // 计算冷却剩余秒数
      const elapsedMilliseconds = now - lastTimestamp;
      const remainingMilliseconds = intervalMilliseconds - elapsedMilliseconds;
      // 确保剩余时间不为负数，避免潜在的时间漂移问题
      const safeRemainingMilliseconds = Math.max(0, remainingMilliseconds);
      // 将剩余毫秒数转换为秒数并向上取整
      const retryAfterSeconds = Math.ceil(safeRemainingMilliseconds / 1000);

      return { canProceed: false, retryAfterSeconds };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // 捕获 KV 操作中可能出现的错误
    Log.error(`限流器错误 (键: ${keyName}):`, { err: errorMessage });
    // 如果发生错误，拒绝请求并提供默认重试时间，以防止在 KV 服务中断时被滥用
    return { canProceed: false, retryAfterSeconds: DEFAULT_RETRY_SECONDS };
  }
};

export { rateLimiterCheck };
