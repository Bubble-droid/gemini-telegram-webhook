import { BotCommands } from '@configs/bot-commands';
import { logger } from '@shared/core/logger';
import type { ResponseContext } from '@telegram/bot/response-context';
import type { BotCommand } from 'grammy/types';

export const handleBotCommand = async (ctx: ResponseContext) => {
  const { chat, user } = ctx;
  logger.debug('Received command message...', { chatId: chat.id, userId: user.id });
  const command = ctx.botCommandText?.slice(1).split('@')[0]?.trim();
  if (!command?.length) return;

  const botCommands = BotCommands.map((cmd): BotCommand => {
    const { action, ...rest } = cmd;
    return rest;
  });

  await ctx.api.setBotCommands(botCommands, chat.id, user.id);

  const targetCommand = BotCommands.find((cmd) => cmd.command === command);

  if (!targetCommand) return;

  logger.info(`执行命令: /${command}`, { chatId: chat.id, userId: user.id });

  await targetCommand.action({ ctx });
};
