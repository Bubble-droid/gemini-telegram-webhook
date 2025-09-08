// src/script/manager.ts

import { storageService } from './storage';
import { executionService } from './execution';
import type { Message, ScriptExecutionResult } from '@/types';
import { config, Log, ScriptError } from '@/services';
import { kv } from '@/utils';

/**
 * @class ScriptManager
 * @description 协调用户脚本的安装、卸载、列出和执行流程。
 *              此类中的方法设计为原子操作，确保数据一致性。
 */
export class ScriptManager {
  private readonly durableResourceId: string;

  constructor() {
    const { durableResourceId } = config.load();
    this.durableResourceId = durableResourceId;
  }

  /**
   * 为指定用户生成脚本列表在 KV 存储中的键名。
   * @param userId - 用户的唯一 ID。
   * @returns 返回格式化的键名。
   */
  private _getUserScriptsKey(userId: number): string {
    return `user_scripts_${userId}`;
  }

  /**
   * 获取指定用户的脚本标签列表。
   * @param userId - 用户的唯一 ID。
   * @returns 返回一个包含用户所有脚本标签的数组。如果用户没有任何脚本，则返回空数组。
   * @throws 如果读取列表失败，则抛出错误。
   */
  private async _getUserScripts(userId: number): Promise<string[]> {
    const key = this._getUserScriptsKey(userId);
    const result = await kv.read<string[]>(this.durableResourceId, key, 'json');

    if (!result.success) {
      // 如果键不存在，是正常情况，表示用户还没有脚本，返回空数组
      if (result.error.includes('key not found')) {
        return [];
      }
      // 其他错误则抛出
      throw new ScriptError(`读取用户脚本列表失败: ${result.error}`);
    }
    return result.data ?? [];
  }

  /**
   * 保存指定用户的脚本标签列表。
   * @param userId - 用户的唯一 ID。
   * @param scripts - 最新的脚本标签数组。
   * @throws 如果写入列表失败，则抛出错误。
   */
  private async _saveUserScripts(userId: number, scripts: string[]): Promise<void> {
    const key = this._getUserScriptsKey(userId);
    const result = await kv.write(this.durableResourceId, key, JSON.stringify(scripts));
    if (!result.success) {
      throw new ScriptError(`更新用户脚本列表失败: ${result.error}`);
    }
  }

  /**
   * 为指定用户安装一个新脚本（原子操作）。
   * 首先保存脚本内容，然后将标签添加到用户脚本列表中。
   * @param userId - 用户 ID。
   * @param url - 脚本的在线链接。
   * @param tag - 脚本的唯一标签。
   * @throws 如果脚本已存在、下载失败或任何存储步骤失败。
   */
  public async installForUser(userId: number, url: string, tag: string): Promise<void> {
    const userScripts = await this._getUserScripts(userId);
    if (userScripts.includes(tag)) {
      Log.warn(`脚本标签 "${tag}" 已存在，将覆盖已有的脚本。`);
    }

    Log.info(`[ScriptManager] 正在为用户 ${userId} 从 ${url} 下载脚本...`);
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new ScriptError(`下载脚本失败，状态码: ${response.status}`);
    }
    const scriptContent = await response.text();
    if (typeof scriptContent !== 'string' || scriptContent.trim() === '') {
      throw new ScriptError('下载的脚本内容无效或为空。');
    }

    // 关键步骤：先保存脚本内容，再更新用户列表
    await storageService.saveScript(scriptContent, tag);

    try {
      if (!userScripts.includes(tag)) {
        const updatedScripts = [...userScripts, tag];
        await this._saveUserScripts(userId, updatedScripts);
      }
      Log.info(`[ScriptManager] 用户 ${userId} 的脚本安装成功，标签: ${tag}`);
    } catch (error) {
      // 回滚操作：如果更新用户列表失败，则删除已保存的脚本内容
      Log.error(`[ScriptManager] 更新用户脚本列表失败，正在回滚...`, { err: error });
      await storageService.deleteScript(tag);
      throw error; // 将原始错误继续向上抛出
    }
  }

  /**
   * 为指定用户卸载一个脚本（原子操作）。
   * 首先从用户脚本列表中移除标签，然后删除脚本内容。
   * @param userId - 用户 ID。
   * @param tag - 要卸载脚本的标签。
   * @throws 如果脚本不存在或任何存储步骤失败。
   */
  public async uninstallForUser(userId: number, tag: string): Promise<void> {
    const userScripts = await this._getUserScripts(userId);
    if (!userScripts.includes(tag)) {
      throw new ScriptError(`脚本卸载失败：未找到标签为 "${tag.replace(`script_${userId}_`, '')}" 的脚本。`);
    }

    // 关键步骤：先更新用户列表，再删除脚本内容
    const updatedScripts = userScripts.filter((t) => t !== tag);
    await this._saveUserScripts(userId, updatedScripts);

    try {
      await storageService.deleteScript(tag);
      Log.info(`[ScriptManager] 用户 ${userId} 的脚本卸载成功，标签: ${tag}`);
    } catch (error) {
      // 警告：此时用户列表已更新，但脚本内容删除失败。
      // 这是一个可以接受的最终一致性状态，因为脚本已无法通过用户列表访问。
      // 记录严重错误以供后续手动清理。
      Log.error(`[ScriptManager] 脚本内容删除失败，但用户列表已更新。标签: ${tag}`, { err: error });
      // 尽管内容删除失败，但从用户角度看，脚本已卸载，所以不向上抛出错误。
    }
  }

  /**
   * 列出指定用户已安装的所有脚本。
   * @param userId - 用户 ID。
   * @returns 返回一个包含用户所有脚本标签的数组。
   */
  public async listForUser(userId: number): Promise<string[]> {
    return this._getUserScripts(userId);
  }

  /**
   * 为指定用户执行一个已安装的脚本。
   * @param userId - 用户 ID。
   * @param tag - 脚本的唯一标签。
   * @param param - (可选) 传递给脚本的参数。
   * @returns 返回脚本的执行结果。
   */
  public async runForUser(userId: number, tag: string, message: Message, param?: string): Promise<ScriptExecutionResult> {
    Log.info(`[ScriptManager] 用户 ${userId} 准备执行脚本，标签: ${tag}`);

    // 安全性检查：确保用户拥有该脚本
    const userScripts = await this._getUserScripts(userId);
    if (!userScripts.includes(tag)) {
      return {
        success: false,
        error: `权限错误：你未安装标签为 "${tag.replace(`script_${userId}_`, '')}" 的脚本。`,
        duration: 0,
      };
    }

    try {
      const scriptContent = await storageService.getScript(tag);
      return executionService.executeScript(scriptContent, message, param);
    } catch (error) {
      const message = error instanceof ScriptError ? error.message : String(error);
      return {
        success: false,
        error: `脚本执行准备失败: ${message}`,
        duration: 0,
      };
    }
  }
}

export const scriptManager: ScriptManager = new ScriptManager();
