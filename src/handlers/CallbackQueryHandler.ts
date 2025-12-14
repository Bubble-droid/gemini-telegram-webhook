// src/handlers/callback_query.ts

import { BotCommands } from '@/configs';
import { bot, logger } from '@/services';
import type { CallbackQuery } from '@/types';
import { taskScheduler } from '@/utils';

interface CallbackQueryContext {
  queryId: string;
  userId: number;
  chatId: number;
  messageId: number;
  data: string;
}

/**
 * @description 处理 Telegram Callback Query (按钮点击事件)。
 *              此类设计为无状态单例，所有上下文数据通过参数传递。
 */
class CallbackQueryHandler {
  /**
   * 处理具体的命令逻辑
   */
  private async handleCommand(ctx: CallbackQueryContext): Promise<void> {
    const { queryId, userId, chatId, messageId, data } = ctx;
    const [, commandName, allowUserIdStr] = data.split('_');
    const allowUserId = Number(allowUserIdStr);

    // 权限校验
    if (userId !== allowUserId) {
      bot.answerCallbackQuery(queryId, {
        callbackText: '🚫 你没有权限进行此操作',
      });
      return;
    }

    bot.answerCallbackQuery(queryId);

    // 查找并执行命令
    const targetCommand = BotCommands.find((cmd) => cmd.name === commandName);
    if (targetCommand) {
      await targetCommand.action(chatId, allowUserId, messageId, {
        isCallback: true,
      });
    } else {
      logger.warn('Callback command not found', { commandName });
    }
  }

  /**
   * 处理回调查询的主入口
   * @param callbackQuery - Telegram 回调对象
   */
  public async handle(callbackQuery: CallbackQuery): Promise<void> {
    if (!callbackQuery.message || !callbackQuery.data) {
      logger.info('Invalid callback query: missing message or data', { queryId: callbackQuery.id });
      return;
    }

    // 2. 提取数据构建上下文 (Context)
    // 所有的状态数据都包含在这个局部变量中，确保并发安全
    const { id: queryId, from, message, data } = callbackQuery;
    const { chat, message_id: messageId } = message;

    const ctx: CallbackQueryContext = {
      queryId,
      userId: from.id,
      chatId: chat.id,
      messageId,
      data,
    };

    logger.info('Handling callback query', { ...ctx });

    // 3. 路由分发
    try {
      if (ctx.data.startsWith('cmd_')) {
        await this.handleCommand(ctx);
      } else {
        await bot.answerCallbackQuery(ctx.queryId);
      }
    } catch (err) {
      logger.error('Error in callback query handler dispatch', { err, queryId });
      // 即使出错也要尝试结束 loading 状态
      await bot.answerCallbackQuery(ctx.queryId);

      const result = await bot.editMessageText(ctx.chatId, ctx.messageId, '⚠️ 回调查询处理失败，请稍后再试');
      if (result.ok) {
        taskScheduler.deleteMessage(ctx.chatId, result.messageId, 3 * 60 * 1000);
      }
    }
  }
}

// 导出无状态单例
export const callbackQueryHandler = new CallbackQueryHandler();
