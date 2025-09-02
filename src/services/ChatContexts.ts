// src/services/ChatContexts.ts

import { Log, BotConfig } from '@/services';
import { KvNamespace } from '@/utils';
import type { Content } from '@google/genai';

export class ChatContexts {
  /**
   * @method get
   * @description 获取指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   * @returns {Promise<Content[]>} 对话上下文内容数组。
   */
  public static get = async (chatId: number, userId: number): Promise<Content[]> => {
    const { chatContextId } = BotConfig.load();
    const keyName: string = `contexts_${chatId}_${userId}`;
    const contexts = (await KvNamespace.read<Content[]>(chatContextId, keyName, 'json')) || [];

    return contexts;
  };

  /**
   * @method update
   * @description 更新或保存指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   * @param {Content[]} contexts - 要保存的对话上下文内容数组。
   */
  public static update = async (chatId: number, userId: number, contexts: Content[]): Promise<void> => {
    const { chatContextId, maxContextLength, contextsExpirationSecond } = BotConfig.load();
    const keyName: string = `contexts_${chatId}_${userId}`;
    const historyContexts = await ChatContexts.get(chatId, userId);
    const newContexts = [...historyContexts, ...contexts];
    if (newContexts.length > maxContextLength) {
      newContexts.splice(0, newContexts.length - maxContextLength);
    }
    await KvNamespace.write(chatContextId, keyName, JSON.stringify(newContexts), {
      expiration_ttl: contextsExpirationSecond,
    });
    Log.info(`${keyName}: Chat context updated success, current length ${newContexts.length}`);
  };

  /**
   * @method clear
   * @description 清除指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   */
  public static clear = async (chatId: number, userId: number): Promise<void> => {
    const { chatContextId, contextsExpirationSecond } = BotConfig.load();
    const keyName: string = `contexts_${chatId}_${userId}`;
    await KvNamespace.write(chatContextId, keyName, JSON.stringify([]), {
      expiration_ttl: contextsExpirationSecond,
    });
    Log.info(`${keyName}: Chat contexts cleared success.`);
  };
}
