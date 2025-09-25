// src/handlers/message/normal.ts

import { Log, bot, config } from '@/services';
import type * as Bot from '@/types/telegram';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';
import { handleOCR, kv, scheduleDeletion, toHtml } from '@/utils';
import { handleFile } from '@/handlers';
import type { FaqItem } from '@/types';

/**
 * @class FaqMatcher
 * @description 负责根据预设的 FAQ 规则匹配消息文本。
 *              支持复杂的 "AND" "OR" 逻辑以及排除规则。
 */
class FaqMatcher {
  private messageText: string;
  private faqData: FaqItem[];

  constructor(messageText: string, faqData: FaqItem[]) {
    this.messageText = messageText;
    this.faqData = faqData;
  }

  /**
   * 检查单个 "AND" 条件组是否全部匹配消息文本。
   * 仅用于需要布尔结果的场景（如排除规则）。
   * @param group - 一组代表 "AND" 条件的关键词（正则表达式字符串）。
   * @param text - 待测试的文本。
   * @returns 如果全部匹配则返回 true，否则返回 false。
   */
  private static testAndGroup(group: string[], text: string): boolean {
    // 使用 Array.every() 可以确保 group 中的每个关键词都通过测试
    return group.every((pattern) => {
      try {
        return new RegExp(pattern, 'ims').test(text);
      } catch (err) {
        Log.error(`无效的正则表达式模式: "${pattern}"`, { err });
        return false;
      }
    });
  }

  /**
   * 匹配 "AND" 条件组，并返回具体命中的文本片段。
   * @param group - 一组代表 "AND" 条件的关键词（正则表达式字符串）。
   * @param text - 待测试的文本。
   * @returns 如果全部匹配，则返回一个包含所有匹配文本的数组；否则返回 null。
   */
  private static matchAndGroup(group: string[], text: string): string[] | null {
    const matchedTexts: string[] = [];
    for (const pattern of group) {
      try {
        const regex = new RegExp(pattern, 'ims');
        const match = regex.exec(text); // 使用 exec() 获取匹配详情

        if (match) {
          matchedTexts.push(match[0]); // match[0] 是完整匹配的字符串
        } else {
          // "AND" 条件中，一旦有任何一个模式不匹配，则整个组匹配失败
          return null;
        }
      } catch (err) {
        Log.error(`无效的正则表达式模式: "${pattern}"`, { err });
        return null;
      }
    }
    // 如果循环正常结束，说明所有模式都已匹配
    return matchedTexts;
  }

  /**
   * 在 FAQ 数据中寻找第一个匹配消息的条目。
   * @returns 返回匹配的 FaqItem、命中的关键词组以及具体命中的文本片段，否则返回 null。
   */
  public findMatch(): { matchedFaq: FaqItem; winningGroup: string[]; matchedTexts: string[] } | null {
    for (const faqItem of this.faqData) {
      let winningGroup: string[] | null = null;
      let matchedTexts: string[] | null = null;

      // 1. 检查包含规则 (Inclusion Check)
      //    遍历所有关键词组，找到第一个完全匹配的组
      for (const group of faqItem.keywordGroups) {
        const currentMatches = FaqMatcher.matchAndGroup(group, this.messageText);
        if (currentMatches) {
          winningGroup = group;
          matchedTexts = currentMatches;
          break; // 已找到匹配的 "AND" 组，无需再检查此 FAQ 条目的其他组
        }
      }

      // 如果没有找到任何匹配的 "AND" 组，则继续测试下一个 FAQ 条目
      if (!winningGroup || !matchedTexts) {
        continue;
      }

      // 2. 检查排除规则 (Exclusion Check)
      let isExcluded = false;
      if (faqItem.excludeKeywords && faqItem.excludeKeywords.length > 0) {
        // 只要有任何一个排除组匹配，就应该被排除
        isExcluded = faqItem.excludeKeywords.some((group) => FaqMatcher.testAndGroup(group, this.messageText));
      }

      Log.info(`匹配检查: 包含匹配=${!!winningGroup}, 排除匹配=${isExcluded}`);

      // 如果被排除规则命中，则跳过此 FAQ 条目
      if (isExcluded) {
        continue;
      }

      // 成功找到一个未被排除的匹配项
      return { matchedFaq: faqItem, winningGroup, matchedTexts };
    }

    // 遍历完所有 FAQ 条目后仍未找到匹配项
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
    if (this.photo || (this.document?.mime_type?.startsWith('image/') && !this.document.mime_type.endsWith('gif'))) {
      const fileData = await handleFile(this.message).catch(() => null);
      if (fileData) {
        const recognizedText = await handleOCR(fileData);
        if (recognizedText) {
          this.messageText += `\n\n<image>\n${recognizedText}\n</image>`;
        }
      }
    }

    const faqDataResult = await kv.read<FaqItem[]>(this.durableResourceId, this.faqDataKeyName, 'json');
    if (!faqDataResult.success) return false;

    const matcher = new FaqMatcher(this.messageText, faqDataResult.data);
    const matchResult = matcher.findMatch();

    if (matchResult) {
      Log.info('发现匹配的 FAQ 条目。', {
        chatId: this.chatId,
        messageId: this.messageId,
        winningGroup: matchResult.winningGroup, // 命中的关键词规则组
        matchedTexts: matchResult.matchedTexts, // 文本中实际命中的内容
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
