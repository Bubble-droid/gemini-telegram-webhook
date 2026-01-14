import { DATA_DIR } from '@/configs/data';
import { logger } from '@/services';
import { bot } from '@/services/apis';
import type { ApiMethod, ApiParams, Recordable } from '@/types';
import { deepClone, formatTime, generateUniqueId } from '@/utils';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from './errors';

/**
 * LowDB 存储结构定义
 */
interface TaskItem {
  id: string; // 使用 UUID
  action: ApiMethod;
  params: unknown; // 存储实际的 JSON 对象
  signature: string; // 用于去重的唯一签名 (Canonical JSON String)
  dueAt: number;
}

interface DatabaseSchema {
  tasks: TaskItem[];
}

const TASK_FILE_PATH = path.join(DATA_DIR, 'tasks.json');
const DEFAULT_TASK_DATA = { tasks: [] };

const isRecord = (val: unknown): val is Recordable => {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
};

/**
 * 递归地对对象键进行排序，确保 JSON.stringify 输出一致性
 * 解决 {a:1, b:2} !== {b:2, a:1} 导致无法去重的问题
 */
const canonicalizeParams = (obj: unknown): unknown => {
  // 1. 处理非对象或空值
  if (!isRecord(obj)) {
    if (Array.isArray(obj)) {
      return obj.map(canonicalizeParams);
    }
    return obj;
  }

  // 2. 处理对象：提取条目 -> 排序键 -> 递归处理值 -> 还原为对象
  const sortedEntries = Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, canonicalizeParams(value)]);

  return Object.fromEntries(sortedEntries);
};

class TaskScheduler {
  private db: LowSync<DatabaseSchema>;
  private nextTaskTimer: NodeJS.Timeout | null = null;
  private currentTimerTargetTime: number | null = null;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const adapter = new JSONFileSync<DatabaseSchema>(TASK_FILE_PATH);
    this.db = new LowSync(adapter, DEFAULT_TASK_DATA);

    this.db.read();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.db.data) {
      this.db.data = DEFAULT_TASK_DATA;
      this.db.write();
    }

    this.refreshSchedule();

    logger.info('[TaskScheduler] LowDB initialized, task queue loaded.');
  }

  /**
   * 公共核心接口：添加任务
   */
  public schedule<M extends ApiMethod>(action: M, params: ApiParams<M>, delayMs: number) {
    const dueAt = Date.now() + delayMs;

    // 1. 规范化参数对象（排序 Key），保证字符串唯一性
    const canonicalParams = canonicalizeParams(params);
    const signature = JSON.stringify(canonicalParams);

    // 2. 执行 Upsert 逻辑 (模拟 SQL ON CONFLICT DO UPDATE)
    const tasks = this.db.data.tasks;
    const existingIndex = tasks.findIndex((t) => t.action === action && t.signature === signature);

    if (existingIndex !== -1 && tasks[existingIndex]) {
      // 更新现有任务的执行时间
      tasks[existingIndex].dueAt = dueAt;
    } else {
      // 插入新任务
      tasks.push({
        id: this.generateId(),
        action,
        params: canonicalParams,
        signature,
        dueAt,
      });
    }

    this.db.write();
    this.refreshSchedule();

    logger.debug(`[TaskScheduler] Task scheduled: ${action}, Due: ${formatTime(dueAt)}`, { params });
  }

  // ================= 业务封装方法 =================

  public deleteMessage(params: ApiParams<'deleteMessage'>, delayMs: number) {
    this.schedule('deleteMessage', params, delayMs);
  }

  public deleteMessages(params: ApiParams<'deleteMessages'>, delayMs: number) {
    const paramsCopy = deepClone(params);
    paramsCopy.message_ids = [...new Set(paramsCopy.message_ids)];
    if (paramsCopy.message_ids.length === 0) return;

    paramsCopy.message_ids.sort((a, b) => a - b);

    this.schedule('deleteMessages', paramsCopy, delayMs);
  }

  private refreshSchedule() {
    try {
      // 获取最早需要执行的任务 (模拟 ORDER BY due_at ASC LIMIT 1)
      const nextTask = this.getNextTask();

      if (!nextTask) {
        if (this.nextTaskTimer) {
          clearTimeout(this.nextTaskTimer);
          this.nextTaskTimer = null;
          this.currentTimerTargetTime = null;
        }
        return;
      }

      // 如果当前定时器已经对准了这个时间，则无需重置
      if (this.nextTaskTimer && this.currentTimerTargetTime === nextTask.dueAt) {
        return;
      }

      if (this.nextTaskTimer) {
        clearTimeout(this.nextTaskTimer);
      }

      const now = Date.now();
      const delay = Math.max(0, nextTask.dueAt - now);
      this.currentTimerTargetTime = nextTask.dueAt;

      const MAX_DELAY = 2147483647; // 32-bit signed int max
      const safeDelay = Math.min(delay, MAX_DELAY);

      this.nextTaskTimer = setTimeout(() => {
        void this.processDueTasks();
      }, safeDelay);

      if (delay > MAX_DELAY) {
        logger.warn(`[TaskScheduler] Task ID:${nextTask.id} delay exceeds limit, deferred.`);
      }
    } catch (err) {
      logger.error('[TaskScheduler] Refresh schedule failed', { err });
    }
  }

  private async processDueTasks() {
    this.nextTaskTimer = null;
    this.currentTimerTargetTime = null;

    const now = Date.now();

    // 获取所有到期任务 (模拟 WHERE due_at <= ?)
    // 注意：这里需要复制数组，因为后续我们会修改 db.data.tasks
    const allTasks = this.db.data.tasks;
    const dueTasks = allTasks.filter((t) => t.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);

    for (const task of dueTasks) {
      const { id, action, params } = task;
      try {
        const result = await this.executeTask(action, params);
        if (!result.ok) throw new AppError(result.error);
      } catch (err) {
        logger.error(`[TaskScheduler] Task execution failed ID:${id}`, { action, err });
      } finally {
        // 模拟 DELETE FROM tasks WHERE id = ?
        this.deleteTask(id);
      }
    }

    // 写入更改并刷新调度
    this.db.write();
    this.refreshSchedule();
  }

  private executeTask(action: ApiMethod, params: unknown) {
    logger.debug(`[TaskScheduler] Executing: ${action}`, { params });

    return bot.requestJson(action, params as ApiParams<ApiMethod>);
  }

  /**
   * 辅助：获取队列中最早的任务
   */
  private getNextTask(): TaskItem | undefined {
    if (this.db.data.tasks.length === 0) return undefined;

    // O(N) 查找最小值，对于任务队列通常足够快
    return this.db.data.tasks.reduce((prev, curr) => {
      return prev.dueAt < curr.dueAt ? prev : curr;
    });
  }

  /**
   * 辅助：根据 ID 删除任务
   */
  private deleteTask(id: string): void {
    const index = this.db.data.tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.db.data.tasks.splice(index, 1);
    }
  }

  /**
   * 辅助：生成唯一 ID
   */
  private generateId(): string {
    return generateUniqueId();
  }
}

export const taskScheduler = new TaskScheduler();
