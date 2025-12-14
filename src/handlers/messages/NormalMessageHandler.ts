import { BotCommands, faqData } from '@/configs';
import { fileHandler } from '@/handlers';
import { chitChatHandler, hasImage, mentionHandler } from '@/handlers/messages';
import { config, logger } from '@/services';
import type { FaqItem, Message } from '@/types';
import { recognizer, taskScheduler, toHtml } from '@/utils';

/**
 * 预编译后的 FAQ 条目结构
 * 将字符串正则转换为 RegExp 对象，避免运行时重复编译
 */
interface CompiledFaqItem {
  original: FaqItem;
  keywordGroups: RegExp[][]; // AND 组的正则对象
  excludeGroups: RegExp[][] | null; // 排除组的正则对象
}

/**
 * @class NormalMessageHandler
 * @description 处理普通消息（非提及、非显式命令）。
 *              采用无状态单例模式，包含正则缓存优化。
 */
class NormalMessageHandler {
  private readonly botName: string;
  private compiledFaqs: CompiledFaqItem[] = [];

  constructor() {
    this.botName = config.botName;
    // 初始化时预编译正则表达式，极大提升运行时匹配速度
    this.initFaqData();
  }

  /**
   * 初始化并预编译 FAQ 数据
   * @private
   */
  private initFaqData(): void {
    try {
      this.compiledFaqs = faqData.map((item) => ({
        original: item,
        keywordGroups: item.keywordGroups.map((group) => group.map((pattern) => new RegExp(pattern, 'ims'))),
        excludeGroups: item.excludeKeywords
          ? item.excludeKeywords.map((group) => group.map((pattern) => new RegExp(pattern, 'ims')))
          : null,
      }));
      logger.info(`FAQ 数据加载完成，共预编译 ${this.compiledFaqs.length} 条规则。`);
    } catch (err) {
      logger.error('FAQ 数据预编译失败，请检查正则表达式语法。', { err });
    }
  }

  /**
   * 检查一组正则是否全部匹配文本 (AND 逻辑)
   * @param regexGroup - 预编译好的正则数组
   * @param text - 待检测文本
   */
  private matchAndGroup(regexGroup: RegExp[], text: string): string[] | null {
    const matchedTexts: string[] = [];
    for (const regex of regexGroup) {
      const match = regex.exec(text);
      if (!match) return null; // 只要有一个不匹配，AND 逻辑即失败
      matchedTexts.push(match[0]);
    }
    return matchedTexts;
  }

  /**
   * 在预编译的数据中寻找匹配项
   * @private
   */
  private findFaqMatch(text: string): { matchedFaq: FaqItem; matches: string[] } | null {
    for (const compiled of this.compiledFaqs) {
      let matches: string[] | null = null;

      // 1. 包含匹配 (Inclusion)
      for (const group of compiled.keywordGroups) {
        matches = this.matchAndGroup(group, text);
        if (matches) break; // 找到匹配组，跳出内层循环
      }

      if (!matches) continue; // 当前条目不匹配，继续下一条

      // 2. 排除匹配 (Exclusion)
      if (compiled.excludeGroups) {
        const isExcluded = compiled.excludeGroups.some((group) => {
          // 排除规则只需要测试通过即可，不需要提取文本
          return group.every((regex) => regex.test(text));
        });
        if (isExcluded) continue; // 命中排除规则，跳过此条目
      }

      // 找到最终匹配
      return { matchedFaq: compiled.original, matches };
    }
    return null;
  }

  /**
   * 处理 :ask 等指令别名
   * @private
   */
  private async handleCommandAlias(messages: Message[]): Promise<boolean> {
    const textMsg = messages.find((m) => {
      const text = m.text || m.caption || '';
      return text.startsWith(':');
    });

    if (!textMsg) return false;

    const text = textMsg.text || textMsg.caption || '';

    const cleanText = text.replace(/^:/, '').trim();

    // 处理 :ask 别名
    if (cleanText.startsWith('ask')) {
      await mentionHandler.handleGroup(messages);
      return true;
    }

    // 处理其他通用脚本别名
    const targetCommand = BotCommands.find((cmd) => cleanText.startsWith(cmd.name));

    if (targetCommand) {
      const { chat, from, message_id } = textMsg;
      logger.info(`Handling command alias: ${targetCommand.name}`, { chatId: chat.id });
      await targetCommand.action(chat.id, from!.id, message_id, {
        message: textMsg,
      });
      return true;
    }

    return false;
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(messages: Message[]): Promise<boolean> {
    const textMsg = messages.find((m) => !!(m.text || m.caption)) || messages[0];

    const combinedText = messages
      .map((m) => m.text || m.caption || '')
      .filter(Boolean)
      .join('\n');

    const { chat, message_id } = textMsg;

    // 1. OCR 处理 (如果包含图片)
    const ocrPromises = messages.map(async (msg, i) => {
      if (msg.sticker) return null;
      if (!hasImage(msg)) return null;
      try {
        const fileData = await fileHandler.handle(msg);
        if (!fileData) return null;
        const text = await recognizer.handle(fileData);
        return text ? `\n\n<image_${i + 1}>\n${text}\n</image_${i + 1}>` : null;
      } catch (err) {
        logger.warn('OCR error', { err });
        return null;
      }
    });

    const ocrResults = await Promise.all(ocrPromises);
    const fullText = combinedText + ocrResults.filter(Boolean).join('');

    if (!fullText.trim()) return false;

    // 2. 执行匹配
    const result = this.findFaqMatch(fullText);

    if (result) {
      logger.info('FAQ 匹配成功', {
        chatId: chat.id,
        matchedTexts: result.matches,
      });

      // 发送临时消息
      await taskScheduler.sendTempMessage(chat.id, toHtml(result.matchedFaq.answer.trim()), 5 * 60 * 1_000, {
        replyToMessageId: message_id,
        parseMode: 'HTML',
      });
      return true;
    }

    return false;
  }

  // [新增] 处理消息组
  public async handleGroup(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    logger.info(`Handling normal message group with ${messages.length} items.`);

    // 1. 指令别名
    // 通常 :ask 只会在一条里
    if (await this.handleCommandAlias(messages)) return;

    // 2. 回复 Bot (Handle Reply)
    // 只要有一条是回复 Bot
    const isReplyToBot = messages.some((m) => m.reply_to_message?.from?.username === this.botName);
    if (isReplyToBot) {
      await mentionHandler.handleGroup(messages); // 转交 Mention 处理整组
      return;
    }

    try {
      // 3. 关键词回复 / OCR
      // 这里我们把所有图片拿去 OCR，所有文本拿去匹配
      if (await this.handleKeywordReply(messages)) return;

      // 4. 闲聊 (ChitChat)
      // 传入整组
      if (await chitChatHandler.handleGroup(messages)) return;
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
  }

  /**
   * 处理消息的主入口
   * @public
   */
  public async handle(message: Message): Promise<void> {
    return this.handleGroup([message]);
  }
}

// 导出单例实例
export const normalMessageHandler = new NormalMessageHandler();
