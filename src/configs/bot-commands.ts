import { chatHistory } from '@data/chat-history';
import { faqMatcher } from '@data/faq-matcher';
import { promptStore } from '@data/prompt-store';
import { CONFIG } from '@shared/core/config';
import type { MaybePromise } from '@shared/types/common';
import { ms } from '@shared/utils/helpers';
import type { ResponseContext } from '@telegram/bot/response-context';
import { toHtml } from '@telegram/markdown';
import type { BotCommand } from 'grammy/types';
import { BotMessages, Keyboards } from './bot-messages';

interface CommandActionArgs {
  ctx: ResponseContext;
}

interface BotCommandAction extends BotCommand {
  action: (args: CommandActionArgs) => MaybePromise<void>;
}

const canPerformAction = (ctx: ResponseContext): boolean => {
  if (ctx.user.id === CONFIG.TELEGRAM_BOT_OWNER_ID) return true;
  void ctx.reply(BotMessages.unauthorized, { deleteAfterMs: ms['3m'] });
  return false;
};

export const BotCommands = [
  {
    command: 'start',
    description: '开始使用',
    action: async ({ ctx }) => {
      await ctx.reply(toHtml(BotMessages.getStartText()), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.getStart(ctx.user.id),
        deleteAfterMs: ms['3m'],
      });
    },
  },
  {
    command: 'faq',
    description: '常见问题',
    action: async ({ ctx }) => {
      await ctx.reply(toHtml(BotMessages.faqSimplified), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.getBackToStart(ctx.user.id),
        deleteAfterMs: ms['5m'],
      });
    },
  },
  {
    command: 'clear',
    description: '清理对话历史',
    action: async ({ ctx }) => {
      const { chat, user } = ctx;
      await ctx.reply(BotMessages.clearing);
      chatHistory.clear(chat.id, user.id);
      await ctx.edit(BotMessages.cleared, {
        reply_markup: Keyboards.getBackToStart(user.id),
        deleteAfterMs: ms['3m'],
      });
    },
  },

  // Admin Commands
  {
    command: 'reload_prompts',
    description: '重载所有系统指令',
    action: async ({ ctx }) => {
      if (!canPerformAction(ctx)) return;
      await promptStore.reload();
      await ctx.reply('All prompts reloaded', {
        deleteAfterMs: ms['3m'],
      });
    },
  },
  {
    command: 'reload_faqs',
    description: '重载所有 FAQ 数据',
    action: async ({ ctx }) => {
      if (!canPerformAction(ctx)) return;
      await faqMatcher.reload();
      await ctx.reply('All FAQ reloaded', {
        deleteAfterMs: ms['3m'],
      });
    },
  },
] as const satisfies BotCommandAction[];
