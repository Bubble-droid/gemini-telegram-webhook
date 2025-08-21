// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep } from '@/utils';
import type { BotCommandAction } from '@/types';

/**
 * @constant botCommands
 * @description 定义所有 Telegram Bot 命令的数组。
 *              每个命令都包含名称和执行动作。
 */
export const botCommands: BotCommandAction[] = [
  {
    name: 'start',
    description: '开始使用',
    action: async (chatId: number, messageId: number) => {
      Log.info('Executing /start command.');
      const { modelName } = BotConfig.load();
      const startText: string =
        `🤖 当前使用模型：\`${modelName}\`\n\n` +
        `✨ 请在 @ 我或者回复我时带上你的问题，也可以回复或引用某条消息时 @ 我\n\n` +
        `👍 由 Cloudflare、Vercel、Claw Cloud、OpenAI 和 Gemini 提供支持`;
      const { messageId: startMessageId } = await TelegramBot.sendMessage(chatId, startText, messageId);
      if (startMessageId) {
        void scheduleDeletion({ chat_id: chatId, message_id: startMessageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'clear',
    description: '清理对话上下文',
    action: async (chatId: number, messageId: number, userId: number) => {
      Log.info('Executing /clear command.');
      const { messageId: clearingMessageId } = await TelegramBot.sendMessage(chatId, '🗑 Clearing...', messageId);
      await ChatContexts.clear(chatId, userId);
      await sleep(3_000);
      if (clearingMessageId) {
        await TelegramBot.deleteMessage(chatId, clearingMessageId);
      }
      const clearedText: string = '✅ 已成功清除你和我的历史对话';
      const { messageId: clearedMessageId } = await TelegramBot.sendMessage(chatId, clearedText, messageId);
      if (clearedMessageId) {
        void scheduleDeletion({ chat_id: chatId, message_id: clearedMessageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'tools',
    description: '模型可用工具',
    action: async (chatId: number, messageId: number) => {
      Log.info('Executing /tools command.');
      const toolList = geminiTools[0].functionDeclarations
        ?.map((tool) => `  * **${tool.name}**: ${tool.description}\n`)
        .join('\n')
        .trim();
      const toolsText = `🛠 模型可用工具列表：\n\n${toolList}`;
      const { messageId: toolsMessageId } = await TelegramBot.sendMessage(chatId, toolsText, messageId);
      if (toolsMessageId) {
        void scheduleDeletion({ chat_id: chatId, message_id: toolsMessageId }, 10 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 10 * 60_000);
    },
  },
];
