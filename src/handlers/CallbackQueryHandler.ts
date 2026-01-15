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
      text: '🚫 你没有权限执行此操作',
    });
    return;
  }

  await bot.answerCallbackQuery(ctx.callBackQueryId ?? '');

  // 查找并执行命令
  const targetCommand = BotCommands.find((cmd) => cmd.command === commandName);

  if (!targetCommand) return;

  await targetCommand.action({ ctx });
};

export const processCallbackQuery = async (ctx: ResponseContext): Promise<void> => {
  logger.debug('Handling callback query');

  // 3. 路由分发
  try {
    if (ctx.callBackQueryData?.startsWith('cmd_')) {
      await handleCallbackCommand(ctx);
    } else {
      await bot.answerCallbackQuery(ctx.callBackQueryId ?? '');
    }
  } catch (err) {
    logger.error('Error in callback query handler dispatch', { err, queryId: ctx.callBackQueryId });

    void ctx.edit(BotMessages.callbackFailed, {
      deleteAfterMs: MsgPTTL['3m'],
    });
  }
};
