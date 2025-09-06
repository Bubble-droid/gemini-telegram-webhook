// src/utils/KvNamespace.ts

import Cloudflare from 'cloudflare';
import { Log, config, KvNamespaceError } from '@/services';
import type { ValueAction, ValueBaseParams, ValueUpdateActionParams } from '@/types';

export class KvNamespace {
  private callCloudflareApi = async <P, R>(action: ValueAction, baseParams: ValueBaseParams, actionParams?: P): Promise<R | void> => {
    const { cloudflareToken, cloudflareAccountId } = config.load();
    const { namespaceId, keyName } = baseParams;
    const client = new Cloudflare({
      apiToken: cloudflareToken,
    });
    try {
      if (action === 'update') {
        const { value, options } = actionParams as ValueUpdateActionParams;
        await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
          value,
          ...options,
        });
      } else {
        const response = await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
        });
        return response as R;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Log.error('Error calling Cloudflare API:', {
        err: errorMessage,
      });
      throw new KvNamespaceError(`Error calling Cloudflare API: ${errorMessage}`);
    }
  };

  /**
   * 从 Cloudflare KV 读取数据
   * @param {string} namespaceId - KV Namespace 绑定
   * @param {string} keyName - 要读取的键
   * @returns {Promise<>} 读取到的数据，如果键不存在则返回 null
   */
  public read = async <T>(
    namespaceId: string,
    keyName: string,
    resData: 'json' | 'text',
  ): Promise<{ success: true; data: T } | { success: false; error: string }> => {
    try {
      const data = (await this.callCloudflareApi<ValueBaseParams, Response>('get', {
        namespaceId,
        keyName,
      })) as Response;
      return { success: true, data: (resData === 'json' ? await data.json() : await data.text()) as T };
    } catch (error: unknown) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error reading from KV for ${keyName}:`, {
        err: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
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
  public write = async (
    namespaceId: string,
    keyName: string,
    value: string,
    options?: ValueUpdateActionParams['options'],
  ): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      await this.callCloudflareApi<ValueUpdateActionParams, void>(
        'update',
        { namespaceId, keyName },
        {
          value,
          options,
        },
      );
      return {
        success: true,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error writing to KV for keyName ${keyName}:`, {
        err: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * 从 Cloudflare KV 删除数据
   * @param {namespaceId} namespaceId - KV Namespace 绑定
   * @param {string} keyName - 要删除的键
   * @returns {Promise<void>}
   */
  public delete = async (namespaceId: string, keyName: string): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      await this.callCloudflareApi<ValueBaseParams, void>('delete', {
        namespaceId,
        keyName,
      });
      Log.info(`Deleted from ${namespaceId} - keyName: ${keyName}`);
      return {
        success: true,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error deleting from KV for keyName ${keyName}:`, {
        err: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  };
}

export const kv: KvNamespace = new KvNamespace();
