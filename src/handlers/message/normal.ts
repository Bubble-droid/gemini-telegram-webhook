// src/handlers/message/normal.ts

import { Log, bot, config } from '@/services';
import type * as Bot from '@/types/telegram';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';
import { handleOCR, kv, scheduleDeletion, toHtml } from '@/utils';
import { handleFile } from '@/handlers';
import type { FaqItem } from '@/types';

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

    // 步骤 2: 寻找第一个满足条件的 FAQ 条目
    // console.log(`--- 开始为消息 "${this.messageText}" 匹配FA/Q ---`); // [调试日志]

    const matchedFaq = faqDataResult.data.find((faqItem, index) => {
      // --- [调试日志] 打印当前正在测试的规则 ---
      // console.log(`[${index}] 正在测试规则:`, faqItem.keywordGroups[0]);

      // --- 包含逻辑检查 (Inclusion Check) ---
      const inclusionPattern = faqItem.keywordGroups.map((group) => `(${group.map((p) => `(?=.*${p})`).join('')})`).join('|');
      const inclusionRegex = new RegExp(inclusionPattern, 'ims');
      const isMatch = inclusionRegex.test(this.messageText);

      // --- [调试日志] 打印当前规则的匹配结果 ---
      // console.log(`    --> 匹配结果 (isMatch): ${isMatch}`);

      if (!isMatch) {
        return false;
      }

      // --- 排除逻辑检查 (Exclusion Check) ---
      if (faqItem.excludeKeywords && faqItem.excludeKeywords.length > 0) {
        const exclusionPattern = faqItem.excludeKeywords.map((group) => `(${group.map((p) => `(?=.*${p})`).join('')})`).join('|');
        const exclusionRegex = new RegExp(exclusionPattern, 'ims');
        const isExcluded = exclusionRegex.test(this.messageText);

        // --- [调试日志] 打印排除逻辑的结果 ---
        // console.log(`    --> 排除结果 (isExcluded): ${isExcluded}`);

        if (isExcluded) {
          return false;
        }
      }

      // 如果一个规则最终被确定为匹配，打印一条成功信息
      // console.log(`🎉 成功匹配规则 #${index}！find() 循环终止。`);

      return true;
    });

    // 步骤 3: 如果找到了匹配项，则发送回复
    if (matchedFaq) {
      // --- [新增] 提取并记录命中的关键词 ---
      const matchedKeywords: string[] = [];
      // 找到具体是哪一个 "与" 条件组 (group) 命中了
      const winningGroup = matchedFaq.keywordGroups.find((group) => {
        const groupPattern = group.map((p) => `(?=.*${p})`).join('');
        return new RegExp(groupPattern, 'ims').test(this.messageText);
      });

      // 如果找到了获胜组，则提取其中每个模式匹配到的文本
      if (winningGroup) {
        for (const pattern of winningGroup) {
          // 注意：这里我们为每个模式创建一个新的、简单的 RegExp 来提取文本
          // 因为 `(?=...)` 正向预查本身不消耗字符，无法用于捕获
          const matchResult = this.messageText.match(new RegExp(pattern, 'ims'));
          if (matchResult) {
            // matchResult[0] 包含实际匹配到的文本
            matchedKeywords.push(matchResult[0]);
          }
        }
      }

      Log.info('Found a matching FAQ item. Matched keywords:', {
        chatId: this.chatId,
        messageId: this.messageId,
        keywords: matchedKeywords, // 输出实际命中的关键词数组
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
