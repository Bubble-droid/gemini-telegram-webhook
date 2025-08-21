// src/handlers/message/new_member.ts

import { Log, BotConfig, TelegramBot } from '@/services';
import type { Message, User } from '@/types/telegram';
import { scheduleDeletion } from '@/utils';

/**
 * @function handleNewMember
 * @description 处理新成员加入聊天的消息。
 * @param {Message} message - Telegram Message 对象。
 * @returns {Promise<void>}
 */
const handleNewMember = async (message: Message): Promise<void> => {
  const { botName } = BotConfig.load();
  const { chat, new_chat_members } = message;
  const newMemberIds = new_chat_members?.map((member) => member.id) as number[];
  Log.info('Handling new chat member message', { chatId: chat.id, newMemberIds: newMemberIds.join(', ') });
  for (const newMember of new_chat_members as User[]) {
    const { id: newMemberId, first_name, last_name = '' } = newMember;
    const newMemberFullName = `${first_name} ${last_name}`;
    const newMemberMention = `[${newMemberFullName}](tg://user?id=${newMemberId})`;
    const welcomeText: string = `
    欢迎 ${newMemberMention} 加入 ${chat.title} 讨论组！
    * 提问前须知：
    * 有问题先查阅频道信息，以及群组置顶消息。
    * GUI.for.Cores 分为两个客户端（GUI.for.Clash 和 GUI.for.SingBox）
    * 不要只更新 GUI.for.Cores 客户端，而不更新内核，反之亦然。
    * 遇到任何问题请先将 GUI.for.Cores 主程序更新到最新版，以及安装\`滚动发行\`插件并运行再次更新。
    * 如遇滚动更新失败，请尝试删除程序目录下的 \`data/rolling-release\`，然后重新运行滚动更新。
    * 请不要抵触\`滚动更新\`，这只是一种更加高效、便利的更新方式，通过滚动更新才能获取到 GUI.for.Cores 客户端的最新稳定版体验。
    * 请确保你当前使用的 GUI.for.Cores 版本，与所选内核版本兼容。（默认情况下 GUI.for.Cores 客户端与最新版内核保持同步）
    * 如遇到更新后仍无法解决的问题，提问时请直接发问题截图，详细描述你遇到的问题，说明你使用的是哪个客户端和版本，以及使用的内核版本，还有进行什么操作时遇到的问题。
    * 有关 GUI.for.Cores 和内核的问题，都可以 @ 智能助手（\`@${botName}\`）提问，以获得及时解答。
    `;
    const { messageId: welcomeMessageId } = await TelegramBot.sendMessage(chat.id, welcomeText);
    if (welcomeMessageId) {
      void scheduleDeletion({ chat_id: chat.id, message_id: welcomeMessageId }, 10 * 60_000);
    }
  }
};

export { handleNewMember };
