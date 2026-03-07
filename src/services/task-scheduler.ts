import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import type { ApiMethod, ApiParams } from '@shared/types/telegram.js';
import { deepClone, formatTime, generateUuid } from '@shared/utils/helpers.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import type { Redis } from '@upstash/redis';

interface TaskItem {
  id: string;
  action: ApiMethod;
  params: unknown;
  signature: string;
  dueAt: number;
}

const TASK_QUEUE_KEY = 'scheduler:queue';
const TASK_HASH_KEY = 'scheduler:data';

export class TaskScheduler {
  private nextTaskTimer: NodeJS.Timeout | null = null;
  private currentTimerTargetTime: number | null = null;
  private isProcessing = false;

  constructor(
    private readonly bot: TelegramBotApi,
    private readonly redisClient: Redis,
  ) {
    logger.info('[TaskScheduler] Upstash Redis initialized, task queue synchronized.');
  }

  public async schedule<M extends ApiMethod>(action: M, params: ApiParams<M>, delayMs: number): Promise<void> {
    const dueAt = Date.now() + delayMs;
    const canonicalParams = canonicalizeParams(params);
    const signature = JSON.stringify({ action, params: canonicalParams });

    const taskData: TaskItem = {
      id: generateUuid(),
      action,
      params: canonicalParams,
      signature,
      dueAt,
    };

    // Upsert to Redis using a pipeline for atomicity
    const pipeline = this.redisClient.pipeline();
    pipeline.hset(TASK_HASH_KEY, { [signature]: JSON.stringify(taskData) });
    pipeline.zadd(TASK_QUEUE_KEY, { score: dueAt, member: signature });
    await pipeline.exec();

    await this.refreshSchedule();
    logger.debug(`[TaskScheduler] Task scheduled: ${action}, Due: ${formatTime(dueAt)}`);
  }

  public async deleteMessage(params: ApiParams<'deleteMessage'>, delayMs: number): Promise<void> {
    await this.schedule('deleteMessage', params, delayMs);
  }

  public async deleteMessages(params: ApiParams<'deleteMessages'>, delayMs: number): Promise<void> {
    const paramsCopy = deepClone(params);
    paramsCopy.message_ids = [...new Set(paramsCopy.message_ids)];
    if (paramsCopy.message_ids.length === 0) return;
    paramsCopy.message_ids.sort((a, b) => a - b);
    await this.schedule('deleteMessages', paramsCopy, delayMs);
  }

  public async refreshSchedule(): Promise<void> {
    if (this.isProcessing) return;

    try {
      // Fetch the single earliest task in the sorted set
      const members = await this.redisClient.zrange<string[]>(TASK_QUEUE_KEY, 0, 0);

      if (members.length === 0) {
        if (this.nextTaskTimer) {
          clearTimeout(this.nextTaskTimer);
          this.nextTaskTimer = null;
          this.currentTimerTargetTime = null;
        }
        return;
      }

      const nextSignature = members[0]!;
      const scoreStr = await this.redisClient.zscore(TASK_QUEUE_KEY, nextSignature);
      if (!scoreStr) return;

      const dueAt = scoreStr;

      if (this.nextTaskTimer && this.currentTimerTargetTime === dueAt) {
        return;
      }

      if (this.nextTaskTimer) {
        clearTimeout(this.nextTaskTimer);
      }

      const now = Date.now();
      const delay = Math.max(0, dueAt - now);
      this.currentTimerTargetTime = dueAt;

      const MAX_DELAY = 2147483647;
      const safeDelay = Math.min(delay, MAX_DELAY);

      this.nextTaskTimer = setTimeout(() => {
        void this.processDueTasks();
      }, safeDelay);
    } catch (err) {
      logger.warn('[TaskScheduler] Refresh schedule failed', { err });
    }
  }

  private async processDueTasks(): Promise<void> {
    this.isProcessing = true;
    this.nextTaskTimer = null;
    this.currentTimerTargetTime = null;

    const now = Date.now();

    try {
      // Get all tasks where score (dueAt) <= now
      const dueSignatures = await this.redisClient.zrange<string[]>(TASK_QUEUE_KEY, 0, now, { byScore: true });

      if (dueSignatures.length > 0) {
        // Fetch full task payloads from the Hash
        const pipeline = this.redisClient.pipeline();
        dueSignatures.forEach((sig) => pipeline.hget<string>(TASK_HASH_KEY, sig));
        const rawTasks = await pipeline.exec<TaskItem[]>();

        for (let i = 0; i < dueSignatures.length; i++) {
          const rawTask = rawTasks[i];
          const signature = dueSignatures[i]!;

          if (!rawTask) continue;
          try {
            logger.info(`[TaskScheduler] Executing: ${rawTask.action}`);
            await this.bot.requestJson(rawTask.action, rawTask.params as ApiParams<ApiMethod>);
          } catch (err) {
            logger.warn(`[TaskScheduler] Task execution failed ID:${rawTask.id}`, { action: rawTask.action, err });
          } finally {
            // Delete processed tasks atomically
            const deletePipeline = this.redisClient.pipeline();
            deletePipeline.zrem(TASK_QUEUE_KEY, signature);
            deletePipeline.hdel(TASK_HASH_KEY, signature);
            await deletePipeline.exec();
          }
        }
      }
    } finally {
      this.isProcessing = false;
      await this.refreshSchedule();
    }
  }
}

const isRecord = (val: unknown): val is Recordable => {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
};

const canonicalizeParams = (obj: unknown): unknown => {
  if (!isRecord(obj)) {
    if (Array.isArray(obj)) return obj.map(canonicalizeParams);
    return obj;
  }

  const sortedEntries = Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, canonicalizeParams(value)]);

  return Object.fromEntries(sortedEntries);
};
