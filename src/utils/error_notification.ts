// src/utils/error_notification.ts

import { config, Log, bot, AppError } from '@/services';
import { formatTime, toHtml } from '@/utils'; // 导入 helper 函数
import { escaper } from '@/utils/formatters';

/**
 * @function sendErrorNotification
 * @description 发送错误通知给管理员。
 * @param {AppError} error - 错误对象。
 * @param {string} context - 错误发生的上下文描述 (例如函数名)。
 * @returns {Promise<void>}
 */
const sendErrorNotification = async (error: AppError, context: string = ''): Promise<void> => {
  const { adminId } = config.load();
  try {
    if (adminId) {
      const currentTime = formatTime(Date.now()); // 使用辅助函数获取时间
      const errorMessage =
        `🚨 [错误告警] 🚨\n\n` +
        `发生时间: \`${currentTime}\`\n\n` +
        `错误上下文: \`${escaper.html(context)}\`\n\n` +
        `错误信息 \`${escaper.html(error.message || String(error))}\`\n\n` +
        `堆栈追踪:\n` +
        `\`\`\`javascript\n${error.stack || 'N/A'}\n\`\`\``;
      await bot.sendMessage(adminId, toHtml(errorMessage), { parseMode: 'HTML' });
      Log.info('Error notification sent to admin.', { context, adminId });
    } else {
      Log.warn('Admin ID is not configured, unable to send error notification.', {
        context,
        error: error.message,
      });
    }
  } catch (handlerError: unknown) {
    Log.error('Internal error occurred while sending error notification.', {
      err: handlerError as Error,
      originalErrorContext: context,
    });
  }
};

export { sendErrorNotification };
