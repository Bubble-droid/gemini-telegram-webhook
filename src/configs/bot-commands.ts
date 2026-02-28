import { chatHistory } from '@data/chat-history.js';
import { faqMatcher } from '@data/faq-matcher.js';
import { promptStore } from '@data/prompt-store.js';
import { CONFIG } from '@shared/core/config.js';
import { toMarkdownV2 } from '@shared/markdown/telegram-converter.js';
import type { MaybePromise } from '@shared/types/common.js';
import { ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { BotCommand } from '@grammyjs/types';
import { BotMessages, Keyboards } from './bot-messages.js';

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
      await ctx.reply(toMarkdownV2(BotMessages.getStartText()), {
        parse_mode: 'MarkdownV2',
        reply_markup: Keyboards.getStart(ctx.user.id),
        deleteAfterMs: ms['3m'],
      });
    },
  },
  {
    command: 'faq',
    description: '常见问题',
    action: async ({ ctx }) => {
      await ctx.reply(toMarkdownV2(BotMessages.faqSimplified), {
        parse_mode: 'MarkdownV2',
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
