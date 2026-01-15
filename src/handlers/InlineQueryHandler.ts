// src/handlers/InlineQueryHandler.ts

import { logger } from '@/services';
import type { InlineQuery } from 'grammy/types';

/**
 * @description 处理 Telegram 行内查询 (Inline Query)。
 */
class InlineQueryHandler {
  /**
   * 处理行内查询的主入口
   * @param inlineQuery - Telegram 行内查询对象
   */
  public handle(inlineQuery: InlineQuery): void {
    const { id, from, query: queryText } = inlineQuery;

    logger.debug('Received inline query', {
      queryId: id,
      userId: from.id,
      queryText,
    });

    // 1. 验证是否需要处理
    if (this.shouldIgnore(inlineQuery)) {
      logger.warn('Invalid or empty inline query ignored', { queryId: id });
      return;
    }

    return;
  }
  /**
   * 判断是否应该忽略该行内查询
   */
  private shouldIgnore(inlineQuery: InlineQuery): boolean {
    // 原逻辑：如果没有查询内容且是在私聊中，则视为无效/忽略
    return !inlineQuery.query && inlineQuery.chat_type === 'private';
  }
}

// 导出单例实例
export const inlineQueryHandler = new InlineQueryHandler();
