// src/handlers/InlineQueryHandler.ts

import { logger } from '@/services';
import type { InlineQuery } from '@/types';

/**
 * @class InlineQueryHandler
 * @description 处理 Telegram 行内查询 (Inline Query)。
 *              采用无状态单例模式。
 */
class InlineQueryHandler {
  /**
   * 判断是否应该忽略该行内查询
   * (例如：私聊中的空查询通常无需处理)
   * @private
   */
  private shouldIgnore(inlineQuery: InlineQuery): boolean {
    // 原逻辑：如果没有查询内容且是在私聊中，则视为无效/忽略
    return !inlineQuery.query && inlineQuery.chat_type === 'private';
  }

  /**
   * 处理行内查询的主入口
   * @public
   * @param {InlineQuery} inlineQuery - Telegram 行内查询对象
   */
  public async handle(inlineQuery: InlineQuery): Promise<void> {
    const { id, from, query: queryText } = inlineQuery;

    // 1. 验证是否需要处理
    if (this.shouldIgnore(inlineQuery)) {
      logger.info('Invalid or empty inline query ignored', { queryId: id });
      return;
    }

    // 2. 记录日志
    logger.info('Handling inline query', {
      queryId: id,
      userId: from.id,
      queryText,
    });

    // 3. 业务逻辑处理 (在此处添加具体的搜索或回答逻辑)
    // 例如: await bot.answerInlineQuery(...)
    // 目前原代码直接返回，保持原样
    return;
  }
}

// 导出单例实例
export const inlineQueryHandler = new InlineQueryHandler();
