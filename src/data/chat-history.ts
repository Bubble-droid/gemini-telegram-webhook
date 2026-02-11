import type { Content } from '@google/genai';
import { CHAT_HISTORY_FILE, DATA_DIR } from '@shared/core/constants.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import type { ChitchatState } from '@shared/types/telegram.js';
import { ms } from '@shared/utils/helpers.js';
import type { LowSync } from 'lowdb';
import path from 'node:path';
import { loadLowdb } from './data-load.js';

interface HistoryItem {
  data: unknown;
  updatedAt: number;
}

interface DatabaseSchema {
  history: Recordable<HistoryItem>;
}

const HISTORY_TTL_DAY = 7;
const MAX_HISTORY_LENGTH = 16;

const HISTORY_FILE_PATH = path.join(DATA_DIR, CHAT_HISTORY_FILE);
const DEFAULT_HISTORY_DATA = { history: {} };
const CLEANUP_INTERVAL = ms.hour(6);

class ChatHistory {
  private db: LowSync<DatabaseSchema>;
  private cleanupTimer?: NodeJS.Timeout;
  private expirationTtl = ms.day(HISTORY_TTL_DAY);

  constructor() {
    this.db = loadLowdb<DatabaseSchema>(HISTORY_FILE_PATH, DEFAULT_HISTORY_DATA);

    this.startCleanupTask();
    logger.info('[ChatHistory] LowDB initialized, history loaded.');
  }

  /**
   * 获取对话上下文
   */
  public get(chatId: number, userId: number): Content[] {
    const key = this.generateUserKey(chatId, userId);
    return (this.load(key) ?? []) as Content[];
  }

  /**
   * 更新/追加上下文
   */
  public update(chatId: number, userId: number, contents: Content[]) {
    const key = this.generateUserKey(chatId, userId);
    const history: Content[] = [...this.get(chatId, userId)];
    const excess = history.length + contents.length - MAX_HISTORY_LENGTH;

    if (excess > 0) {
      history.splice(0, excess);
    }

    history.push(...contents);

    this.save(key, history);

    logger.info(`${key}: History persisted, length: ${history.length}`);
  }

  /**
   * 清除特定用户的上下文
   */
  public clear(chatId: number, userId: number) {
    const key = this.generateUserKey(chatId, userId);
    this.deleteKey(key);
    logger.info(`${key}: History cleared.`);
  }

  /**
   * 获取闲聊状态
   */
  public getChitChatState(chatId: number): ChitchatState | null {
    const key = this.generateChitChatKey(chatId);
    return this.load(key) as ChitchatState | null;
  }

  /**
   * 保存闲聊状态
   */
  public saveChitChatState(chatId: number, state: ChitchatState) {
    const key = this.generateChitChatKey(chatId);
    this.save(key, state);
  }

  private startCleanupTask(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    this.cleanupTimer = setInterval(() => {
      this.pruneExpired();
    }, CLEANUP_INTERVAL);

    // 立即执行一次
    this.pruneExpired();
  }

  /**
   * 生成用户唯一键名
   */
  private generateUserKey(chatId: number, userId: number): string {
    return `user:${chatId}:${userId}`;
  }

  private generateChitChatKey(chatId: number): string {
    return `chitchat:${chatId}`;
  }

  /**
   * 获取当前时间戳 (秒)
   */
  private getNow(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 核心读取逻辑：包含惰性删除检查
   */
  private load(key: string): unknown {
    const record = this.db.data.history[key];

    if (!record) return null;

    // 惰性删除 (Lazy Expiration)
    if (this.getNow() - record.updatedAt > this.expirationTtl) {
      this.deleteKey(key);
      return null;
    }

    return record.data;
  }

  /**
   * 核心写入逻辑
   */
  private save(key: string, data: unknown) {
    try {
      this.db.data.history[key] = {
        data,
        updatedAt: this.getNow(),
      };
      this.db.write();
    } catch (err) {
      logger.error(`[ChatHistory] Save failed for key: ${key}`, { err });
    }
  }

  /**
   * 核心删除逻辑
   */
  private deleteKey(key: string) {
    if (Object.hasOwn(this.db.data.history, key)) {
      Reflect.deleteProperty(this.db.data.history, key);
      this.db.write();
    }
  }

  /**
   * 批量清理过期数据
   */
  private pruneExpired() {
    try {
      const deadline = this.getNow() - this.expirationTtl;
      let deleteCount = 0;

      // 遍历所有 Key 检查过期
      const keys = Object.keys(this.db.data.history);
      for (const key of keys) {
        const record = this.db.data.history[key];
        if (record && record.updatedAt < deadline) {
          Reflect.deleteProperty(this.db.data.history, key);
          deleteCount++;
        }
      }

      if (deleteCount > 0) {
        this.db.write();
        logger.debug(`[ChatHistory] Daily prune done: Removed ${deleteCount} expired records.`);
      }
    } catch (err) {
      logger.error('[ChatHistory] Prune failed', { err });
    }
  }
}

export const chatHistory = new ChatHistory();
