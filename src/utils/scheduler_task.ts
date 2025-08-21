// src/utils/scheduler_task.ts

import { Log, BotConfig } from '@/services';
import type { DeleteMessageParams, SendMessageParams, TelegramApiMethod } from '@/types';
import { secureHex } from '@/utils';

/**
 * 调度任意任务
 * @param {TelegramApiMethod} action - 任务类型，如 'deleteMessage'
 * @param {T} params - 任务参数对象
 * @param {number} delayMs - 延迟毫秒数
 */
const scheduleTask = async <T>(action: TelegramApiMethod, params: T, delayMs: number): Promise<void> => {
  const { schedulerApiUrl, schedulerApiToken } = BotConfig.load();
  const name = `${action}-${secureHex(8)}`;
  const encoded = Buffer.from(schedulerApiToken, 'utf-8').toString('base64');
  try {
    await fetch(schedulerApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({ action, params, delayMs }),
    });
    Log.info(`Registering scheduled task with name: ${name}, execute after ${delayMs / 1_000} s`, {
      params,
    });
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
const scheduleDeletion = (params: DeleteMessageParams, delayMs: number): void => {
  void scheduleTask<DeleteMessageParams>('deleteMessage', params, delayMs);
};

const scheduleSend = (params: SendMessageParams, delayMs: number): void => {
  void scheduleTask<SendMessageParams>('sendMessage', params, delayMs);
};

export { scheduleDeletion, scheduleSend };
