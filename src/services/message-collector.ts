import { logger } from '@shared/core/logger.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { Message } from 'grammy/types';

const DEBOUNCE_MS = ms.sec(3);

/**
 * @class MessageCollector
 * @description 消息收集器。
 * 不再局限于 media_group_id，而是基于 [ChatId + UserId] 进行聚合。
 * 可以完美解决 Document 组与 Text 描述分离、或用户连续发送多条短句的问题。
 */
export class MessageCollector {
  // Key: `${chatId}:${userId}`
  private buffer = new Map<string, Message[]>();
  private timers = new Map<string, NodeJS.Timeout>();

  public async getMessages(msg: Message): Promise<Message[]> {
    const key = this.generateKey(msg);
    await delay(ms.sec(1.5));
    const messages = [...this.release(key)];
    if (!messages.some((m) => m.message_id === msg.message_id)) {
      messages.push(msg);
    }
    messages.sort((a, b) => a.message_id - b.message_id);
    return messages;
  }

  /**
   * 添加消息并进入聚合倒计时
   */
  public append(msg: Message) {
    const { message_id } = msg;
    const key = this.generateKey(msg);

    // 1. 初始化 Buffer
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    const group = this.buffer.get(key) ?? [];

    // 2. 添加消息 (简单去重)
    if (!group.some((m) => m.message_id === message_id)) {
      group.push(msg);
    }

    // 3. 重置定时器 (防抖)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const timer = setTimeout(() => {
      this.release(key);
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }

  /**
   * 释放聚合的消息组
   */
  private release(key: string): Message[] {
    this.timers.delete(key);
    const messages = this.buffer.get(key);
    this.buffer.delete(key);
    if (!messages?.length) return [];
    messages.sort((a, b) => a.message_id - b.message_id);
    logger.debug(`[Collector] Released batch for ${key}, count: ${messages.length}`);
    return messages;
  }

  private generateKey(message: Message): string {
    const { chat, from } = message;
    return `${chat.id}:${from?.id}`;
  }
}
