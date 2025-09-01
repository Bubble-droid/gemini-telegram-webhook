// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiError, ToolExecutors, TelegramError } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, KvNamespace, markdownToHtml, sampleByShuffle } from '@/utils';
import type { BotCommandAction, InlineKeyboardButton, ReplyMarkup, ToolExecArgs } from '@/types';
import type { FunctionDeclaration } from '@google/genai';

/**
 * @constant botCommands
 * @description 定义所有 Telegram Bot 命令的数组。
 *              每个命令都包含名称和执行动作。
 */
export const botCommands: BotCommandAction[] = [
  {
    name: 'start',
    description: '开始使用',
    action: async (params) => {
      Log.info('Executing /start command.');
      const { chatId, messageId, isCallback = false } = params;
      const { modelName, durableResourceId, startReplyTextKeyName } = BotConfig.load();
      const startReplyText = await KvNamespace.read<string>(durableResourceId, startReplyTextKeyName, 'text');
      const replaceText = startReplyText?.replace('MODEL_NAME', modelName) as string;
      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🖼️ 生成图片',
              switch_inline_query_current_chat: '生成图片：IMAGE_GENERATION_PROMPT',
            },
            {
              text: '🗣️ 生成语音',
              switch_inline_query_current_chat: '生成语音：SPEECH_GENERATION_PROMPT',
            },
          ],
          [
            {
              text: '🗑 清理对话',
              callback_data: 'cmd_clear',
            },
            {
              text: '🛠 模型工具',
              callback_data: 'cmd_tools',
            },
          ],
          [
            {
              text: '❓ 使用帮助',
              callback_data: 'cmd_help',
            },
          ],
        ],
      };

      let startResult;
      if (isCallback) {
        startResult = await TelegramBot.editMessageText(chatId, messageId, markdownToHtml(replaceText), { parseMode: 'HTML', replyMarkup });
      } else {
        startResult = await TelegramBot.sendMessage(chatId, markdownToHtml(replaceText), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
          replyMarkup,
        });
      }
      if (startResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: startResult.messageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'clear',
    description: '清理对话历史',
    action: async (params) => {
      Log.info('Executing /clear command.');
      const { chatId, messageId, userId, isCallback = false } = params;
      const clearingText = '🗑 Clearing...';
      const backReplyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '⬅️ Go Back',
              callback_data: 'cmd_start',
            },
          ],
        ],
      };
      let clearingResult;
      if (isCallback) {
        clearingResult = await TelegramBot.editMessageText(chatId, messageId, clearingText, { replyMarkup: backReplyMarkup });
      } else {
        clearingResult = await TelegramBot.sendMessage(chatId, clearingText, { replyToMessageId: messageId });
      }
      await ChatContexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3_000);
        const clearedText: string = '✅ 已成功清除你和我的历史对话';
        const clearedResult = await TelegramBot.editMessageText(chatId, clearingResult.messageId, clearedText, {
          replyMarkup: isCallback ? backReplyMarkup : undefined,
        });
        if (clearedResult.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 60_000);
        }
        void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
      }
    },
  },
  {
    name: 'tools',
    description: '模型可用工具',
    action: async (params) => {
      Log.info('Executing /tools command.');
      const { chatId, messageId, isCallback = false } = params;
      const toolFunctions = geminiTools[0]?.functionDeclarations || [];
      const toolList =
        toolFunctions
          ?.map((tool) => `  * **${tool.name}**`)
          .join('\n')
          .trim() || '';
      const randomTools = sampleByShuffle<FunctionDeclaration>(toolFunctions, 4);

      const keyboard1: InlineKeyboardButton[] = randomTools.slice(0, 2).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}`,
      }));
      const keyboard2: InlineKeyboardButton[] = randomTools.slice(2, 2).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}`,
      }));

      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '✋ 工具演示',
              switch_inline_query_current_chat: `请演示下 TOOL_NAME 工具`,
            },
          ],
          keyboard1,
          keyboard2,
        ],
      };

      const toolsText = `🛠 我可以使用以下工具：\n\n${toolList}`;

      let toolsResult;
      if (isCallback) {
        const backReplyMarkup: ReplyMarkup = {
          inline_keyboard: [
            ...replyMarkup.inline_keyboard,
            [
              {
                text: '⬅️ Go Back',
                callback_data: 'cmd_start',
              },
            ],
          ],
        };
        toolsResult = await TelegramBot.editMessageText(chatId, messageId, markdownToHtml(toolsText), {
          parseMode: 'HTML',
          replyMarkup: backReplyMarkup,
        });
      } else {
        toolsResult = await TelegramBot.sendMessage(chatId, markdownToHtml(toolsText), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
          replyMarkup,
        });
      }
      if (toolsResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 5 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 5 * 60_000);
    },
  },
  {
    name: 'exp_img_gen',
    description: '生成图片',
    action: async (params) => {
      Log.info('Executing /exp_img_gen command.');
      const { chatId, messageId, cleanText } = params;
      const { durableResourceId, geminiApiKeysKeyName } = BotConfig.load();
      const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
      if (!apiKeys || apiKeys.length === 0) {
        throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
      }
      const [apiKey, apiKeyId] = apiKeys[Math.floor(Math.random() * apiKeys.length)];
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      if (!cleanText) {
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的图片生成提示（NO_IMAGE_DESCRIPTION）`, { replyToMessageId: messageId });
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
        void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60 * 1000);
        return;
      }
      let renderMessageId: number | undefined = undefined;
      const renderResult = await TelegramBot.sendMessage(chatId, `🎨 Rendering...`, { replyToMessageId: messageId });
      if (renderResult.ok) {
        renderMessageId = renderResult.messageId;
      }
      const args = {
        chatId,
        userMessageId: messageId,
        currentApiKey: apiKey,
        prompt: cleanText,
      };
      const response = await ToolExecutors.generateImage(args as ToolExecArgs);
      if (renderMessageId) {
        await TelegramBot.deleteMessage(chatId, renderMessageId);
        renderMessageId = undefined;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    },
  },
  {
    name: 'exp_tts_gen',
    description: '生成语音',
    action: async (params) => {
      Log.info('Executing /exp_tts_gen command.');
      const { chatId, messageId, cleanText } = params;
      const { durableResourceId, geminiApiKeysKeyName } = BotConfig.load();
      const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
      if (!apiKeys || apiKeys.length === 0) {
        throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
      }
      const [apiKey, apiKeyId] = apiKeys[Math.floor(Math.random() * apiKeys.length)];
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      if (!cleanText) {
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的语音生成提示（NO_SPEECH_DESCRIPTION）`, { replyToMessageId: messageId });
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
        void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60 * 1000);
        return;
      }
      let synthMessageId: number | undefined = undefined;
      const synthResult = await TelegramBot.sendMessage(chatId, `🎙 Synthesizing...`, { replyToMessageId: messageId });
      if (synthResult.ok) {
        synthMessageId = synthResult.messageId;
      }
      const args = {
        chatId,
        userMessageId: messageId,
        currentApiKey: apiKey,
        prompt: cleanText,
      };
      const response = await ToolExecutors.generateSpeech(args as ToolExecArgs);
      if (synthMessageId) {
        await TelegramBot.deleteMessage(chatId, synthMessageId);
        synthMessageId = undefined;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    },
  },
];
