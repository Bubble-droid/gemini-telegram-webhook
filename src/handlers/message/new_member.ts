// src/handlers/message/new_member.ts

import { Log, config, bot } from '@/services';
import type { Message, ReplyMarkup, User } from '@/types';
import { kv, scheduleDeletion, sleep } from '@/utils';
import { formatters } from '@/utils/formatting';

// 定义轮询参数，这些可以根据实际需求调整
const POLLING_TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟的超时时间
const POLLING_INTERVAL_MS = 5 * 1000; // 每 3 秒轮询一次

/**
 * @function pollChatMemberStatus
 * @description 轮询检查指定成员在聊天中的状态，直到其通过验证或超时。
 *              返回包含用户ID和验证结果的对象。
 * @param {number | string} chatId - 聊天的 ID。
 * @param {User} user - 新加入的 User 对象。
 * @param {number} timeoutMs - 轮询超时时间（毫秒）。
 * @param {number} intervalMs - 轮询间隔时间（毫秒）。
 * @returns {Promise<{ userId: number; isVerified: boolean }>} 包含用户ID和是否通过验证的布尔值。
 */
const pollChatMemberStatus = async (
  chatId: number | string,
  user: User,
  timeoutMs: number,
  intervalMs: number,
): Promise<{ userId: number; isVerified: boolean }> => {
  const { id: userId, first_name, last_name = '' } = user;
  const userName = `${first_name} ${last_name}`.trim();

  const startTime = Date.now();
  Log.info(`开始轮询用户 ${userName}(${userId}) 在聊天 ${chatId} 中的状态...`);

  while (Date.now() - startTime < timeoutMs) {
    const result = await bot.getChatMember(chatId, userId);

    if (!result.ok) {
      Log.error(`获取用户 ${userName}(${userId}) 聊天成员信息失败: ${result.error || '未知错误'}`, {
        chatId,
        userId,
      });

      // 等待后重试，避免单次错误导致轮询中断
      await sleep(intervalMs);
      continue;
    }

    const chatMember = result.data; // 获取实际的 ChatMember 对象
    // Log.info(`用户 ${userName}(${userId}) 当前状态: ${chatMember.status}`, { chatId, userId });

    switch (chatMember.status) {
      case 'member':
        Log.info(`用户 ${userName}(${userId}) 已通过验证 (状态: member)。`, { chatId, userId });
        return { userId, isVerified: true }; // 成员已通过验证
      case 'restricted':
        // TypeScript 会自动推断 chatMember 为 ChatMemberRestricted 类型
        if (!chatMember.can_send_messages) {
          // 成员仍在限制中且无法发送消息，继续等待
          // Log.info(`用户 ${userName}(${userId}) 仍在限制中且无法发送消息，等待下次轮询...`, { chatId, userId });
          await sleep(intervalMs);
          continue;
        } else {
          // 状态为 restricted 但 can_send_messages 为 true，说明限制已解除，等同于 member
          Log.info(`用户 ${userName}(${userId}) 状态为 restricted 但已解除消息发送限制。`, { chatId, userId });
          return { userId, isVerified: true };
        }
      case 'creator':
      case 'administrator':
        // 如果新成员直接是管理员或群主，也视为通过验证
        Log.info(`用户 ${userName}(${userId}) 是 ${chatMember.status}，视为已通过验证。`, { chatId, userId });
        return { userId, isVerified: true };
      case 'kicked': // 对应 ChatMemberBanned
      case 'left':
        Log.info(`用户 ${userName}(${userId}) 状态为 ${chatMember.status}，验证失败或已离开/被踢出。`, { chatId, userId });
        return { userId, isVerified: false };
      default:
        // 处理未预期的状态，或者等待其他状态
        Log.warn(`用户 ${userName}(${userId}) 处于未知或非验证状态，继续等待...`, { chatId, userId });
        await sleep(intervalMs);
        continue;
    }
  }

  Log.warn(`轮询用户 ${userName}(${userId}) 状态超时 (${timeoutMs / 1000}秒)，未能通过验证。`, { chatId, userId });
  return { userId, isVerified: false }; // 轮询超时
};

/**
 * @function handleNewMember
 * @description 处理新成员加入聊天的消息。
 * @param {Message} message - Telegram Message 对象。
 * @returns {Promise<void>}
 */
const handleNewMember = async (message: Message): Promise<void> => {
  const { botName, durableResourceId, newMemberWelcomeTextKeyName } = config.load();
  const { message_id, chat, new_chat_members } = message;
  if (!new_chat_members || new_chat_members.length === 0) return;
  const newMemberIds = new_chat_members?.map((member) => member.id) as number[];
  Log.info('Handling new chat member message', { chatId: chat.id, newMemberIds });
  const pollingTasks = new_chat_members.map((member) => pollChatMemberStatus(chat.id, member, POLLING_TIMEOUT_MS, POLLING_INTERVAL_MS));

  // 使用 Promise.all 并行等待所有轮询任务完成
  const results = await Promise.all(pollingTasks);

  for (const { userId, isVerified } of results) {
    const newMember = new_chat_members.find((m) => m.id === userId) as User; // 找到对应的 User 对象
    if (!newMember) {
      Log.error(`未找到ID为 ${userId} 的新成员，这不应该发生。`, { chatId: chat.id, userId });
      continue;
    }

    if (isVerified) {
      // 成员已通过验证，发送欢迎消息
      const newMemberFullName = `${newMember.first_name} ${newMember.last_name || ''}`.trim();
      const newMemberMention = `[${newMemberFullName}](tg://user?id=${newMember.id})`;
      const newMemberWelcome = await kv.read<string>(durableResourceId, newMemberWelcomeTextKeyName, 'text');
      if (!newMemberWelcome.success) return;
      const replaceText = newMemberWelcome.data
        .replace('NEW_MEMBER_MENTION', newMemberMention)
        .replace('CHAT_TITLE', chat.title as string)
        .replace('BOT_NAME', botName)
        .trim();

      Log.info(`向已验证的新成员 ${newMemberFullName}(${newMember.id}) 发送欢迎消息。`, { chatId: chat.id, newMemberId: newMember.id });

      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            { text: '📓 使用指南', url: 'https://gui-for-cores.github.io/zh/guide' },
            {
              text: '❓ 常见问题',
              callback_data: `cmd_faq_${newMember.id}`,
            },
          ],
          [
            { text: '📢 通知频道', url: 'https://t.me/GUI_for_Cores_Channel' },
            { text: '📄 项目地址', url: 'https://github.com/GUI-for-Cores' },
          ],
        ],
      };
      const welcomeResult = await bot.sendMessage(chat.id, formatters.Html(replaceText), {
        replyToMessageId: message_id,
        parseMode: 'HTML',
        replyMarkup,
      });

      if (welcomeResult.ok) {
        void scheduleDeletion({ chat_id: chat.id, message_id: welcomeResult.messageId }, 3 * 60_000);
      }
    } else {
      Log.warn(`新成员 ${newMember.first_name}(${newMember.id}) 未通过验证或超时，不发送欢迎消息。`, { chatId: chat.id, newMemberId: newMember.id });
    }
  }
};

export { handleNewMember };
