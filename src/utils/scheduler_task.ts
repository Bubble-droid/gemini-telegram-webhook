// src/utils/scheduler_task.ts

import { Log, config } from '@/services';
import type * as Bot from '@/types/telegram';
import type { SchedulerApiResponseBody } from '@/types';

/**
 * 调度任意任务
 * @param {Bot.ApiMethod} action - 任务类型，如 'deleteMessage'
 * @param {T} params - 任务参数对象
 * @param {number} delayMs - 延迟毫秒数
 */
const scheduleTask = async <T>(action: Bot.ApiMethod, params: T, delayMs: number): Promise<void> => {
  const { schedulerApiUrl, schedulerApiToken } = config.load();
  const name = `${action}-${JSON.stringify(params)}`;
  const encoded = Buffer.from(schedulerApiToken, 'utf-8').toString('base64');
  try {
    const res = await fetch(schedulerApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({ action, params, delayMs }),
    });
    const result = (await res.json()) as SchedulerApiResponseBody;
    if (result.status === 'scheduled') {
      Log.info(`Registering scheduled task with name: ${name}, execute after ${delayMs / 1_000} s`, {
        params,
      });
    }
  } catch (error: unknown) {
    Log.error(`Failed to register scheduled task with name: ${name}`, {
      params,
      err: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * 专用：延迟删除 Telegram 消息
 */
export const scheduleDeletion = (chatId: number | string, messageId: number, delayMs: number): Promise<void> => {
  return scheduleTask<Bot.DeleteMessageParams>('deleteMessage', { chat_id: chatId, message_id: messageId }, delayMs);
};

export const scheduleMultipleDeletion = (chatId: number | string, messageIds: number[], delayMs: number): Promise<void> => {
  return scheduleTask<Bot.DeleteMessagesParams>('deleteMessages', { chat_id: chatId, message_ids: messageIds }, delayMs);
};
