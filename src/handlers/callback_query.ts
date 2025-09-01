// src/handlers/callback_query.ts

import { BotConfig, Log, TelegramBot } from '@/services';
import type { CallbackQuery, InlineKeyboardButton, Message } from '@/types';
import { handleMention } from './message';
import { botCommands } from '@/configs';
import { KvNamespace } from '@/utils';

export const handleCallbackQuery = async (query: CallbackQuery): Promise<void> => {
  if (!query.message || !query.data) {
    Log.info('Invalid callback query', { queryId: query.id });
    return;
  }
  const { rateLimitId } = BotConfig.load();
  const { id, from, message, data } = query;
  const { chat, message_id: messageId, reply_markup } = message;

  Log.info('Handling callback query', { chatId: chat.id, messageId, data });

  if (data === 'mention') {
    void TelegramBot.answerCallbackQuery(id);
    const newMessage: Message = { ...message, from, text: '你能做什么？' };
    await handleMention(newMessage);
  } else if (data.startsWith('tool_demo_')) {
    void TelegramBot.answerCallbackQuery(id, { callbackText: '开始演示工具...' });
    const toolName = data.split('_')[2];
    const newText = `请演示下 ${toolName} 工具`;
    const newMessage: Message = { ...message, from, text: newText };
    delete newMessage.reply_to_message;
    await handleMention(newMessage);
  } else if (data.startsWith('cmd_')) {
    void TelegramBot.answerCallbackQuery(id);
    const command = data.split('_')[1];
    const targetCommand = botCommands.find((cmd) => cmd.name === command);
    if (targetCommand) {
      await targetCommand.action({
        chatId: chat.id,
        messageId,
        userId: from?.id as number,
        isCallback: true,
      });
    }
  } else if (data.startsWith('reaction_')) {
    const reaction = data.split('_')[1];
    const keyName = `reacted_${chat.id}_${messageId}`;
    const reactedUsers = (await KvNamespace.read<number[]>(rateLimitId, keyName, 'json')) || [];

    if (reactedUsers.includes(from.id)) {
      // Notify the user that they have already reacted and stop.
      void TelegramBot.answerCallbackQuery(id, {
        callbackText: '你已做出过回应',
      });
      return;
    }

    void TelegramBot.answerCallbackQuery(id);
    // Add the user to the reacted list and save it for 48 hours.
    const newReactedUsers = [...reactedUsers, from.id];
    await KvNamespace.write(rateLimitId, keyName, JSON.stringify(newReactedUsers), { expiration_ttl: 48 * 60 * 60 });

    // Create a deep copy of the keyboard to modify.
    const newInlineKeyboard: InlineKeyboardButton[][] = JSON.parse(JSON.stringify(reply_markup?.inline_keyboard));

    let keyboardUpdated = false;
    // Iterate over the keyboard to find and update the correct button.
    for (const row of newInlineKeyboard) {
      for (const button of row) {
        if (button.callback_data === `reaction_${reaction}`) {
          const currentText = button.text;
          const parts = currentText.split(' ');
          const emoji = parts[0];
          const currentCount = parseInt(parts[1] || '0', 10);

          if (!isNaN(currentCount)) {
            const newCount = currentCount + 1;
            button.text = `${emoji} ${newCount}`;
            keyboardUpdated = true;
            break; // Button found and updated, exit inner loop.
          }
        }
      }
      if (keyboardUpdated) {
        break; // Row containing the button found, exit outer loop.
      }
    }

    if (keyboardUpdated) {
      // If the keyboard was changed, edit the message to show the new keyboard.
      await TelegramBot.editMessageReplyMarkup(chat.id, messageId, {
        inline_keyboard: newInlineKeyboard,
      });
    }
  }
};
