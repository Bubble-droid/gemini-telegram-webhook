import { chatHistory } from '@data/chat-history.js';
import { faqMatcher } from '@data/faq-matcher.js';
import { promptStore } from '@data/prompt-store.js';
import type { BotCommand, InlineKeyboardButton } from '@grammyjs/types';
import { CONFIG } from '@shared/core/config.js';
import { markdownToMarkdownV2 } from '@shared/markdown/telegram-converter.js';
import type { MaybePromise } from '@shared/types/common.js';
import { ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import { Messages } from './messages.js';

interface CommandActionArgs {
  ctx: ResponseContext;
}

interface Command extends BotCommand {
  action: (args: CommandActionArgs) => MaybePromise;
  permissions?: boolean;
}

export type CommandType = (typeof COMMANDS)[number]['command'];

export const canPerformAction = async (ctx: ResponseContext) => {
  if (ctx.user.id === CONFIG.TELEGRAM_BOT_OWNER_ID) return true;
  await ctx.reply(Messages.unauthorized, { deleteAfterMs: ms['3m'] });
  return false;
};

export const COMMANDS = [
  {
    command: 'test',
    description: '测试',
    permissions: true,
    action: async ({ ctx }) => {
      await ctx.reaction('👍');
      const InlineKeyboardButtons: InlineKeyboardButton[][] = [
        COMMANDS.map((_c, i): InlineKeyboardButton => {
          return {
            text: String(i + 1),
            callback_data: `select_${i}`,
          };
        }),
      ];
      const candidate = COMMANDS.map((c, i) => `${i + 1}. ${c.command} - ${c.description}`).join('\n');
      const text = `<select>\n${candidate}\n</select>`;
      await ctx.reply(markdownToMarkdownV2(text), {
        reply_markup: { inline_keyboard: InlineKeyboardButtons },
        parse_mode: 'MarkdownV2',
      });
    },
  },
  {
    command: 'start',
    description: '开始使用',
    permissions: false,
    action: async ({ ctx }) => {
      await ctx.reply(markdownToMarkdownV2(Messages.getStartText()), {
        parse_mode: 'MarkdownV2',
        deleteAfterMs: ms['3m'],
      });
    },
  },
  {
    command: 'faq',
    description: '常见问题',
    permissions: false,
    action: async ({ ctx }) => {
      await ctx.reply(markdownToMarkdownV2(Messages.faqSimplified), {
        parse_mode: 'MarkdownV2',
        deleteAfterMs: ms['5m'],
      });
    },
  },
  {
    command: 'clear',
    description: '清理对话历史',
    permissions: false,
    action: async ({ ctx }) => {
      const { chat, user } = ctx;
      await ctx.reply(Messages.clearing);
      chatHistory.clear(chat.id, user.id);
      await ctx.updateMessage(Messages.cleared, {
        deleteAfterMs: ms['3m'],
      });
    },
  },

  // Admin Commands
  {
    command: 'rm',
    description: '删除消息',
    permissions: true,
    action: async ({ ctx }) => {
      for (const id of [ctx.replyToMessage?.message_id, ctx.message?.message_id]) {
        if (id) {
          await ctx.delete(id);
        }
      }
    },
  },
  {
    command: 'reload_prompts',
    description: '重载所有系统指令',
    permissions: true,
    action: async ({ ctx }) => {
      await promptStore.reload();
      await ctx.reply('All prompts reloaded', {
        deleteAfterMs: ms['3m'],
      });
    },
  },
  {
    command: 'reload_faqs',
    description: '重载所有 FAQ 数据',
    permissions: true,
    action: async ({ ctx }) => {
      await faqMatcher.reload();
      await ctx.reply('All FAQ reloaded', {
        deleteAfterMs: ms['3m'],
      });
    },
  },
] as const satisfies Command[];
