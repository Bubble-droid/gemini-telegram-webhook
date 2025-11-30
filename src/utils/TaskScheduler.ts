// src/services/TaskScheduler.ts

import { bot, logger } from '@/services';
import type * as Bot from '@/types/telegram';
import { formatTime } from '@/utils';
import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * 2. 任务注册表：建立 Action 字符串到 参数类型 的映射
 *    如果未来要加新功能，只需在这里添加一行即可。
 */
interface TaskRegistry {
  deleteMessage: Bot.DeleteMessageParams;
  deleteMessages: Bot.DeleteMessagesParams;
}

/**
 * 数据库行结构
 */
interface TaskRow {
  id: number;
  action: string; // 数据库里存的是字符串
  params: string; // JSON 字符串
  due_at: number;
}

/**
 * 递归地对对象键进行排序，确保 JSON.stringify 输出一致性
 * 解决 {a:1, b:2} !== {b:2, a:1} 导致无法去重的问题
 */
const canonicalizeParams = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeParams);
  }
  const sortedObj: Record<string, unknown> = {};
  Object.keys(obj as Record<string, unknown>)
    .sort()
    .forEach((key) => {
      sortedObj[key] = canonicalizeParams((obj as Record<string, unknown>)[key]);
    });
  return sortedObj;
};

class TaskScheduler {
  private db: Database.Database;
  private stmtUpsert: Database.Statement;
  private stmtGetNext: Database.Statement;
  private stmtDelete: Database.Statement;
  private stmtGetDue: Database.Statement;

  private nextTaskTimer: NodeJS.Timeout | null = null;
  private currentTimerTargetTime: number | null = null;

