/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import type { CallbackQuery, Update } from '@grammyjs/types';
import type { MaybePromise } from '@shared/types/common.js';
import { ResponseContext } from '@telegram/bot/response-context.js';
import type { MentionHandler } from '@telegram/handlers/messages/mention-handler.js';

interface CallbackActionArgs {
  ctx: ResponseContext;
  mentionHandler: MentionHandler;
}

interface Callback extends Pick<CallbackQuery, 'data'> {
  action: (args: CallbackActionArgs) => MaybePromise;
}

export type CallbackButtonType = (typeof CALLBACKS)[number]['data'];

export const CALLBACKS = [
  {
    data: 'answer',
    action: async (args) => {
      const { ctx, mentionHandler } = args;
      const [, targetUser, index] = ctx.callbackQueryData.split('_');
      if (ctx.user.id !== Number(targetUser) || index === undefined) return;
      const matched = /<select>(?<content>[\s\S]*?)<\/select>/gi.exec(ctx.callbackQueryMessage?.text!);
      if (!matched) return;
      const selectedAnswer = matched.groups!['content']!.trim().split('\n')[Number(index)]?.replace(/\d+\./, '').trim();
      if (!selectedAnswer) return;
      const answered = `Question: ${ctx.callbackQueryMessage?.text?.replace(/<select>[\s\S]*?<\/select>/gi, '').trim()}\n\nAnswer: ${selectedAnswer}`;
      await ctx.updateCallbackMessage(answered);
      const replyToMessage = ctx.callbackQueryMessage?.reply_to_message as unknown as Update['message'];
      const update: Update = {
        update_id: ctx.update.update_id + 1,
        message: {
          message_id: replyToMessage?.message_id!,
          date: replyToMessage?.date!,
          chat: {
            ...replyToMessage?.chat!,
          },
          from: {
            ...replyToMessage?.from!,
          },
          text: selectedAnswer,
        },
      };
      const responseContext = new ResponseContext(update, ctx.api);
      await mentionHandler.handle(responseContext, [update.message!]);
    },
  },
] as const satisfies Callback[];
