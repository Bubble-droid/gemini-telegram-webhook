// src/handlers/callback_query.ts

import { config, Log, bot } from '@/services';
import type { CallbackQuery, InlineKeyboardButton, Message } from '@/types';
import { handleMention } from './message';
import { BotCommands } from '@/configs';
import { kv } from '@/utils';

export const handleCallbackQuery = async (callbackQuery: CallbackQuery): Promise<void> => {
  if (!callbackQuery.message || !callbackQuery.data) {
    Log.info('Invalid callback query', { queryId: callbackQuery.id });
    return;
  }
  const { durableResourceId, rateLimitId } = config.load();
  const { id: queryId, from, message, data } = callbackQuery;
  const { chat, message_id: messageId, date, reply_to_message, reply_markup } = message;

  Log.info('Handling callback query', { chatId: chat.id, messageId, userId: from.id, data });

  switch (true) {
    case data === 'PLACEHOLDER': {
      bot.answerCallbackQuery(queryId);
      break;
    }
    case data.startsWith('mention_'): {
      const [, , allowUserId] = data.split('_');
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: '你没有权限进行此操作' });
        return;
      }
      bot.answerCallbackQuery(queryId, { callbackText: '询问请求...' });
      const newMessageText: string = '简单说明下你能做什么？';
      const newMessage: Message = { ...message, message_id: reply_to_message?.message_id || messageId, from, text: newMessageText };
      delete newMessage.reply_to_message;
      await handleMention(newMessage);
      break;
    }
    case data.startsWith('tool_'): {
      const [, action, tool, allowUserId] = data.split('_');
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: '你没有权限进行此操作' });
        return;
      }
      if (action === 'demo') {
        bot.answerCallbackQuery(queryId, { callbackText: '开始演示工具...' });
        const newText = `请简单演示下 ${tool} 工具`;
        const newMessage: Message = { ...message, message_id: reply_to_message?.message_id || messageId, from, text: newText };
        delete newMessage.reply_to_message;
        await handleMention(newMessage);
      }
      break;
    }
    case data.startsWith('cmd_'): {
      const [, command, allowUserId] = data.split('_');
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: '你没有权限进行此操作' });
        return;
      }
      bot.answerCallbackQuery(queryId, { callbackText: '开始执行...' });
      const targetCommand = BotCommands.find((cmd) => cmd.name === command);
      if (targetCommand) {
        await targetCommand.action({
          chatId: chat.id,
          messageId,
          userId: Number(allowUserId),
          isCallback: true,
        });
      }
      break;
    }
    case data.startsWith('reaction_'): {
      const reaction = data.split('_')[1];
      const keyName = `reacted_${chat.id}_${messageId}`;
      const reactedUsers = await kv.read<number[]>(rateLimitId, keyName, 'json');

      if (!reactedUsers.success || reactedUsers.data.includes(from.id)) {
        // Notify the user that they have already reacted and stop.
        bot.answerCallbackQuery(queryId, {
          callbackText: '你已做出过反应',
        });
        return;
      }

      bot.answerCallbackQuery(queryId, { callbackText: '反应成功' });
      // Add the user to the reacted list and save it for 48 hours.
      const newReactedUsers = [...reactedUsers.data, from.id];
      await kv.write(rateLimitId, keyName, JSON.stringify(newReactedUsers), { expiration_ttl: 48 * 60 * 60 });

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
        await bot.editMessageReplyMarkup(chat.id, messageId, {
          inline_keyboard: newInlineKeyboard,
        });
      }
      const totalReactionsKeyName = `total_reactions_${chat.id}`;
      const oldTotalReactions = await kv.read<{ like: number; dislike: number }>(durableResourceId, totalReactionsKeyName, 'json');
      if (!oldTotalReactions.success) return;
      const newTotalReactions = {
        like: reaction === 'like' ? oldTotalReactions.data.like + 1 : oldTotalReactions.data.like,
        dislike: reaction === 'dislike' ? oldTotalReactions.data.dislike + 1 : oldTotalReactions.data.dislike,
      };
      await kv.write(durableResourceId, totalReactionsKeyName, JSON.stringify(newTotalReactions));
      break;
    }
    case data.startsWith('delete_'): {
      const [, content, allowUserId] = data.split('_');
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: '你没有权限进行此操作' });
        return;
      }
      if (content === 'message') {
        if (Date.now() - date * 1000 <= 30 * 60 * 1000) {
          bot.answerCallbackQuery(queryId, { callbackText: '消息锁定中，无法删除' });
          return;
        }
        bot.answerCallbackQuery(queryId, { callbackText: '删除成功' });
        await bot.deleteMessage(chat.id, messageId);
      }
      break;
    }
  }
};
