import { logger } from '@/services';
import { bot } from '@/services/apis';
import { CONFIG } from '@/services/ConfigLoader';
import { formatTime, shortenString } from '@/utils';
import { AppError } from '@/utils/errors';
import { Escaper } from './markdown';

/**
 * @description 发送错误通知给管理员。
 * @param error - 错误对象 (支持任意类型，不局限于 AppError)。
 * @param context - 错误发生的上下文描述 (例如函数名)。
 */
export const sendErrorNotification = (error: unknown, context = 'N/A'): void => {
  const { TELEGRAM_BOT_OWNER_ID: ownerId } = CONFIG;

  // 1. 如果未配置管理员 ID，记录警告并直接返回
  if (!ownerId) {
    logger.warn('Admin ID is not configured, skipping error notification.', {
      context,
    });
    return;
  }

  try {
    // 2. 标准化错误对象
    const errObj = error instanceof AppError ? error : new AppError(String(error));

    // 3. 获取并截断堆栈信息 (保留前 1000 和后 1000 字符，防止消息过长发送失败)
    // 堆栈对于定位问题最重要，所以我们在截断前先获取它
    const rawStack = errObj.stack ?? 'No stack trace available';
    // 考虑到还有其他文本，我们把 stack 限制在 3000 字符左右比较安全
    const truncatedStack = shortenString(rawStack); // 使用您在 helpers.ts 中定义的函数

    // 4. 构建 HTML 消息 (直接构建，不经过 Markdown 解析器，避免歧义)
    // 注意：必须对所有动态内容进行 HTML 转义
    const currentTime = formatTime(Date.now());
    const safeContext = Escaper.html(context);
    const safeMessage = Escaper.html(errObj.message);
    const safeStack = Escaper.html(truncatedStack);

    const htmlMessage =
      `🚨 <b>[错误告警]</b> 🚨\n\n` +
      `🕒 <b>时间:</b> ${currentTime}\n` +
      `📂 <b>上下文:</b> <code>${safeContext}</code>\n\n` +
      `❌ <b>错误信息:</b>\n<pre>${safeMessage}</pre>\n\n` +
      `🛠 <b>堆栈追踪:</b>\n<pre><code class="language-javascript">${safeStack}</code></pre>`;

    // 5. 发送消息
    void bot.sendMessage(ownerId, htmlMessage, {
      parse_mode: 'HTML',
    });

    logger.info('Error notification sent to admin.', { context });
  } catch (err) {
    // 6. 兜底处理：如果发送通知本身失败（例如网络断了），仅记录日志，千万别再抛出错误导致无限循环
    logger.warn('Failed to send error notification.', {
      err,
      originalErrorContext: context,
    });
  }
};
