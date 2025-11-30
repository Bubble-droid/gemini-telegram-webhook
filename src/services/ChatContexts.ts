// src/services/ChatContexts.ts

import { config } from '@/services/ConfigLoader';
import { logger } from '@/services/LoggerService';
import type { Content } from '@google/genai';
import Database from 'better-sqlite3';

class ChatContexts {
  private db: Database.Database;
  private maxContextLength: number;
  private expirationSeconds: number; // 改为秒，因为 SQLite 存 Unix 时间戳通常用秒

  // 预编译的 SQL 语句 (性能优化关键)
  private stmtGet: Database.Statement;
  private stmtUpsert: Database.Statement;
  private stmtDelete: Database.Statement;
  private stmtPrune: Database.Statement;

  constructor() {
    this.maxContextLength = config.maxContextLength;
    this.expirationSeconds = config.contextsExpirationSecond;

    // 1. 初始化数据库文件 (存放在项目根目录的 data 文件夹下)
    const dbPath = '/data/chat_history.db';
    // 自动创建目录逻辑需自行确保，或者手动创建 data 文件夹

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
    const cleanupInterval = 6 * 60 * 60 * 1000;
    setInterval(() => this.pruneExpired(), cleanupInterval);

    logger.info('[ChatContexts] 初始化完成，上下文已加载');
  }

  /**
   * 生成键名
   */
  private generateKey(chatId: number, userId: number): string {
    return `${chatId}:${userId}`;
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
   * @method get
   */
  public get(chatId: number, userId: number): Content[] {
    try {
      const key = this.generateKey(chatId, userId);
      const row = this.stmtGet.get(key) as { data: string; updated_at: number } | undefined;

      if (!row) return [];

      // 惰性删除：如果取出来发现过期了，顺手删掉并返回空
      if (this.getNow() - row.updated_at > this.expirationSeconds) {
        this.stmtDelete.run(key);
        return [];
      }

      return JSON.parse(row.data) as Content[];
    } catch (err) {
      logger.error(`读取上下文失败 (${chatId}:${userId})`, { err });
      return [];
    }
  }

  /**
   * @method update
   */
  public update(chatId: number, userId: number, contexts: Content[]): void {
    try {
      const key = this.generateKey(chatId, userId);

      // 1. 获取现有上下文 (复用 get 逻辑，但这里可以直接查库减少 JSON 解析次数，为了代码复用先调 get)
      const history = this.get(chatId, userId);

      // 3. 截断 (滑动窗口)
      if (history.length >= this.maxContextLength) {
        history.shift();
      }

      history.push(...contexts);

      // 4. 写入数据库
      // better-sqlite3 是同步 IO，但速度极快 (通常 < 1ms)，不会阻塞 Event Loop
      this.stmtUpsert.run({
        key,
        data: JSON.stringify(history),
        now: this.getNow(),
      });

      logger.debug(`${key}: 上下文已持久化，长度 ${history.length}`);
    } catch (err) {
      logger.error(`更新上下文失败 (${chatId}:${userId})`, { err });
    }
  }

  /**
   * @method clear
   */
  public clear(chatId: number, userId: number): void {
    const key = this.generateKey(chatId, userId);
    this.stmtDelete.run(key);
    logger.info(`${key}: 上下文已清除`);
  }

  /**
   * 销毁连接 (App退出时调用)
   */
  public close(): void {
    this.db.close();
    logger.info('[ChatContexts] Database closed.');
  }
}

export const chatContexts: ChatContexts = new ChatContexts();
