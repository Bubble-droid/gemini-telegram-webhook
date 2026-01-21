// src/services/PromptStore.ts

import { DATA_DIR } from '@/configs/data';
import { logger } from '@/services';
import type { Recordable } from '@/types';
import fs from 'node:fs';
import path from 'node:path';
import { readTextFile } from './helpers';

const PromptKeys = ['assistant', 'file-search', 'github-toolset', 'built-in-tools', 'chit-chat'] as const;

type PromptKey = (typeof PromptKeys)[number];

const PROMPT_DIR = path.join(DATA_DIR, 'prompts');

/**
 * @class PromptStore
 * @description 本地提示词仓库管理器。
 *              负责在启动时加载 src/configs/prompts 下的 .md 文件，并提供获取和格式化方法。
 */
class PromptStore {
  // 缓存存储：Key 是文件名，Value 是文件内容
  private prompts = new Map<string, string>();

  constructor() {
    this.loadAllPrompts();
  }

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

    // 简单的模板引擎：将 {{key}} 替换为 value
    Object.entries(variables).forEach(([varKey, varValue]) => {
      // 创建正则，全局替换 {{varKey}}
      const regex = new RegExp(`{{${varKey}}}`, 'g');
      content = content.replace(regex, varValue);
    });

    return content;
  }

  /**
   * 重新加载提示词 (用于不重启服务更新提示词)
   */
  public reload(): void {
    logger.info('Reloading all prompts...');
    this.prompts.clear();
    this.loadAllPrompts();
  }

  /**
   * 加载所有预设的提示词文件到内存
   * @private
   */
  private loadAllPrompts(): void {
    // 这里列出你需要加载的文件名列表
    // 也可以改为 fs.readdirSync 自动扫描，但显式列出更安全、更类型友好

    for (const key of PromptKeys) {
      try {
        const filePath = path.join(PROMPT_DIR, `${key}.md`);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          logger.warn(`Prompt file not found: ${filePath}`);
          return;
        }

        // 同步读取，确保应用启动就绪前数据已加载
        const content = readTextFile(filePath);

        // 简单的预处理（如去除首尾空白）
        this.prompts.set(key, content.trim());

        logger.info(`Loaded prompt: ${key} (${content.length} chars)`);
      } catch (err) {
        logger.error(`Failed to load prompt: ${key}`, { err });
      }
    }
  }
}

// 导出单例
export const promptStore = new PromptStore();
