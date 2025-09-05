// src/services/ChatContexts.ts

import { Log, config } from '@/services';
import { kv } from '@/utils';
import type { Content } from '@google/genai';

export class ChatContexts {
  private chatContextId: string;
  private maxContextLength: number;
  private contextsExpirationSecond: number;

  constructor() {
    const { chatContextId, maxContextLength, contextsExpirationSecond } = config.load();
    this.chatContextId = chatContextId;
    this.maxContextLength = maxContextLength;
    this.contextsExpirationSecond = contextsExpirationSecond;
  }

  /**
   * @method get
   * @description 获取指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   * @returns {Promise<Content[]>} 对话上下文内容数组。
   */
  public get = async (chatId: number, userId: number): Promise<Content[]> => {
    const keyName: string = `contexts_${chatId}_${userId}`;
    const contexts = await kv.read<Content[]>(this.chatContextId, keyName, 'json');
    return contexts.success ? contexts.data : [];
  };

  /**
   * @method update
   * @description 更新或保存指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   * @param {Content[]} contexts - 要保存的对话上下文内容数组。
   */
  public update = async (chatId: number, userId: number, contexts: Content[]): Promise<void> => {
    const keyName: string = `contexts_${chatId}_${userId}`;
    const historyContexts = await this.get(chatId, userId);
    const newContexts = [...historyContexts, ...contexts];
    if (newContexts.length > this.maxContextLength) {
      newContexts.splice(0, newContexts.length - this.maxContextLength);
    }
    await kv.write(this.chatContextId, keyName, JSON.stringify(newContexts), {
      expiration_ttl: this.contextsExpirationSecond,
    });
    Log.info(`${keyName}: Chat context updated success, current length ${newContexts.length}`);
  };

  /**
   * @method clear
   * @description 清除指定用户在指定聊天中的对话上下文。
   * @param {number} chatId - 聊天的 ID。
   * @param {number} userId - 用户的 ID。
   */
  public clear = async (chatId: number, userId: number): Promise<void> => {
    const keyName: string = `contexts_${chatId}_${userId}`;
    await kv.write(this.chatContextId, keyName, JSON.stringify([]), {
      expiration_ttl: this.contextsExpirationSecond,
    });
    Log.info(`${keyName}: Chat contexts cleared success.`);
  };
}

export const contexts: ChatContexts = new ChatContexts();
