// src/services/ChatContexts.ts

import type { ChitChatState } from '@/handlers/messages';
import { config } from '@/services/ConfigLoader';
import { logger } from '@/services/LoggerService';
import type { Content } from '@google/genai';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export class ChatContexts {
  private db: Database.Database;
  private maxContextLength: number;
  private expirationSeconds: number;

  // 预编译的 SQL 语句 (性能优化关键)
  private stmtGet: Database.Statement;
  private stmtUpsert: Database.Statement;
  private stmtDelete: Database.Statement;
  private stmtPrune: Database.Statement;

  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.maxContextLength = config.maxContextLength;
    this.expirationSeconds = config.contextsExpirationSecond;

    const dbDir = '/data';

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'chat_history.db');

    this.db = new Database(dbPath, {
      verbose: (msg) => logger.debug(String(msg)),
    });

    // 2. 启用 WAL 模式 (大幅提升并发写性能)
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('auto_vacuum = INCREMENTAL');

    // 3. 建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contexts (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 4. 预编译语句 (Prepared Statements)
    this.stmtGet = this.db.prepare('SELECT data, updated_at FROM contexts WHERE key = ?');
    this.stmtUpsert = this.db.prepare(`
      INSERT INTO contexts (key, data, updated_at) VALUES (@key, @data, @now)
      ON CONFLICT(key) DO UPDATE SET data = @data, updated_at = @now
    `);
    this.stmtDelete = this.db.prepare('DELETE FROM contexts WHERE key = ?');
    // 清理过期数据: updated_at < (当前时间 - 过期时长)
    this.stmtPrune = this.db.prepare('DELETE FROM contexts WHERE updated_at < ?');

    // 5. 启动定期清理任务
    this.startCleanupTask();

    logger.info('[ChatContexts] 初始化完成，上下文已加载');
  }

  private startCleanupTask() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    const cleanupInterval = 6 * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.pruneExpired(), cleanupInterval);
    // 立即执行一次，防止冷启动后要等6小时才清理
    this.pruneExpired();
  }

  /**
   * 生成键名
   */
  private generateUserKey(chatId: number, userId: number): string {
    return `user:${chatId}:${userId}`;
  }

  /**
   * 获取当前时间戳 (秒)
   */
  private getNow(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 清理过期数据
   */
  private pruneExpired(): void {
    try {
      const deadline = this.getNow() - this.expirationSeconds;
      const info = this.stmtPrune.run(deadline);
      if (info.changes > 0) {
        logger.info(`[ChatContexts] 每日清理完成: 移除了 ${info.changes} 条过期会话 (7天前)`);
        this.db.pragma('incremental_vacuum(1000)');
      }
    } catch (err) {
      logger.error('[ChatContexts] 清理过期数据失败', { err });
    }
  }

  /**
   * 通用读取方法
   */
  private load<T>(key: string): T | null {
    try {
      const row = this.stmtGet.get(key) as { data: string; updated_at: number } | undefined;
      if (!row) return null;

      // 惰性删除
      if (this.getNow() - row.updated_at > this.expirationSeconds) {
        this.stmtDelete.run(key);
        return null;
      }

      return JSON.parse(row.data) as T;
    } catch (err) {
      logger.error(`[ChatContexts] Load failed for key: ${key}`, { err });
      this.stmtDelete.run(key);
      logger.warn(`${key}: JSON parse failed, deleted the record.`);
      return null;
    }
  }

  /**
   * 通用写入方法
   */
  private save<T>(key: string, data: T): void {
    try {
      this.stmtUpsert.run({
        key,
        data: JSON.stringify(data),
        now: this.getNow(),
      });
    } catch (err) {
      logger.error(`[ChatContexts] Save failed for key: ${key}`, { err });
    }
  }

  /**
   * @method get
   */
  public get(chatId: number, userId: number): Content[] {
    const key = this.generateUserKey(chatId, userId);
    return this.load<Content[]>(key) || [];
  }

  /**
   * @method update
   */
  public update(chatId: number, userId: number, contexts: Content[]): void {
    const key = this.generateUserKey(chatId, userId);

    // 1. 获取现有上下文
    const history = this.get(chatId, userId);

    // 3. 截断 (滑动窗口)
    if (history.length >= this.maxContextLength) {
      history.shift();
    }

    history.push(...contexts);

    this.save(key, history);

    logger.debug(`${key}: 上下文已持久化，长度 ${history.length}`);
  }

  /**
   * @method clear
   */
  public clear(chatId: number, userId: number): void {
    const key = this.generateUserKey(chatId, userId);
    this.stmtDelete.run(key);
    logger.info(`${key}: 上下文已清除`);
  }

  /**
   * [ChitChat] 获取闲聊状态
   * Key Format: "chitchat:{chatId}"
   */
  public getChitChatState(chatId: number): ChitChatState | null {
    const key = `chitchat:${chatId}`;
    return this.load<ChitChatState>(key);
  }

  /**
   * [ChitChat] 保存闲聊状态
   */
  public saveChitChatState(chatId: number, state: ChitChatState): void {
    const key = `chitchat:${chatId}`;
    this.save(key, state);
  }

  /**
   * 销毁连接 (App退出时调用)
   */
  public close(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.db.close();
    logger.info('[ChatContexts] Database closed.');
  }
}

export const chatContexts: ChatContexts = new ChatContexts();
