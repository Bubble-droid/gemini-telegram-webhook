// src/handlers/message/NormalMessageHandler.ts

import { BotCommands, faqData } from '@/configs';
import { fileHandler, mentionHandler } from '@/handlers';
import { config, logger } from '@/services';
import type { FaqItem, Message } from '@/types'; // 假设 Message 类型定义路径
import { recognize, taskScheduler, toHtml } from '@/utils';

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
  private async handleCommandAlias(message: Message): Promise<boolean> {
    const text = message.text || message.caption || '';
    if (!text.startsWith(':')) return false;

    const [alias, ...args] = text.replace(':', '').split(/\s+/); // 使用正则分割空白字符更稳健

    // 处理 :ask 别名
    if (alias === 'ask') {
      await mentionHandler.handle(message);
      return true;
    }

    // 处理其他通用脚本别名
    const targetCommand = BotCommands.find(
      (cmd) => cmd.name === alias || cmd.name === `script_${alias}` || cmd.name === `gen_${alias}`,
    );

    if (targetCommand) {
      const cleanText = args.join(' ').trim();
      logger.info(`Handling command alias: ${alias}`, { chatId: message.chat.id });
      await targetCommand.action(message.chat.id, message.from!.id, message.message_id, {
        cleanText,
        message,
      });
      return true;
    }

    return false;
  }

  /**
   * 处理回复机器人的消息
   * @private
   */
  private async handleReplyToBot(message: Message): Promise<boolean> {
    const { reply_to_message } = message;
    if (!reply_to_message) return false;

    if (reply_to_message.from?.username === this.botName) {
      await mentionHandler.handle(message);
      return true;
    }
    return false;
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(message: Message): Promise<boolean> {
    const { chat, message_id, photo, document } = message;
    let messageText = message.text || message.caption || '';

    // 1. OCR 处理 (如果包含图片)
    if (photo || (document?.mime_type?.startsWith('image/') && !document.mime_type.endsWith('gif'))) {
      try {
        const fileData = await fileHandler.handle(message);
        if (fileData) {
          const recognizedText = await recognize.handle(fileData);
          if (recognizedText) {
            messageText += `\n\n<image>\n${recognizedText.replace(/\s/g, '')}\n</image>`;
            logger.info('OCR 识别成功，文本已追加用于匹配。', {
              recognizedText: recognizedText.replace(/\s/g, '').slice(0, 100),
            });
          }
        }
      } catch (err) {
        logger.warn('OCR 处理失败，将仅使用原始文本匹配。', { err });
      }
    }

    // 2. 执行匹配
    const result = this.findFaqMatch(messageText);

    if (result) {
      logger.info('FAQ 匹配成功', {
        chatId: chat.id,
        matchedTexts: result.matches,
      });

      // 发送临时消息
      await taskScheduler.sendTempMessage(chat.id, toHtml(result.matchedFaq.answer), 5 * 60 * 1_000, {
        replyToMessageId: message_id,
        parseMode: 'HTML',
      });
      return true;
    }

    return false;
  }

  /**
   * 处理消息的主入口
   * @public
   */
  public async handle(message: Message): Promise<void> {
    const { chat, message_id } = message;
    logger.info('Handling normal message.', { chatId: chat.id, messageId: message_id });

    // 1. 检查指令别名 (Priority: High)
    if (await this.handleCommandAlias(message)) return;

    // 2. 检查回复 Bot 消息 (Priority: Medium)
    if (await this.handleReplyToBot(message)) return;

    // 3. 检查关键词/FAQ (Priority: Low)
    if (await this.handleKeywordReply(message)) return;
  }
}

// 导出单例实例
export const normalMessageHandler = new NormalMessageHandler();
