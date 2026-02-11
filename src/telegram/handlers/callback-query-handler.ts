import { BotCommands } from '@configs/bot-commands.js';
import { BotMessages } from '@configs/bot-messages.js';
import { logger } from '@shared/core/logger.js';
import { ms } from '@shared/utils/helpers.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';

export const handleCallbackQuery = async (ctx: ResponseContext) => {
  const { chat, user } = ctx;
  if (!ctx.callBackQueryId) {
    logger.warn('Received callback query without id', { user: user.id, chat: chat.id });
    return;
  }

  logger.debug('Received raw callback query', { user: user.id, chat: chat.id, queryId: ctx.callBackQueryId });

  try {
    if (ctx.callBackQueryData?.startsWith('cmd_')) {
      logger.info(`User triggered button action [command]`, {
        user: user.id,
        chat: chat.id,
        payload: ctx.callBackQueryData,
      });
      await handleCallbackCommand(ctx);
    } else {
      await ctx.api.answerCallbackQuery(ctx.callBackQueryId);
    }
  } catch (err) {
    logger.error('Error in callback query handler', { err, queryId: ctx.callBackQueryId });
    await ctx.edit(BotMessages.callbackFailed, {
      deleteAfterMs: ms['3m'],
    });
  }
};

const handleCallbackCommand = async (ctx: ResponseContext) => {
  const [, command, idStr] = ctx.callBackQueryData?.split('_') ?? [];
  const authorizedUserId = Number(idStr);

  if (ctx.user.id !== authorizedUserId) {
    await ctx.api.answerCallbackQuery(ctx.callBackQueryId!, {
      text: BotMessages.unauthorized,
    });
    return;
  }

  await ctx.api.answerCallbackQuery(ctx.callBackQueryId!);
  const targetCommand = BotCommands.find((cmd) => cmd.command === command);
  if (!targetCommand) return;
  await targetCommand.action({ ctx });
};
