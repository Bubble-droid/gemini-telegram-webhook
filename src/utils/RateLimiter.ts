// src/utils/rate_limiter.ts

import { config, logger } from '@/services'; // 假设 logger 是 Log 的实例或别名

const DEFAULT_RATE_LIMIT = 20 * 1000;
// 清理周期：每 5 分钟清理一次过期数据
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface NotRateLimit {
  canProceed: true;
}

interface HasRateLimiter {
  canProceed: false;
  retryAfterSeconds: number;
}

type RateLimiterCheckResult = NotRateLimit | HasRateLimiter;

class RateLimiter {
  private readonly rateLimit = config.requestRateLimit || DEFAULT_RATE_LIMIT;
  // 直接使用 number 作为 key，减少字符串 GC 压力
  private timestampMap = new Map<number, number>();

  constructor() {
    // 启动定期清理任务，防止内存泄漏
    setInterval(() => {
      this.pruneExpiredEntries();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * 检查是否允许操作
   * @param uniqueId
   */
  public check(uniqueId: number): RateLimiterCheckResult {
    const now = Date.now();

    try {
      const lastTimestamp = this.timestampMap.get(uniqueId);

      // 情况1: 无记录 (新用户/已过期) 或 间隔时间已够
      if (!lastTimestamp || now - lastTimestamp >= this.rateLimit) {
        this.timestampMap.set(uniqueId, now);
        return { canProceed: true };
      }

      // 情况2: 处于冷却期
      else {
        const remainingMs = this.rateLimit - (now - lastTimestamp);
        // 向上取整，给用户更友好的提示 (比如剩余 0.1秒 显示为 1秒)
        const retryAfterSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);

        return { canProceed: false, retryAfterSeconds };
      }
    } catch (err) {
      // 兜底逻辑：如果限流器自身出错，为了安全起见，通常选择“阻断”或者“放行”
      // 这里选择阻断并让用户稍后重试
      logger.warn(`限流器异常 (ID: ${uniqueId}):`, { err });
      return { canProceed: false, retryAfterSeconds: DEFAULT_RATE_LIMIT / 1000 };
    }
  }

  /**
   * 获取当前缓存大小 (用于监控)
   */
  public size(): number {
    return this.timestampMap.size;
  }

  /**
   * 清理过期的键值对，释放内存
   */
  private pruneExpiredEntries(): void {
    const now = Date.now();
    let deletedCount = 0;

    // Map 迭代器性能很好，可以直接遍历
    for (const [key, timestamp] of this.timestampMap) {
      if (now - timestamp > this.rateLimit) {
        this.timestampMap.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug(`[RateLimiter] 自动清理: 移除了 ${deletedCount} 个过期记录`);
    }
  }
}

export const rateLimiter = new RateLimiter();
