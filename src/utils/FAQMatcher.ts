import { DATA_DIR } from '@/configs/constant';
import { logger } from '@/services';
import type { FaqItem } from '@/types';
import { join } from 'node:path';
import { fetchFile, generateRawUrl } from './helpers';

/**
 * 预编译后的 FAQ 条目结构
 * 将字符串正则转换为 RegExp 对象，避免运行时重复编译
 */
interface CompiledFaqItem {
  readonly original: FaqItem;
  readonly keywordGroups: readonly (readonly RegExp[])[]; // AND 组的正则对象
  readonly excludeGroups: readonly (readonly RegExp[])[] | null; // 排除组的正则对象
}

interface MatchResult {
  matchedFaq: FaqItem;
  matches: string[];
}

const FAQ_DATA_PATH = join(DATA_DIR, 'faq-data.json');

class FAQMatcher {
  // 使用 Set 存储编译后的条目，虽然迭代速度与数组相当，但在动态添加/删除规则时具有 O(1) 优势
  private readonly compiledFaqs = new Set<CompiledFaqItem>();

  /**
   * 在预编译的数据中寻找匹配项
   * 使用 Arrow Function 确保上下文安全
   */
  public findFaqMatch(text: string): MatchResult | null {
    // 快速路劲：空文本直接返回
    if (!text.trim()) return null;

    // Set 迭代：按照插入顺序遍历 (对于优先级敏感的 FAQ 很重要)
    for (const compiled of this.compiledFaqs) {
      let matches: string[] | null = null;

      // 1. 包含匹配 (Inclusion Logic - OR Groups)
      // 只要有一个 Group 满足条件 (该 Group 内所有正则均为 AND)
      for (const group of compiled.keywordGroups) {
        matches = this.matchAndGroup(group, text);
        if (matches) break; // 找到第一个匹配组即停止，无需测试后续组
      }

      // 如果没有任何包含组匹配，继续检查下一个 FAQ 条目
      if (!matches) continue;

      // 2. 排除匹配 (Exclusion Logic)
      // 如果存在排除组，且满足任意一个排除组的所有条件
      if (compiled.excludeGroups) {
        const isExcluded = compiled.excludeGroups.some((group) =>
          // every: 组内必须全部匹配才算命中排除
          // test: 仅需验证是否存在，比 exec 更快
          group.every((regex) => regex.test(text)),
        );
        if (isExcluded) continue; // 命中排除规则，跳过此 FAQ
      }

      // 找到最终匹配，直接返回结果
      return { matchedFaq: compiled.original, matches };
    }

    return null;
  }

  public async reload() {
    logger.info('Reloading all FAQ data...');
    this.compiledFaqs.clear();
    await this.initFaqData();
  }

  /**
   * 初始化并预编译 FAQ 数据
   * @private
   */
  private async initFaqData() {
    const url = generateRawUrl(FAQ_DATA_PATH);

    try {
      const faqData = (await fetchFile(url, 'json', {
        method: 'GET',
        redirect: 'follow',
      })) as unknown as FaqItem[];

      // 遍历 FAQ 数据，预编译正则表达式

      for (const item of faqData) {
        // 构建编译后的对象
        const compiledItem: CompiledFaqItem = {
          original: item,
          keywordGroups: item.keywordGroups.map((group) => group.map((pattern) => new RegExp(pattern, 'ims'))),
          excludeGroups: item.excludeKeywords
            ? item.excludeKeywords.map((group) => group.map((pattern) => new RegExp(pattern, 'ims')))
            : null,
        };
        // Set.add 保证了引用唯一性
        this.compiledFaqs.add(compiledItem);
      }

      logger.info(`FAQ 数据加载完成，共预编译 ${this.compiledFaqs.size} 条规则。`);
    } catch (err) {
      logger.error('FAQ 数据预编译失败，请检查 JSON 格式或正则表达式语法。', { err });
    }
  }

  /**
   * 检查一组正则是否全部匹配文本 (AND Logic)
   * 利用 Set 特性对捕获的关键词进行去重
   *
   * @param regexGroup - 预编译好的正则数组
   * @param text - 待检测文本
   */
  private matchAndGroup = (regexGroup: readonly RegExp[], text: string): string[] | null => {
    // 利用 Set 的优势：自动去重
    // 如果多个正则匹配到了同一个关键词（或重叠部分），返回结果中应保持唯一性，方便后续高亮处理
    const uniqueMatches = new Set<string>();

    for (const regex of regexGroup) {
      const match = regex.exec(text);

      // AND 逻辑核心：只要有一个正则不匹配，整组判定失败
      if (!match) return null;

      uniqueMatches.add(match[0]);
    }

    // 将 Set 转换回数组返回
    return [...uniqueMatches];
  };
}

export const faqMatcher = new FAQMatcher();
