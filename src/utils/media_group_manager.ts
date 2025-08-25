// src/utils/media_group_manager.ts

import type { Message } from '@/types';
import { Log } from '@/services';

/**
 * 定义聚合后的媒体组消息结构。
 * 包含所有属于该媒体组的消息以及统一的标题。
 */
export interface AggregatedMessage {
  messages: Message[];
  caption: string | undefined;
}

/**
 * 媒体组聚合的等待时间（毫秒）。
 * 在此时间内收集所有属于同一个媒体组的消息。
 */
export const MEDIA_GROUP_COLLECTION_TIMEOUT_MS = 3000; // 1秒

/**
 * 媒体组的内部状态结构。
 * 用于 `activeMediaGroups` Map 的值类型。
 */
interface MediaGroupState {
  messages: Message[];
  caption: string | undefined;
  timeoutId: NodeJS.Timeout | null; // 明确类型为 NodeJS.Timeout | null
  resolve: (value: AggregatedMessage) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<AggregatedMessage>; // 存储 Promise 本身
}

/**
 * 存储正在处理的媒体组的状态。
 * 键为 `media_group_id`，值为 MediaGroupState 对象。
 */
const activeMediaGroups = new Map<string, MediaGroupState>();

/**
 * 聚合属于同一个媒体组的消息。
 *
 * 如果传入的消息是媒体组的一部分，它将收集该组的所有消息并在短时间内处理它们。
 * 此函数返回一个 Promise，该 Promise 将在特定媒体组 ID 的所有聚合消息准备就绪时解析。
 * 如果对同一个 `media_group_id` 多次调用，它将返回同一个 Promise，确保该组只被处理一次。
 *
 * 如果消息不是媒体组的一部分，它将立即解析为一个包含该消息本身的 AggregatedMessage 对象。
 *
 * @param {Message} message 传入的 Telegram 消息。
 * @returns 一个 Promise，它解析为包含所有聚合消息和合并标题的 AggregatedMessage 对象。
 */
export const getAggregatedMediaGroup = async (message: Message): Promise<AggregatedMessage> => {
  const { media_group_id, message_id, caption, text } = message;

  // 如果不是媒体组，立即返回单个消息
  if (!media_group_id) {
    Log.info(`[MediaGroupManager] Message ${message_id} is not part of a media group.`);
    return { messages: [message], caption: caption || text };
  }

  // 检查是否已有针对此媒体组的活跃收集器
  if (activeMediaGroups.has(media_group_id)) {
    const entry = activeMediaGroups.get(media_group_id)!;
    Log.info(`[MediaGroupManager] Message ${message_id}: Media group ${media_group_id} already active. Adding message.`);
    entry.messages.push(message);
    // 更新标题：如果当前 entry 还没有标题，则使用当前消息的标题/文本
    if (!entry.caption && (caption || text)) {
      entry.caption = caption || text;
    }
    // 重置超时，等待更多消息
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    entry.timeoutId = setTimeout(() => {
      // 修正：这里的 entry.timeoutId 类型是正确的
      Log.info(`[MediaGroupManager] Media group ${media_group_id} collection timeout reached. Resolving with ${entry.messages.length} messages.`);
      activeMediaGroups.delete(media_group_id); // 清理活跃收集器
      entry.resolve({ messages: entry.messages, caption: entry.caption });
    }, MEDIA_GROUP_COLLECTION_TIMEOUT_MS);

    // 直接返回已经存在的 Promise
    return entry.promise; // 修正：这里可以安全访问 promise 属性
  }

  // 如果是媒体组的第一个消息，或者媒体组收集已完成但又收到新消息（不应该发生，除非超时很短）
  Log.info(`[MediaGroupManager] Message ${message_id}: Initiating collection for media group ${media_group_id}.`);

  let resolveFn!: (value: AggregatedMessage) => void;
  let rejectFn!: (reason?: unknown) => void;
  const groupPromise = new Promise<AggregatedMessage>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const entry: MediaGroupState = {
    // 修正：明确声明 entry 的类型为 MediaGroupState
    messages: [message],
    caption: caption || text,
    timeoutId: null,
    resolve: resolveFn,
    reject: rejectFn,
    promise: groupPromise, // 将 Promise 也存储起来
  };
  activeMediaGroups.set(media_group_id, entry);

  entry.timeoutId = setTimeout(() => {
    Log.info(`[MediaGroupManager] Media group ${media_group_id} collection timeout reached. Resolving with ${entry.messages.length} messages.`);
    activeMediaGroups.delete(media_group_id); // 清理活跃收集器
    entry.resolve({ messages: entry.messages, caption: entry.caption });
  }, MEDIA_GROUP_COLLECTION_TIMEOUT_MS);

  return groupPromise;
};
