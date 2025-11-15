// src/configs/bot_commands.ts

import { config, bot, contexts, Log, ToolExecutors, TelegramError, KvNamespaceError } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, kv, toHtml } from '@/utils';
import type { BotCommandAction, ReplyMarkup, ToolExecArgs } from '@/types';

const BaseCommands: BotCommandAction[] = [
  {
    name: 'start',
    description: '开始使用',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing start command.');
      const { isCallback = false } = options;
      const { modelName, durableResourceId, startReplyTextKeyName, botName } = config.load();
      const startReply = await kv.read<string>(durableResourceId, startReplyTextKeyName, 'text');
      if (!startReply.success) {
        throw new KvNamespaceError(`Start 命令回复内容读取失败，${startReply.error}`, 'START_REPLY_NOT_FOUND');
      }
      const replaceText = startReply.data
        .replace('${MODEL_NAME}', modelName)
        .replace(/\${BOT_NAME}/g, botName)
        .trim();
      const totalReactionsKeyName = `total_reactions_${chatId}`;
      const totalReactions = await kv.read<{ like: number; dislike: number }>(durableResourceId, totalReactionsKeyName, 'json');
      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: `群组 👍 ${totalReactions.success ? totalReactions.data.like : 0}`,
              callback_data: 'PLACEHOLDER',
            },
            {
              text: `群组 👎 ${totalReactions.success ? totalReactions.data.dislike : 0}`,
              callback_data: 'PLACEHOLDER',
            },
          ],
          [
            {
              text: '🗑 清理对话',
              callback_data: `cmd_clear_${userId}`,
            },
            {
              text: '❓ 常见问题',
              callback_data: `cmd_faq_${userId}`,
            },
          ],
        ],
      };

      let startResult;
      if (isCallback) {
        startResult = await bot.editMessageText(chatId, messageId, toHtml(replaceText), { parseMode: 'HTML', replyMarkup });
      } else {
        startResult = await bot.sendMessage(chatId, toHtml(replaceText), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
          replyMarkup,
        });
      }
      if (startResult.ok) {
        scheduleDeletion(chatId, startResult.messageId, 3 * 60_000);
      }
    },
  },
  {
    name: 'faq',
    description: '常见问题',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing faq command.');
      const { isCallback = false } = options;
      const { durableResourceId } = config.load();
      const faqReply = await kv.read<string>(durableResourceId, 'cmd_faq_reply', 'text');
      if (!faqReply.success) {
        throw new KvNamespaceError(`FAQ 命令回复内容读取失败，${faqReply.error}`, 'FAQ_REPLY_NOT_FOUND');
      }
      const backReplyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '⬅️ Go Back',
              callback_data: `cmd_start_${userId}`,
            },
          ],
        ],
      };
      let faqResult;
      if (isCallback) {
        faqResult = await bot.editMessageText(chatId, messageId, toHtml(faqReply.data.trim()), {
          parseMode: 'HTML',
          replyMarkup: backReplyMarkup,
        });
      } else {
        faqResult = await bot.sendMessage(chatId, toHtml(faqReply.data.trim()), { replyToMessageId: messageId, parseMode: 'HTML' });
      }
      if (faqResult.ok) {
        scheduleDeletion(chatId, faqResult.messageId, 5 * 60_000);
      }
    },
  },
  {
    name: 'clear',
    description: '清理对话历史',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing clear command.');
      const { isCallback = false } = options;
      const clearingText = '🗑 Clearing...';
      const backReplyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '⬅️ Go Back',
              callback_data: `cmd_start_${userId}`,
            },
          ],
        ],
      };
      let clearingResult;
      if (isCallback) {
        clearingResult = await bot.editMessageText(chatId, messageId, clearingText);
      } else {
        clearingResult = await bot.sendMessage(chatId, clearingText, { replyToMessageId: messageId });
      }
      await contexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3_000);
        const clearedText: string = '✅ 已成功清除你和我的历史对话';
        const clearedResult = await bot.editMessageText(chatId, clearingResult.messageId, clearedText, {
          replyMarkup: isCallback ? backReplyMarkup : undefined,
        });
        if (clearedResult.ok) {
          scheduleDeletion(chatId, clearedResult.messageId, 3 * 60_000);
        }
      }
    },
  },
  {
    name: 'tools',
    description: '模型的函数工具',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing tools command.');
      const { isCallback = false } = options;
      const toolFunctions = geminiTools[0]?.functionDeclarations || [];
      const toolList =
        toolFunctions
          ?.map(
            (tool) =>
              `* **${tool.name}**\n    ${[...(tool.description as string)].length > 40 ? `${tool.description?.slice(0, 40)}...` : tool.description}`,
          )
          .join('\n')
          .trim() || '';

      const toolsText = `🛠 我可以使用以下工具：\n\n${toolList}`;

      let toolsResult;
      if (isCallback) {
        const backReplyMarkup: ReplyMarkup = {
          inline_keyboard: [
            [
              {
                text: '⬅️ Go Back',
                callback_data: `cmd_start_${userId}`,
              },
            ],
          ],
        };
        toolsResult = await bot.editMessageText(chatId, messageId, toHtml(toolsText), {
          parseMode: 'HTML',
          replyMarkup: backReplyMarkup,
        });
      } else {
        toolsResult = await bot.sendMessage(chatId, toHtml(toolsText), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
        });
      }
      if (toolsResult.ok) {
        scheduleDeletion(chatId, toolsResult.messageId, 5 * 60_000);
      }
    },
  },
];

const GenerateCommands: BotCommandAction[] = [
  {
    name: 'gen_img',
    description: '生成图片',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing gen_img command.');
      const { cleanText } = options;
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:img [图片生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion(chatId, notText.messageId, 3 * 60 * 1000);
        }
        return;
      }
      let renderMessageId: number | undefined = undefined;
      const renderResult = await bot.sendMessage(chatId, `🎨 Rendering...`, { replyToMessageId: messageId });
      if (renderResult.ok) {
        renderMessageId = renderResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        prompt: cleanText,
      };
      const response = await ToolExecutors.generateImage(args as ToolExecArgs);
      if (renderMessageId) {
        await bot.deleteMessage(chatId, renderMessageId);
        renderMessageId = undefined;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    },
  },
  {
    name: 'gen_tts',
    description: '生成语音',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing gen_tts command.');
      const { cleanText } = options;
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:tts [语音生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion(chatId, notText.messageId, 3 * 60 * 1000);
        }
        return;
      }
      let synthMessageId: number | undefined = undefined;
      const synthResult = await bot.sendMessage(chatId, `🎙️ Synthesizing...`, { replyToMessageId: messageId });
      if (synthResult.ok) {
        synthMessageId = synthResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        prompt: cleanText,
      };
      const response = await ToolExecutors.generateSpeech(args as ToolExecArgs);
      if (synthMessageId) {
        await bot.deleteMessage(chatId, synthMessageId);
        synthMessageId = undefined;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    },
  },
];

/**
 * @constant BotCommands
 * @description 定义所有 Telegram Bot 命令的数组。
 *              每个命令都包含名称和执行动作。
 */
export const BotCommands: BotCommandAction[] = [...BaseCommands, ...GenerateCommands];