  constructor() {
    const dbDir = '/data';
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = `${dbDir}/tasks.db`;
    this.db = new Database(dbPath, {
      verbose: (msg) => logger.debug('[TaskScheduler]', { msg }),
    });

    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        params TEXT NOT NULL,
        due_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_task ON tasks(action, params);

      CREATE INDEX IF NOT EXISTS idx_due_at ON tasks(due_at);
    `);

    this.stmtUpsert = this.db.prepare(`
      INSERT INTO tasks (action, params, due_at)
      VALUES (@action, @params, @dueAt)
      ON CONFLICT(action, params)
      DO UPDATE SET due_at = excluded.due_at
    `);

    this.stmtGetNext = this.db.prepare(`
      SELECT * FROM tasks ORDER BY due_at ASC LIMIT 1
    `);

    this.stmtGetDue = this.db.prepare(`
      SELECT * FROM tasks WHERE due_at <= ? ORDER BY due_at ASC
    `);

    this.stmtDelete = this.db.prepare('DELETE FROM tasks WHERE id = ?');

    this.refreshSchedule();

    logger.info('[TaskScheduler] 初始化完成，任务队列已加载');
  }

  private refreshSchedule(): void {
    try {
      const nextTask = this.stmtGetNext.get() as TaskRow | undefined;

      if (!nextTask) {
        if (this.nextTaskTimer) {
          clearTimeout(this.nextTaskTimer);
          this.nextTaskTimer = null;
          this.currentTimerTargetTime = null;
        }
        return;
      }

      if (this.nextTaskTimer && this.currentTimerTargetTime === nextTask.due_at) {
        return;
      }

      if (this.nextTaskTimer) {
        clearTimeout(this.nextTaskTimer);
      }

      const now = Date.now();
      const delay = Math.max(0, nextTask.due_at - now);
      this.currentTimerTargetTime = nextTask.due_at;

      const MAX_DELAY = 2147483647;
      const safeDelay = Math.min(delay, MAX_DELAY);

      this.nextTaskTimer = setTimeout(() => {
        this.processDueTasks();
      }, safeDelay);

      if (delay > MAX_DELAY) {
        logger.warn(`[TaskScheduler] 任务 ID:${nextTask.id} 延迟超过 setTimeout 上限，将在下一轮调度`);
      }
    } catch (err) {
      logger.error('[TaskScheduler] 刷新调度失败', { err });
    }
  }

  private processDueTasks(): void {
    this.nextTaskTimer = null;
    this.currentTimerTargetTime = null;

    const now = Date.now();
    const tasks = this.stmtGetDue.all(now) as TaskRow[];

    for (const task of tasks) {
      try {
        const params = JSON.parse(task.params);
        this.executeTask(task.action, params);
      } catch (err) {
        logger.error(`[TaskScheduler] 任务执行失败 ID:${task.id}`, { action: task.action, err });
      } finally {
        this.stmtDelete.run(task.id);
      }
    }

    this.refreshSchedule();
  }

  /**
   * 分发器：将字符串 action 映射回代码逻辑
   * params 类型为 unknown，在 case 内部进行断言
   */
  private executeTask(action: string, params: unknown): void {
    logger.debug(`[TaskScheduler] Executing: ${action}`, { params });

    switch (action) {
      case 'deleteMessage': {
        // 类型断言：明确告诉 TS 这里的 params 是什么结构
        if (this.isParams<Bot.DeleteMessageParams>(params)) {
          const p = params; // 这里的 p 已经是 DeleteMessageParams 类型
          bot.deleteMessage(p.chat_id, p.message_id);
        }
        break;
      }

      case 'deleteMessages': {
        if (this.isParams<Bot.DeleteMessagesParams>(params)) {
          const p = params;
          bot.deleteMessages(p.chat_id, p.message_ids);
        }
        break;
      }

      default:
        logger.warn(`[TaskScheduler] 未知的任务类型: ${action}`, { params });
    }
  }

  /**
   * 简单的运行时辅助函数，用于配合泛型断言
   * 在实际工程中，这里可以换成 Zod 或 Ajv 进行严格校验
   * 这里为了保持无依赖，仅做类型转换（Trust assumption: DB data is valid）
   */
  private isParams<T>(params: unknown): params is T {
    return typeof params === 'object' && params !== null;
  }

  /**
   * 公共核心接口：添加任务
   *
   * 使用泛型 K extends keyof TaskRegistry
   * 强力约束：如果 action 是 'deleteMessage'，params 必须是 DeleteMessageParams
   */
  public schedule<K extends keyof TaskRegistry>(action: K, params: TaskRegistry[K], delayMs: number): void {
    const dueAt = Date.now() + delayMs;

    // [关键修改] 1. 规范化参数对象（排序 Key），保证字符串唯一性
    const canonicalParams = canonicalizeParams(params);
    const paramsStr = JSON.stringify(canonicalParams);

    this.stmtUpsert.run({
      action,
      params: paramsStr,
      dueAt,
    });

    this.refreshSchedule();

    logger.info(`[TaskScheduler] 任务已调度: ${action}，预计执行时间: ${formatTime(dueAt)}`, { params });
  }

  // ================= 业务封装方法 =================

  public deleteMessage(chatId: number | string, messageId: number, delayMs: number): void {
    return this.schedule('deleteMessage', { chat_id: chatId, message_id: messageId }, delayMs);
  }

  public deleteMessages(chatId: number | string, messageIds: number[], delayMs: number): void {
    const validIds = [...new Set(messageIds.filter((id) => id))];
    if (validIds.length === 0) return;

    validIds.sort((a, b) => a - b);
    if (validIds.length === 1) {
      return this.deleteMessage(chatId, validIds[0], delayMs);
    }
    return this.schedule('deleteMessages', { chat_id: chatId, message_ids: validIds }, delayMs);
  }

  public async sendTempMessage(
    chatId: number,
    text: string,
    delayMs: number,
    options: {
      relatedMessageIds?: number[];
      replyToMessageId?: number;
      parseMode?: Bot.ParseMode;
    } = {},
  ): Promise<void> {
    const { relatedMessageIds = [], ...sendOptions } = options;

    const sentResult = await bot.sendMessage(chatId, text, sendOptions);

    if (sentResult.ok) {
      const idsToDelete = [sentResult.messageId, ...relatedMessageIds];
      this.deleteMessages(chatId, idsToDelete, delayMs);
    }
  }

  public close(): void {
    if (this.nextTaskTimer) {
      clearTimeout(this.nextTaskTimer);
    }
    this.db.close();
    logger.info('[TaskScheduler] Database closed.');
  }
}

export const taskScheduler: TaskScheduler = new TaskScheduler();
