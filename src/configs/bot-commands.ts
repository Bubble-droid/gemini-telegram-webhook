// src/configs/bot_commands.ts

import { BotMessages, functionDeclarations, Keyboards } from '@/configs';
import { bot, chatContexts, logger } from '@/services';
import type { BotCommandAction, InlineKeyboardMarkup } from '@/types';
import { sleep, taskScheduler, toHtml } from '@/utils';

/**
 * 辅助函数：根据上下文决定是 编辑消息 (Callback) 还是 发送新消息 (Command)
 */
const sendOrEdit = async (
  chatId: number,
  messageId: number,
  text: string,
  options: {
    isCallback?: boolean;
    replyMarkup?: InlineKeyboardMarkup;
    parseMode?: 'HTML' | 'Markdown';
    autoDeleteMs?: number; // 自动删除时间，不传则不删除
  },
) => {
  const { isCallback = false, replyMarkup, parseMode = 'HTML', autoDeleteMs } = options;
  let result;

  try {
    if (isCallback) {
      // 这里的 messageId 在 callback 中通常是原消息 ID
      result = await bot.editMessageText(chatId, messageId, text, {
        parseMode,
        replyMarkup,
      });
    } else {
      // 这里的 messageId 在 command 中是用户发送的指令消息 ID
      result = await bot.sendMessage(chatId, text, {
        replyToMessageId: messageId,
        parseMode,
        replyMarkup,
      });
    }

    // 处理自动删除
    if (result.ok && autoDeleteMs && autoDeleteMs > 0) {
      // 注意：如果是 editMessageText，result.messageId 通常就是原 ID；如果是 sendMessage，是新 ID。
      const sentMsgId = result.messageId;
      taskScheduler.deleteMessage(chatId, sentMsgId, autoDeleteMs);
    }
    return result;
  } catch (err) {
    logger.error('Failed to send or edit message', { err, chatId });
    throw err;
  }
};

export const BotCommands: BotCommandAction[] = [
  {
    name: 'start',
    description: '开始使用',
    action: async (chatId, userId, messageId, options = {}) => {
      logger.info('Executing start command.', { userId });

      // 直接从变量获取文本，无需 await KV
      const text = BotMessages.getStartText();

      const dynamicKeyboard = {
        inline_keyboard: Keyboards.start.inline_keyboard.map((row) =>
          row.map((btn) => ({ ...btn, callback_data: `${btn.callback_data}_${userId}` })),
        ),
      };

      await sendOrEdit(chatId, messageId, toHtml(text), {
        isCallback: options.isCallback,
        replyMarkup: dynamicKeyboard,
        autoDeleteMs: 3 * 60_000,
      });
    },
  },
  {
    name: 'faq',
    description: '常见问题',
    action: async (chatId, userId, messageId, options = {}) => {
      logger.info('Executing faq command.', { userId });

      const backKeyboard = {
        inline_keyboard: Keyboards.backToStart.inline_keyboard.map((row) =>
          row.map((btn) => ({ ...btn, callback_data: `${btn.callback_data}_${userId}` })),
        ),
      };

      await sendOrEdit(chatId, messageId, toHtml(BotMessages.faq), {
        isCallback: options.isCallback,
        replyMarkup: backKeyboard,
        autoDeleteMs: 5 * 60_000,
      });
    },
  },
  {
    name: 'clear',
    description: '清理对话历史',
    action: async (chatId, userId, messageId, options = {}) => {
      logger.info('Executing clear command.', { userId });
      const { isCallback = false } = options;

      // 1. 发送/编辑为“清理中...”
      const loadingResult = await sendOrEdit(chatId, messageId, BotMessages.clearing, {
        isCallback,
      });

      // 2. 执行清理逻辑
      chatContexts.clear(chatId, userId);
      // 模拟一点延迟感，或者等待数据库操作完成
      await sleep(1000);

      const backKeyboard = isCallback
        ? {
            inline_keyboard: Keyboards.backToStart.inline_keyboard.map((row) =>
              row.map((btn) => ({ ...btn, callback_data: `${btn.callback_data}_${userId}` })),
            ),
          }
        : undefined;

      // 3. 更新为“清理完成”
      const msgIdToEdit = isCallback ? messageId : loadingResult.ok ? loadingResult.messageId : undefined;

      if (msgIdToEdit) {
        const finalResult = await bot.editMessageText(chatId, msgIdToEdit, toHtml(BotMessages.cleared), {
          parseMode: 'HTML',
          replyMarkup: backKeyboard,
        });

        // 这里的类型检查是因为 editMessageText 返回值可能不同
        const finalMsgId = finalResult.ok ? finalResult.messageId : msgIdToEdit;
        taskScheduler.deleteMessage(chatId, finalMsgId, 3 * 60_000);
      }
    },
  },
  {
    name: 'tools',
    description: '查看可用工具',
    action: async (chatId, userId, messageId, options = {}) => {
      logger.info('Executing tools command.', { userId });

      const toolList =
        functionDeclarations.length > 0
          ? functionDeclarations.map((tool) => `• **${tool.name}**: ${tool.description}`).join('\n\n')
          : '暂无可用工具';

      const fullText = BotMessages.toolsHeader + toolList;

      const backKeyboard = {
        inline_keyboard: Keyboards.backToStart.inline_keyboard.map((row) =>
          row.map((btn) => ({ ...btn, callback_data: `${btn.callback_data}_${userId}` })),
        ),
      };

      await sendOrEdit(chatId, messageId, toHtml(fullText), {
        isCallback: options.isCallback,
        replyMarkup: backKeyboard,
        autoDeleteMs: 5 * 60_000,
      });
    },
  },
];
