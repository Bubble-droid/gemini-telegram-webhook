// src/handlers/callback_query.ts

import { config, Log, bot } from '@/services';
import type { CallbackQuery, InlineKeyboardButton, Message } from '@/types';
import { BotCommands } from '@/configs';
import { kv } from '@/utils';
import { handleMention } from '@/handlers/message';

export class CallbackQueryHandler {
  private message: Message;
  private data: string;
  private queryId: string;
  private userId: number;
  private chatId: number;
  private messageId: number;
  private date: number;
  private replyMarkup: InlineKeyboardButton[][] | undefined;

  constructor(callbackQuery: CallbackQuery) {
    if (!callbackQuery.message || !callbackQuery.data) {
      Log.info('Invalid callback query', { queryId: callbackQuery.id });
      throw new Error('Invalid callback query');
    }

    const { id: queryId, from, message, data } = callbackQuery;
    const { chat, message_id, date, reply_to_message, reply_markup } = message;

    this.queryId = queryId;
    this.userId = from.id;
    this.chatId = chat.id;
    this.messageId = message_id;
    this.date = date;
    this.data = data;
    this.replyMarkup = reply_markup?.inline_keyboard;

    this.message = { ...message, message_id: reply_to_message?.message_id || this.messageId, from };

    Log.info('Handling callback query', { chatId: this.chatId, messageId: this.messageId, userId: this.userId, data: this.data });
  }

  private async _handleMention(): Promise<void> {
    const [, , allowUserId] = this.data.split('_');
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: '你没有权限进行此操作' });
      return;
    }
    bot.answerCallbackQuery(this.queryId, { callbackText: '询问请求...' });
    const newMessageText: string = '简单说明下你能做什么？';
    this.message.text = newMessageText;
    delete this.message.reply_to_message;
    await handleMention(this.message);
  }

  private async _handleTool(): Promise<void> {
    const [, action, tool, allowUserId] = this.data.split('_');
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: '你没有权限进行此操作' });
      return;
    }
    if (action === 'demo') {
      bot.answerCallbackQuery(this.queryId, { callbackText: '开始演示工具...' });
      const newMessageText = `请简单演示下 ${tool} 工具`;
      this.message.text = newMessageText;
      delete this.message.reply_to_message;
      await handleMention(this.message);
    }
  }

  private async _handleCommand(): Promise<void> {
    const [, command, allowUserId] = this.data.split('_');
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: '你没有权限进行此操作' });
      return;
    }
    bot.answerCallbackQuery(this.queryId, { callbackText: '开始执行...' });
    const targetCommand = BotCommands.find((cmd) => cmd.name === command);
    if (targetCommand) {
      await targetCommand.action(this.chatId, Number(allowUserId), this.messageId, {
        isCallback: true,
      });
    }
  }

  private async _handleReaction(): Promise<void> {
    const { rateLimitId, durableResourceId } = config.load();
    const reaction = this.data.split('_')[1];
    const keyName = `reacted_${this.chatId}_${this.messageId}`;
    const readResult = await kv.read<number[]>(rateLimitId, keyName, 'json');

    const reactedUsers = readResult.success ? [...readResult.data] : [];

    if (reactedUsers.includes(this.userId)) {
      bot.answerCallbackQuery(this.queryId, {
        callbackText: '你已做出过反应',
      });
      return;
    }

    bot.answerCallbackQuery(this.queryId, { callbackText: '反应成功' });
    reactedUsers.push(this.userId);
    await kv.write(rateLimitId, keyName, JSON.stringify(reactedUsers), { expiration_ttl: 48 * 60 * 60 });

    const newInlineKeyboard: InlineKeyboardButton[][] = JSON.parse(JSON.stringify(this.replyMarkup));

    let keyboardUpdated = false;
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
            break;
          }
        }
      }
      if (keyboardUpdated) {
        break;
      }
    }

    if (keyboardUpdated) {
      await bot.editMessageReplyMarkup(this.chatId, this.messageId, {
        inline_keyboard: newInlineKeyboard,
      });
    }
    const totalReactionsKeyName = `total_reactions_${this.chatId}`;
    const oldTotalReactions = await kv.read<{ like: number; dislike: number }>(durableResourceId, totalReactionsKeyName, 'json');
    if (!oldTotalReactions.success) return;
    const newTotalReactions = {
      like: reaction === 'like' ? oldTotalReactions.data.like + 1 : oldTotalReactions.data.like,
      dislike: reaction === 'dislike' ? oldTotalReactions.data.dislike + 1 : oldTotalReactions.data.dislike,
    };
    await kv.write(durableResourceId, totalReactionsKeyName, JSON.stringify(newTotalReactions));
  }

  private async _handleDelete(): Promise<void> {
    const [, content, allowUserId] = this.data.split('_');
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: '你没有权限进行此操作' });
      return;
    }
    if (content === 'message') {
      if (Date.now() - this.date * 1000 <= 30 * 60 * 1000) {
        bot.answerCallbackQuery(this.queryId, { callbackText: '消息锁定中，无法删除' });
        return;
      }
      bot.answerCallbackQuery(this.queryId, { callbackText: '删除成功' });
      await bot.deleteMessage(this.chatId, this.messageId);
    }
  }

  public async process(): Promise<void> {
    switch (true) {
      case this.data === 'PLACEHOLDER': {
        bot.answerCallbackQuery(this.queryId);
        break;
      }
      case this.data.startsWith('mention_'): {
        await this._handleMention();
        break;
      }
      case this.data.startsWith('tool_'): {
        await this._handleTool();
        break;
      }
      case this.data.startsWith('cmd_'): {
        await this._handleCommand();
        break;
      }
      case this.data.startsWith('reaction_'): {
        await this._handleReaction();
        break;
      }
      case this.data.startsWith('delete_'): {
        await this._handleDelete();
        break;
      }
    }
  }
}
