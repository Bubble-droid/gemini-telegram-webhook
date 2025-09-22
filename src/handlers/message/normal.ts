// src/handlers/message/normal.ts

import { Log, bot, config } from '@/services';
import type * as Bot from '@/types/telegram';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';
import { handleOCR, kv, scheduleDeletion, toHtml } from '@/utils';
import { handleFile } from '@/handlers';
import type { FaqItem } from '@/types';

class FaqMatcher {
  private messageText: string;
  private faqData: FaqItem[];

  constructor(messageText: string, faqData: FaqItem[]) {
    this.messageText = messageText;
    this.faqData = faqData;
  }

  /**
   * 检查单个 "AND" 条件组是否全部匹配消息文本。
   * @param group - 一组代表 "AND" 条件的关键词（正则表达式字符串）。
   * @returns 如果全部匹配则返回 true，否则返回 false。
   */
  private static testAndGroup(group: string[], text: string): boolean {
    // 使用 Array.every() 可以确保 group 中的每个关键词都通过测试
    return group.every((pattern) => {
      try {
        // 为每个模式创建一个独立的正则表达式进行测试
        return new RegExp(pattern, 'ims').test(text);
      } catch (err) {
        // 如果模式无效，则记录错误并返回 false
        Log.error(`无效的正则表达式模式: "${pattern}"`, { err });
        return false;
      }
    });
  }

  /**
   * 在 FAQ 数据中寻找第一个匹配消息的条目。
   * @returns 返回匹配的 FaqItem 和命中的关键词组，否则返回 null。
   */
  public findMatch(): { matchedFaq: FaqItem; winningGroup: string[] } | null {
    for (const faqItem of this.faqData) {
      // 1. 检查包含规则 (Inclusion Check)
      //    找到第一个满足其内部所有 "AND" 条件的 `group`
      const winningGroup = faqItem.keywordGroups.find((group) => FaqMatcher.testAndGroup(group, this.messageText));

      // 如果没有找到任何匹配的 "AND" 组，则继续测试下一个 FAQ 条目
      if (!winningGroup) {
        continue;
      }

      // 2. 检查排除规则 (Exclusion Check)
      let isExcluded = false;
      if (faqItem.excludeKeywords && faqItem.excludeKeywords.length > 0) {
        // 只要有任何一个排除组匹配，就应该被排除
        isExcluded = faqItem.excludeKeywords.some((group) => FaqMatcher.testAndGroup(group, this.messageText));
      }

      Log.info(`包含匹配: ${!!winningGroup}, 排除匹配: ${isExcluded}`);

      // 如果被排除规则命中，则跳过此 FAQ 条目
      if (isExcluded) {
        continue;
      }

      return { matchedFaq: faqItem, winningGroup };
    }

    return null;
  }
}

/**
 * @class NormalHandler
 * @description 处理接收到的 Telegram 普通消息（非提及、非命令）。
 *              此类负责检查消息是否是对 Bot 消息的回复，并对回复内容进行清理后，
 *              转交给提及消息处理器处理。同时，它也处理指令别名和预留的关键词回复。
 */
export class NormalHandler {
  private readonly durableResourceId: string;
  private readonly faqDataKeyName: string;
  private readonly botName: string;
  private readonly message: Bot.Message;
  private readonly chatId: number;
  private readonly userId: number;
  private readonly messageId: number;
  private readonly replyToMessage: Bot.Message | undefined;
  private readonly photo: Bot.PhotoSize[] | undefined;
  private readonly document: Bot.Document | undefined;
  private messageText: string;

  constructor(message: Bot.Message) {
    const { durableResourceId, botName } = config.load();
    this.durableResourceId = durableResourceId;
    this.faqDataKeyName = 'faq_data';
    this.botName = botName;
    const { message_id, chat, from, reply_to_message, photo, document, text, caption } = message;
    this.message = message;
    this.chatId = chat.id;
    this.userId = from?.id as number;
    this.messageId = message_id;
    this.replyToMessage = reply_to_message;
    this.photo = photo;
    this.document = document;
    this.messageText = text || caption || '';

    Log.info('Handling normal message.', { chatId: this.chatId, messageId: this.messageId });
  }

  private async sendReply(text: string): Promise<void> {
    const sentResult = await bot.sendMessage(this.chatId, toHtml(text), {
      replyToMessageId: this.messageId,
      parseMode: 'HTML',
    });
    if (sentResult.ok) {
      scheduleDeletion(this.chatId, sentResult.messageId, 10 * 60 * 1_000);
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
   *              它现在支持排除规则，并能在日志中记录命中的具体关键词。
   * @returns {Promise<boolean>} 如果进行了关键词回复，则返回 true，否则返回 false。
   */
  private async handleKeywordReply(): Promise<boolean> {
    // 步骤 1: (可选) 如果消息包含图片，执行 OCR 并将识别文本附加到消息中
    if (this.photo || this.document?.mime_type?.startsWith('image/')) {
      const fileData = await handleFile(this.message).catch(() => null);
      if (fileData) {
        const recognizedText = await handleOCR(fileData);
        this.messageText += recognizedText ? `\n\n<image>\n${recognizedText}\n</image>` : `\n\n<image>\nRECOGNITION_FAILED\n</image>`;
      }
    }

    const faqDataResult = await kv.read<FaqItem[]>(this.durableResourceId, this.faqDataKeyName, 'json');
    if (!faqDataResult.success) return false;

    const matcher = new FaqMatcher(this.messageText, faqDataResult.data);
    const matchResult = matcher.findMatch();

    if (matchResult) {
      Log.info('Found a matching FAQ item. Matched keywords group:', {
        chatId: this.chatId,
        messageId: this.messageId,
        keywords: matchResult.winningGroup, // winningGroup 就是实际命中的关键词数组
      });

      await this.sendReply(matchResult.matchedFaq.answer);
      return true;
    }

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
    if (await this.handleCommandAlias()) {
      return;
    }
    if (await this.handleReplyToBot()) {
      return;
    }
    if (await this.handleKeywordReply()) {
      return;
    }
  }
}
