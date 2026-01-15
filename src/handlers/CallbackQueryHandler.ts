// src/handlers/callback_query.ts

import { BotCommands, BotMessages } from '@/configs';
import { logger } from '@/services';
import { bot } from '@/services/apis';
import { MsgPTTL } from '@/utils';
import type { ResponseContext } from '@/utils/ResponseContext';

const handleCallbackCommand = async (ctx: ResponseContext): Promise<void> => {
  const [, commandName, allowUserIdStr] = ctx.callBackQueryData?.split('_') ?? [];
  const allowUserId = Number(allowUserIdStr);

  // 权限校验
  if (ctx.user.id !== allowUserId) {
    await bot.answerCallbackQuery(ctx.callBackQueryId ?? '', {
      text: BotMessages.unauthorized,
    });
    return;
  }

  await bot.answerCallbackQuery(ctx.callBackQueryId ?? '');

  // 查找并执行命令
  const targetCommand = BotCommands.find((cmd) => cmd.command === commandName);

  if (!targetCommand) return;

  await targetCommand.action({ ctx });
};

export const handleCallbackQuery = async (ctx: ResponseContext): Promise<void> => {
  logger.debug('Received raw callback query', { user: ctx.user.id, chat: ctx.chat.id, queryId: ctx.callBackQueryId });

  // 3. 路由分发
  try {
    if (ctx.callBackQueryData?.startsWith('cmd_')) {
      logger.info(`User triggered button action [command]`, {
        user: ctx.user.id,
        chat: ctx.chat.id,
        payload: ctx.callBackQueryData,
      });
      await handleCallbackCommand(ctx);
    } else {
      await bot.answerCallbackQuery(ctx.callBackQueryId ?? '');
    }
  } catch (err) {
    logger.error('Error in callback query handler', { err, queryId: ctx.callBackQueryId });

    void ctx.edit(BotMessages.callbackFailed, {
      deleteAfterMs: MsgPTTL['3m'],
    });
  }
};
