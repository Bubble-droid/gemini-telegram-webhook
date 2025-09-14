// src/handlers/message/normal.ts

import { Log, bot, config } from '@/services';
import type { Message } from '@/types';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';
import { faqData } from '@/configs';
import { scheduleDeletion, toHtml } from '@/utils';

/**
 * @class NormalHandler
 * @description 处理接收到的 Telegram 普通消息（非提及、非命令）。
 *              此类负责检查消息是否是对 Bot 消息的回复，并对回复内容进行清理后，
 *              转交给提及消息处理器处理。同时，它也处理指令别名和预留的关键词回复。
 */
export class NormalHandler {
  private readonly botName: string;
  private readonly message: Message;
  private readonly chatId: number;
  private readonly userId: number;
  private readonly messageId: number;
  private readonly replyToMessage?: Message;
  private readonly messageText: string;

  constructor(message: Message) {
    this.botName = config.load().botName;
    const { message_id, chat, from, reply_to_message, text, caption } = message;
    this.message = message;
    this.chatId = chat.id;
    this.userId = from?.id as number;
    this.messageId = message_id;
    this.replyToMessage = reply_to_message;
    this.messageText = text || caption || '';

    Log.info('Handling normal message.', { chatId: this.chatId, messageId: this.messageId });
  }

  private async sendReply(text: string): Promise<void> {
    const sentResult = await bot.sendMessage(this.chatId, toHtml(text), {
      replyToMessageId: this.messageId,
      parseMode: 'HTML',
    });
    if (sentResult.ok) {
      scheduleDeletion(this.chatId, sentResult.messageId, 5 * 60 * 1_000);
    }
  }

  private async handleAskAlias(): Promise<boolean> {
    await handleMention(this.message);
    return true;
  }

  private async handleGenericCommandAlias(commandAlias: string, clean: string[]): Promise<boolean> {
    const commandAction = BotCommands.find(
      (command) => command.name === commandAlias || command.name === `script_${commandAlias}` || command.name === `gen_${commandAlias}`,
    );
    if (commandAction) {
      const cleanText = clean.join(' ').trim();
      Log.info('Handling commands message...', { chatId: this.chatId, messageId: this.messageId });
      await commandAction.action(this.chatId, this.userId, this.messageId, { cleanText, message: this.message });
      return true;
    }
    return false;
  }

  private async handleCommandAlias(): Promise<boolean> {
    if (!this.messageText.startsWith(':')) {
      return false;
    }
    const [commandAlias, ...clean] = this.messageText.replace(':', '').split(' ');
    if (commandAlias === 'ask') {
      return this.handleAskAlias();
    }
    return this.handleGenericCommandAlias(commandAlias, clean);
  }

  /**
   * @description 该方法动态构建正则表达式，以灵活匹配用户消息，并回复相应的 FAQ 答案。
   * @returns {Promise<boolean>} 如果进行了关键词回复，则返回 true，否则返回 false。
   */
  private async handleKeywordReply(): Promise<boolean> {
    // 寻找第一个能够完全匹配用户消息的 FAQ 条目
    const matchedFaq = faqData.find((faqItem) => {
      // 将多个 "与" 条件组 (`keywordGroups`) 映射成一个由 "或" 连接的完整正则表达式
      const pattern = faqItem.keywordGroups
        .map((group) => {
          // 对于每个 "与" 条件组，将其中的所有正则模式转换为正向预查 `(?=.*pattern)`
          // 这可以确保消息中包含所有模式，且不关心它们的顺序
          const andConditions = group.map((p) => `(?=.*${p})`).join('');
          // 返回一个代表完整 "与" 条件的字符串
          return `(${andConditions})`;
        })
        .join('|'); // 使用 "|" 将所有 "与" 条件组连接起来，形成最终的 "或" 逻辑

      // 创建一个新的正则表达式对象，并启用不区分大小写模式 ('i')
      const regex = new RegExp(pattern, 'i');

      // 测试用户消息是否匹配构建好的正则表达式
      return regex.test(this.messageText);
    });

    // 如果找到了匹配项
    if (matchedFaq) {
      Log.info('Found a matching FAQ item via regex, sending reply.', {
        chatId: this.chatId,
        messageId: this.messageId,
      });
      // 发送对应的答案
      await this.sendReply(matchedFaq.answer);
      // 返回 true，表示消息已被处理
      return true;
    }

    // 如果没有找到匹配项，返回 false
    return false;
  }

  private async handleReplyToBot(): Promise<boolean> {
    if (!this.replyToMessage) return false;
    if (this.replyToMessage.from?.username === this.botName) {
      await handleMention(this.message);
      return true;
    }
    return false;
  }

  public async process(): Promise<void> {
    if (await this.handleKeywordReply()) {
      return;
    }
    if (await this.handleCommandAlias()) {
      return;
    }
    if (await this.handleReplyToBot()) {
      return;
    }
  }
}
