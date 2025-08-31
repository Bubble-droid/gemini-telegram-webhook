// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiError, ToolExecutors, TelegramError } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, KvNamespace, markdownToHtml, sampleByShuffle } from '@/utils';
import type { BotCommandAction, ReplyMarkup, ToolExecArgs } from '@/types';
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
      const { chatId, messageId } = params;
      const { modelName, durableResourceId, startReplyTextKeyName } = BotConfig.load();
      const startReplyText = await KvNamespace.read<string>(durableResourceId, startReplyTextKeyName, 'text');
      const replaceText = startReplyText?.replace('MODEL_NAME', modelName) as string;
      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🖼️ 生成图片',
              switch_inline_query_current_chat: '生成图片：图片生成提示',
            },
            {
              text: '🗣️ 生成语音',
              switch_inline_query_current_chat: '生成语音：语音生成提示',
            },
          ],
        ],
      };

      const startResult = await TelegramBot.sendMessage(chatId, replaceText, messageId, 'HTML', replyMarkup);
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
      const { chatId, messageId, userId } = params;
      const clearingText = '🗑 Clearing...';
      const clearingResult = await TelegramBot.sendMessage(chatId, clearingText, messageId);
      await ChatContexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3_000);
        const clearedText: string = '✅ 已成功清除你和我的历史对话';
        const clearedResult = await TelegramBot.editMessageText(chatId, clearingResult.messageId, clearedText);
        if (clearedResult.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 60_000);
        }
      }
    },
  },
  {
    name: 'tools',
    description: '模型可用工具',
    action: async (params) => {
      Log.info('Executing /tools command.');
      const { chatId, messageId } = params;
      const toolFunctions = geminiTools[0]?.functionDeclarations || [];
      const toolList =
        toolFunctions
          ?.map((tool) => `  * **${tool.name}**: ${tool.description}\n`)
          .join('\n')
          .trim() || '';
      const randomTools = sampleByShuffle<FunctionDeclaration>(toolFunctions, 3);

      const keyboard = randomTools.map((tool) => ({
        text: `🛠 ${tool.name}`,
        switch_inline_query_current_chat: `请演示下 \`${tool.name}\` 工具`,
      }));

      const replyMarkup: ReplyMarkup = { inline_keyboard: [[{ text: '✋ 工具演示', copy_text: { text: 'OK' } }], keyboard] };

      const toolsText = `🛠 我可以使用以下工具：\n\n${toolList}`;
      const toolsResult = await TelegramBot.sendMessage(chatId, markdownToHtml(toolsText), messageId, 'HTML', replyMarkup);
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
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的图片生成提示（NO_IMAGE_DESCRIPTION）`, messageId);
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
        return;
      }
      let renderMessageId: number | undefined = undefined;
      const renderResult = await TelegramBot.sendMessage(chatId, `🎨 Rendering...`, messageId);
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
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的语音生成提示（NO_SPEECH_DESCRIPTION）`, messageId);
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
        return;
      }
      let synthMessageId: number | undefined = undefined;
      const synthResult = await TelegramBot.sendMessage(chatId, `🎙 Synthesizing...`, messageId);
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
