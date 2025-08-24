// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, KvNamespace } from '@/utils';
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
      const { modelName, durableResourceId, startReplyTextKeyName } = BotConfig.load();
      const startReplyText = await KvNamespace.read<string>(durableResourceId, startReplyTextKeyName, 'text');
      const replaceText = startReplyText?.replace('MODEL_NAME', modelName) as string;
      const startResult = await TelegramBot.sendMessage(chatId, replaceText, 'HTML', messageId);
      if (startResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: startResult.messageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'clear',
    description: '清理对话上下文',
    action: async (chatId: number, messageId: number, userId: number) => {
      Log.info('Executing /clear command.');
      const clearingResult = await TelegramBot.sendMessage(chatId, '🗑 Clearing...', 'HTML', messageId);
      await ChatContexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3_000);
        await TelegramBot.deleteMessage(chatId, clearingResult.messageId);
      }
      const clearedText: string = '✅ 已成功清除你和我的历史对话';
      const clearedResult = await TelegramBot.sendMessage(chatId, clearedText, 'HTML', messageId);
      if (clearedResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 60_000);
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
      const toolsText = `🛠 我可以使用以下工具：\n\n${toolList}`;
      const toolsResult = await TelegramBot.sendMessage(chatId, toolsText, 'HTML', messageId);
      if (toolsResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 10 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 10 * 60_000);
    },
  },
];
