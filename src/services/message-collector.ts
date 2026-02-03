import { logger } from '@shared/core/logger';
import { delay, ms, uniqueByProperty } from '@shared/utils/helpers';
import type { Message } from 'grammy/types';

const DEBOUNCE_MS = ms.sec(1.5);

/**
 * @class MessageCollector
 * @description 消息收集器。
 * 不再局限于 media_group_id，而是基于 [ChatId + UserId] 进行聚合。
 * 可以完美解决 Document 组与 Text 描述分离、或用户连续发送多条短句的问题。
 */
export class MessageCollector {
  // Key: `${chatId}:${userId}`
  private buffer = new Map<string, Message[]>();

  public async getMessages(msg: Message): Promise<Message[]> {
    await delay(DEBOUNCE_MS);
    const key = this.generateKey(msg);
    const messages = uniqueByProperty([...(this.release(key) ?? []), msg], 'message_id');
    messages.sort((a, b) => a.message_id - b.message_id);
    return messages;
  }

  /**
   * 添加消息并进入聚合倒计时
   */
  public append(msg: Message): void {
    const { message_id } = msg;
    const key = this.generateKey(msg);

    // 1. 初始化 Buffer
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    const group = this.buffer.get(key)!;

    if (!group.some((m) => m.message_id === message_id)) {
      group.push(msg);
    }
  }

  /**
   * 释放聚合的消息组
   */
  private release(key: string): Message[] | undefined {
    const messages = this.buffer.get(key);
    this.buffer.delete(key);
    if (!messages?.length) return;
    logger.info(`[Collector] Released batch for ${key}, count: ${messages.length}`);
    return messages;
  }

  private generateKey(message: Message): string {
    const { chat, from } = message;
    return `${chat.id}:${from!.id}`;
  }
}
