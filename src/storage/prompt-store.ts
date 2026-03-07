import { DATA_DIR } from '@shared/core/constants.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import * as path from 'node:path';
import { loadData } from './data-load.js';

type PromptKey = (typeof PROMPT_KEYS)[number];

const PROMPT_KEYS = ['assistant', 'chitchat'] as const;
const PROMPT_DIR = path.join(DATA_DIR, 'prompts');

/**
 * @class PromptStore
 * @description 本地提示词仓库管理器。
 *              负责在启动时加载 src/configs/prompts 下的 .md 文件，并提供获取和格式化方法。
 */
export class PromptStore {
  // 缓存存储：Key 是文件名，Value 是文件内容
  private readonly prompts = new Map<string, string>();

  /**
   * 获取原始提示词内容
   * @param key - 提示词键名 (文件名)
   */
  public get(key: PromptKey): string {
    const content = this.prompts.get(key);
    if (!content) {
      logger.warn(`Attempted to access missing prompt: ${key}`);
      return 'You are a helpful and friendly AI assistant.';
    }
    return content;
  }

  /**
   * 获取提示词并进行动态变量替换
   * @param key - 提示词键名
   * @param variables - 需要替换的变量对象，例如 { time: '2023-01-01', model: 'Gemini' }
   * @example
   * // 假设 system.md 中有: "Current time is {{time}}."
   * promptStore.format('system', { time: new Date().toISOString() })
   */
  public format(key: PromptKey, variables: Recordable<string>): string {
    let content = this.get(key);
    for (const [varKey, varValue] of Object.entries(variables)) {
      const regex = new RegExp(`{{${varKey}}}`, 'g');
      content = content.replace(regex, varValue);
    }
    return content;
  }

  /**
   * 加载所有预设的提示词文件到内存
   * @private
   */
  public async initPrompts() {
    for (const key of PROMPT_KEYS) {
      const filePath = path.join(PROMPT_DIR, `${key}.md`);
      try {
        const content = await loadData<string>(filePath, 'text');
        this.prompts.set(key, content.trim());
        logger.info(`Loaded prompt: ${key} (${content.length} chars)`);
      } catch (err) {
        logger.warn(`Failed to load prompt: ${key}`, { err });
      }
    }
  }
}
