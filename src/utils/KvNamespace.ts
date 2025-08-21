// src/utils/KvNamespace.ts

import Cloudflare from 'cloudflare';
import { Log, BotConfig, KvNamespaceError } from '@/services';
import type { ValueAction, ValueActionBaseParams, ValueActionUpdateParams } from '@/types';

export class KvNamespace {
  private static callCloudflareApi = async <P, R>(action: ValueAction, params: P): Promise<R | void> => {
    const { cloudflareToken, cloudflareAccountId } = BotConfig.load();
    const { namespaceId, keyName, value, expiration_ttl } = params as ValueActionUpdateParams;
    const client = new Cloudflare({
      apiToken: cloudflareToken,
    });
    try {
      if (action === 'update') {
        await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
          value,
          expiration_ttl,
        });
      } else {
        const response = await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
        });
        return response as R;
      }
    } catch (error: unknown) {
      Log.error('Error calling Cloudflare API:', {
        err: error instanceof Error ? error.message : String(error),
      });
      throw new KvNamespaceError(`Error calling Cloudflare API: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * 从 Cloudflare KV 读取数据
   * @param {string} namespaceId - KV Namespace 绑定
   * @param {string} keyName - 要读取的键
   * @returns {Promise<>} 读取到的数据，如果键不存在则返回 null
   */
  public static read = async <T>(namespaceId: string, keyName: string, resData: 'json' | 'text'): Promise<T | null> => {
    try {
      const data = (await KvNamespace.callCloudflareApi<ValueActionBaseParams, Response>('get', {
        namespaceId,
        keyName,
      })) as Response;
      return (resData === 'json' ? await data.json() : await data.text()) as T;
    } catch (error) {
      Log.error(`Error reading from KV for ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };
  /**
   * 向 Cloudflare KV 写入数据
   * @param {namespaceId} namespaceId - KV Namespace 绑定
   * @param {string} keyName - 要写入的键
   * @param {any} value - 要写入的值
   * @param {{ expiration_ttl?: number }} options - 可选参数，如 TTL
   * @returns {Promise<void>}
   */
  public static write = async (namespaceId: string, keyName: string, value: string, options: { expiration_ttl?: number } = {}): Promise<void> => {
    try {
      await KvNamespace.callCloudflareApi<ValueActionUpdateParams, void>('update', {
        namespaceId,
        keyName,
        value,
        ...options,
      });
    } catch (error) {
      Log.error(`Error writing to KV for keyName ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * 从 Cloudflare KV 删除数据
   * @param {namespaceId} namespaceId - KV Namespace 绑定
   * @param {string} keyName - 要删除的键
   * @returns {Promise<void>}
   */
  public static delete = async (namespaceId: string, keyName: string): Promise<void> => {
    try {
      await KvNamespace.callCloudflareApi<ValueActionBaseParams, void>('delete', {
        namespaceId,
        keyName,
      });
      Log.info(`Deleted from ${namespaceId} - keyName: ${keyName}`);
    } catch (error) {
      Log.error(`Error deleting from KV for keyName ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
