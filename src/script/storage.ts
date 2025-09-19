// src/script/storage.ts

import { config, Log, ScriptError } from '@/services';
import { kv } from '@/utils';

/**
 * @class StorageService
 * @description 负责脚本内容的持久化存储、读取和删除。
 */
export class StorageService {
  private readonly scriptsStorageId: string;

  constructor() {
    const { scriptsStorageId } = config.load();
    this.scriptsStorageId = scriptsStorageId;
  }

  /**
   * 将脚本内容保存到持久化存储中。
   * @param scriptContent - 要存储的 JavaScript 脚本文本内容。
   * @param tag - 脚本的唯一标签。
   * @returns Promise<void>
   * @throws 如果保存失败，则抛出错误。
   */
  public async saveScript(scriptContent: string, tag: string): Promise<void> {
    const result = await kv.write(this.scriptsStorageId, tag, scriptContent);
    if (!result.success) {
      throw new ScriptError(`脚本内容保存失败: ${result.error}`);
    }
    Log.info(`[StorageService] 脚本内容已保存, 标签: ${tag}`);
  }

  /**
   * 根据标签从持久化存储中读取脚本内容。
   * @param tag - 脚本的唯一标签。
   * @returns 返回脚本的文本内容。
   * @throws 如果脚本未找到或读取失败，则抛出错误。
   */
  public async getScript(tag: string): Promise<string> {
    const result = await kv.read<string>(this.scriptsStorageId, tag, 'text');
    if (!result.success) {
      Log.error(`[StorageService] 读取脚本内容失败, 标签: ${tag}`, { err: result.error });
      throw new ScriptError(`脚本内容读取失败: ${result.error}`);
    }
    if (result.data === null || result.data === undefined) {
      throw new ScriptError(`脚本内容未找到, 标签: ${tag}`);
    }
    return result.data;
  }

  /**
   * 根据标签从持久化存储中删除脚本内容。
   * @param tag - 脚本的唯一标签。
   * @returns Promise<void>
   * @throws 如果删除失败，则抛出错误。
   */
  public async deleteScript(tag: string): Promise<void> {
    const result = await kv.delete(this.scriptsStorageId, tag);
    if (!result.success) {
      throw new ScriptError(`脚本内容删除失败: ${result.error}`);
    }
    Log.info(`[StorageService] 脚本内容已删除, 标签: ${tag}`);
  }
}
