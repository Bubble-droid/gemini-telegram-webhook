// src/configs/bot_commands.ts

import { BotMessages, Keyboards } from '@/configs';
import { chatContext, config } from '@/services';
import type { MaybePromise } from '@/types';
import { faqMatcher, MsgPTTL, promptStore } from '@/utils';
import { toHtml } from '@/utils/markdown';
import type { ResponseContext } from '@/utils/ResponseContext';
import type { BotCommand } from 'grammy/types';

interface CommandActionArgs {
  ctx: ResponseContext;
  cleanText?: string;
}

interface BotCommandAction extends BotCommand {
  action: (args: CommandActionArgs) => MaybePromise<void>;
}

const canPerformAction = (ctx: ResponseContext): boolean => {
  if (ctx.user.id === config.adminId) return true;
  void ctx.reply(BotMessages.unauthorized);
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
        deleteAfterMs: MsgPTTL['3m'],
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
        deleteAfterMs: MsgPTTL['5m'],
      });
    },
  },
  {
    command: 'clear',
    description: '清理对话历史',
    action: async ({ ctx }) => {
      await ctx.reply(BotMessages.clearing);

      chatContext.clear(ctx.chat.id, ctx.user.id);

      await ctx.edit(BotMessages.cleared, {
        reply_markup: Keyboards.getBackToStart(ctx.user.id),
        deleteAfterMs: MsgPTTL['3m'],
      });
    },
  },

  // Admin Commands
  {
    command: 'reload_prompts',
    description: '重载所有系统指令',
    action: async ({ ctx }) => {
      if (!canPerformAction(ctx)) return;
      promptStore.reload();
      await ctx.reply('All prompts reloaded', {
        deleteAfterMs: MsgPTTL['3m'],
      });
    },
  },
  {
    command: 'reload_faqs',
    description: '重载所有 FAQ 数据',
    action: async ({ ctx }) => {
      if (!canPerformAction(ctx)) return;
      faqMatcher.reload();
      await ctx.reply('All FAQ reloaded', {
        deleteAfterMs: MsgPTTL['3m'],
      });
    },
  },
] as const satisfies BotCommandAction[];
