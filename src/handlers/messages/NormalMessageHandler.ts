import { BotCommands, faqData } from '@/configs';
import { ChitChatHandler, mentionHandler } from '@/handlers/messages';
import { config, logger } from '@/services';
import type { FaqItem } from '@/types';
import { MsgPTTL, type ResponseContext } from '@/utils';
import { toHtml } from '@/utils/markdown';

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
 * @description 处理普通消息（非提及、非显式命令）。
 *              采用无状态单例模式，包含正则缓存优化。
 */
export class NormalMessageHandler {
  private readonly botName = config.botName;
  private compiledFaqs: CompiledFaqItem[] = [];
  private chitChatHandler: ChitChatHandler;

  constructor() {
    this.chitChatHandler = new ChitChatHandler();
    this.initFaqData();
  }

  public async handle(ctx: ResponseContext): Promise<void> {
    if (await this.handleCommandAlias(ctx)) return;

    const isReplyToBot = ctx.messages.some((m) => m.reply_to_message?.from?.username === this.botName);
    if (isReplyToBot) {
      await mentionHandler.handle(ctx);
      return;
    }

    try {
      if (await this.handleKeywordReply(ctx)) return;

      if (await this.chitChatHandler.handle(ctx)) return;
    } catch (err) {
      logger.error(`[NormalMessageHandler] Passive processing error`, { err });
    }
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
  private async handleCommandAlias(ctx: ResponseContext): Promise<boolean> {
    const aliasText = ctx.checkCommandAlias();

    if (!aliasText) return false;

    const cleanText = aliasText.slice(1).trim();

    if (cleanText.startsWith('ask')) {
      await mentionHandler.handle(ctx);
      return true;
    }

    const targetCommand = BotCommands.find((cmd) => cleanText.startsWith(cmd.command));

    if (!targetCommand) return false;

    logger.debug(`Handling command alias: ${targetCommand.command}`, { chatId: ctx.chat.id });

    await targetCommand.action({ ctx });

    return true;
  }

  /**
   * 处理 OCR 和关键词回复
   * @private
   */
  private async handleKeywordReply(ctx: ResponseContext): Promise<boolean> {
    const combinedText = ctx.messages
      .map((m) => ctx.getText(m))
      .filter(Boolean)
      .join('\n')
      .trim();

    if (combinedText.length === 0) return false;

    const result = this.findFaqMatch(combinedText);

    if (!result) return false;

    logger.debug('FAQ 匹配成功', {
      chatId: ctx.chat.id,
      matchedTexts: result.matches,
    });

    await ctx.send(toHtml(result.matchedFaq.answer.trim()), {
      parse_mode: 'HTML',
      deleteAfterMs: MsgPTTL['5m'],
    });

    return true;
  }
}
