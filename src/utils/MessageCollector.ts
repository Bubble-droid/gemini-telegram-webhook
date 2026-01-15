import { logger } from '@/services';
import type { MaybePromise } from '@/types';
import type { Message } from 'grammy/types';

type BatchCallback = (messages: Message[]) => MaybePromise<void>;

const DEBOUNCE_MS = 1500;

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

  // 存储回调 (实际上通常是固定的处理逻辑，但为了解耦保留回调结构)
  private callback: BatchCallback | undefined;

  /**
   * 注册全局分发回调
   */
  public registerCallback(cb: BatchCallback): void {
    this.callback = cb;
  }

  /**
   * 添加消息并进入聚合倒计时
   */
  public append(message: Message): void {
    const { chat, from, message_id } = message;
    if (!from) return; // 忽略没有发送者的消息（极其罕见）

    // 生成唯一聚合键：群组+用户
    const key = `${chat.id}:${from.id}`;

    // 1. 初始化 Buffer
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    const group = this.buffer.get(key) ?? [];

    // 2. 添加消息 (简单去重)
    if (!group.some((m) => m.message_id === message_id)) {
      group.push(message);
    }

    // 3. 重置定时器 (防抖)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const timer = setTimeout(() => {
      void this.release(key);
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }

  /**
   * 释放聚合的消息组
   */
  private async release(key: string): Promise<void> {
    this.timers.delete(key);
    const messages = this.buffer.get(key);
    this.buffer.delete(key);

    if (!messages || messages.length === 0) return;

    // 按消息 ID 排序，确保文本和文件的相对顺序正确
    messages.sort((a, b) => a.message_id - b.message_id);

    // 记录日志：看看我们聚合了什么
    logger.info(`[Collector] Released batch for ${key}, count: ${messages.length}`);

    try {
      if (this.callback) {
        await this.callback(messages);
      }
    } catch (err) {
      logger.error(`[Collector] Error handling batch for ${key}`, { err });
    }
  }
}
