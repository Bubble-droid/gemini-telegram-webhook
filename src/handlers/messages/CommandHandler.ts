// src/handlers/message/command.ts

import { BotCommands } from '@/configs';
import { logger } from '@/services';
import { bot } from '@/services/apis';
import type { ResponseContext } from '@/utils';
import type { Message } from 'grammy/types';

export const processCommand = async (msg: Message, ctx: ResponseContext): Promise<void> => {
  logger.debug('Received command message...', { chatId: ctx.chat.id, userId: ctx.user.id });

  const command = ctx.getEntityText(msg, ['bot_command'])?.slice(1).split('@')[0]?.trim();

  if (!command) return;

  const botCommands = BotCommands.map((cmd) => {
    const { action, ...rest } = cmd;
    return rest;
  });

  void bot.setBotCommands(botCommands, ctx.chat.id, ctx.user.id);

  const targetCommand = BotCommands.find((cmd) => cmd.command === command);

  if (!targetCommand) return;

  logger.info(`执行命令: /${command}`, { chatId: ctx.chat.id, userId: ctx.user.id });

  await targetCommand.action({ ctx });
};
