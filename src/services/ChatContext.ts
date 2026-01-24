// src/services/ChatContext.ts

import { DATA_DIR } from '@/configs/constant';
import { logger } from '@/services/LoggerService';
import type { ChitChatState, Recordable } from '@/types';
import { HOUR } from '@/utils';
import type { Content } from '@google/genai';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './ConfigLoader';

interface ContextItem {
  data: unknown;
  updatedAt: number;
}

interface DatabaseSchema {
  contexts: Recordable<ContextItem>;
}

const CONTEXT_FILE_PATH = path.join(DATA_DIR, 'chat-contexts.json');
const DEFAULT_CONTEXT_DATA = { contexts: {} };
const CLEANUP_INTERVAL = 6 * HOUR;

export class ChatContext {
  private db: LowSync<DatabaseSchema>;
  private cleanupTimer?: NodeJS.Timeout;
  private expirationTtl = CONFIG.CONTEXT_TTL_DAY * 24 * HOUR;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const adapter = new JSONFileSync<DatabaseSchema>(CONTEXT_FILE_PATH);
    this.db = new LowSync(adapter, DEFAULT_CONTEXT_DATA);

    // 读取数据，若文件不存在则写入默认值
    this.db.read();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.db.data) {
      this.db.data = DEFAULT_CONTEXT_DATA;
      this.db.write();
    }

    // 启动定期清理任务
    this.startCleanupTask();

    logger.info('[ChatContexts] LowDB initialized, context loaded.');
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
  public update(chatId: number, userId: number, contexts: Content[]): void {
    const key = this.generateUserKey(chatId, userId);

    const history: Content[] = [...this.get(chatId, userId)];

    const excess = history.length + contexts.length - CONFIG.MAX_CONTEXT_LENGTH;

    if (excess > 0) {
      history.splice(0, excess);
    }

    history.push(...contexts);

    this.save(key, history);

    logger.info(`${key}: Context persisted, length: ${history.length}`);
  }

  /**
   * 清除特定用户的上下文
   */
  public clear(chatId: number, userId: number): void {
    const key = this.generateUserKey(chatId, userId);
    this.deleteKey(key);
    logger.info(`${key}: Context cleared.`);
  }

  /**
   * 获取闲聊状态
   */
  public getChitChatState(chatId: number): ChitChatState | null {
    const key = this.generateChitChatKey(chatId);
    return this.load(key) as ChitChatState | null;
  }

  /**
   * 保存闲聊状态
   */
  public saveChitChatState(chatId: number, state: ChitChatState): void {
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
    const record = this.db.data.contexts[key];

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
  private save(key: string, data: unknown): void {
    try {
      this.db.data.contexts[key] = {
        data,
        updatedAt: this.getNow(),
      };
      this.db.write();
    } catch (err) {
      logger.error(`[ChatContexts] Save failed for key: ${key}`, { err });
    }
  }

  /**
   * 核心删除逻辑
   */
  private deleteKey(key: string): void {
    if (Object.hasOwn(this.db.data.contexts, key)) {
      Reflect.deleteProperty(this.db.data.contexts, key);
      this.db.write();
    }
  }

  /**
   * 批量清理过期数据
   */
  private pruneExpired(): void {
    try {
      const deadline = this.getNow() - this.expirationTtl;
      let deleteCount = 0;

      // 遍历所有 Key 检查过期
      const keys = Object.keys(this.db.data.contexts);
      for (const key of keys) {
        const record = this.db.data.contexts[key];
        if (record && record.updatedAt < deadline) {
          Reflect.deleteProperty(this.db.data.contexts, key);
          deleteCount++;
        }
      }

      if (deleteCount > 0) {
        this.db.write();
        logger.debug(`[ChatContexts] Daily prune done: Removed ${deleteCount} expired records.`);
      }
    } catch (err) {
      logger.error('[ChatContexts] Prune failed', { err });
    }
  }
}

export const chatContext = new ChatContext();
