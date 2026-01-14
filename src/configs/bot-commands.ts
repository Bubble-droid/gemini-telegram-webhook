// src/configs/bot_commands.ts

import { BotMessages, Keyboards } from '@/configs';
import { chatContext } from '@/services';
import type { MaybePromise } from '@/types';
import { MsgPTTL } from '@/utils';
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
] as const satisfies BotCommandAction[];
