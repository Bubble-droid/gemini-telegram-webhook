// src/handlers/callback_query.ts

import { BotConfig, Log, TelegramBot } from '@/services';
import type { CallbackQuery, Message, ReplyMarkup } from '@/types';
import { handleMention } from './message';
import { botCommands } from '@/configs';
import { KvNamespace } from '@/utils';

export const handleCallbackQuery = async (query: CallbackQuery): Promise<void> => {
  if (!query.message || !query.data) {
    Log.info('Invalid callback query', { queryId: query.id });
    return;
  }
  const { botName, rateLimitId, contextsExpirationSecond } = BotConfig.load();
  const { id, from, message, data } = query;
  const { chat, message_id: messageId } = message;

  Log.info('Handling callback query', { chatId: chat.id, messageId, data });

  let callbackText: string | undefined = undefined;

  if (data.startsWith('tool_demo_')) {
    const toolName = data.split('_')[2];
    const newText = `请演示下 \`${toolName}\` 工具`;
    const newMessage: Message = { ...message, from, text: newText };
    await handleMention(newMessage);
    callbackText = '演示完成';
  } else if (data.startsWith('cmd_')) {
    const command = data.split('_')[1];
    if (command === 'help') {
      const commandList = botCommands.map((cmd) => `/${cmd.name}@${botName}: ${cmd.description}`).join('\n');
      const replyText = `💡 可用命令：\n\n${commandList}`;
      const backReplyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '⬅️ Go Back',
              callback_data: 'cmd_start',
            },
          ],
        ],
      };
      await TelegramBot.editMessageText(chat.id, messageId, replyText, undefined, backReplyMarkup);
    } else {
      const targetCommand = botCommands.find((cmd) => cmd.name === command);
      if (targetCommand) {
        await targetCommand.action({
          chatId: chat.id,
          messageId,
          userId: from?.id as number,
          isCallback: true,
        });
      }
    }
    callbackText = '执行完成';
  } else if (data.startsWith('reaction_')) {
    const keyName = `reacted_${chat.id}_${messageId}`;
    const reactedUsers = (await KvNamespace.read<number[]>(rateLimitId, keyName, 'json')) || [];
    if (!reactedUsers.includes(from.id)) {
      reactedUsers.push(from.id);
      await KvNamespace.write(rateLimitId, keyName, JSON.stringify(reactedUsers), { expiration_ttl: contextsExpirationSecond });
    }
  }

  await TelegramBot.answerCallbackQuery(id, callbackText);
};
