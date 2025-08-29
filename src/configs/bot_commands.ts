// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiError, GeminiApi } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, KvNamespace, convertPcmToMp3 } from '@/utils';
import type { BotCommandAction, CommandActionParams } from '@/types';
import { GoogleGenAI, type Content, type GenerateContentConfig, type Part } from '@google/genai';

/**
 * @constant botCommands
 * @description 定义所有 Telegram Bot 命令的数组。
 *              每个命令都包含名称和执行动作。
 */
export const botCommands: BotCommandAction[] = [
  {
    name: 'start',
    description: '开始使用',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /start command.');
      const { chatId, messageId } = params;
      const { modelName, durableResourceId, startReplyTextKeyName } = BotConfig.load();
      const startReplyText = await KvNamespace.read<string>(durableResourceId, startReplyTextKeyName, 'text');
      const replaceText = startReplyText?.replace('MODEL_NAME', modelName) as string;
      const startResult = await TelegramBot.sendMessage(chatId, replaceText, 'HTML', messageId);
      if (startResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: startResult.messageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'clear',
    description: '清理对话上下文',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /clear command.');
      const { chatId, messageId, userId } = params;
      const clearingResult = await TelegramBot.sendMessage(chatId, '🗑 Clearing...', 'HTML', messageId);
      await ChatContexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3_000);
        await TelegramBot.deleteMessage(chatId, clearingResult.messageId);
      }
      const clearedText: string = '✅ 已成功清除你和我的历史对话';
      const clearedResult = await TelegramBot.sendMessage(chatId, clearedText, 'HTML', messageId);
      if (clearedResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 60_000);
    },
  },
  {
    name: 'tools',
    description: '模型可用工具',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /tools command.');
      const { chatId, messageId } = params;
      const toolList = geminiTools[0].functionDeclarations
        ?.map((tool) => `  * **${tool.name}**: ${tool.description}\n`)
        .join('\n')
        .trim();
      const toolsText = `🛠 我可以使用以下工具：\n\n${toolList}`;
      const toolsResult = await TelegramBot.sendMessage(chatId, toolsText, 'HTML', messageId);
      if (toolsResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 5 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 5 * 60_000);
    },
  },
  {
    name: 'exp_img_gen',
    description: '生成图片',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /exp_img_gen command.');
      const { chatId, messageId, message } = params;
      const { durableResourceId, geminiApiKeysKeyName, botName } = BotConfig.load();
      const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
      if (!apiKeys || apiKeys.length === 0) {
        throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
      }
      const [apiKey, apiKeyId] = apiKeys[Math.floor(Math.random() * apiKeys.length)];
      const ai = new GoogleGenAI({ apiKey });
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      const contents: Content[] = [];
      const parts: Part[] = [];
      const config: GenerateContentConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
        safetySettings: GeminiApi.SAFETY_SETTINGS,
      };
      const messageText = (message.text || message.caption) as string;
      const cleanText = messageText.replace(`/exp_img_gen@${botName}`, '').trim();
      if (!cleanText) {
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的图片生成提示（NO_IMAGE_DESCRIPTION）`, 'HTML', messageId);
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
      }
      parts.push({ text: cleanText });
      contents.push({
        role: 'user',
        parts,
      });
      let renderMessageId: number | undefined = undefined;
      const renderResult = await TelegramBot.sendMessage(chatId, `🎨 Rendering...`, 'HTML', messageId);
      if (renderResult.ok) {
        renderMessageId = renderResult.messageId;
      }
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-preview-image-generation',
          contents,
          config,
        });
        Log.info(`Gemini API 响应: `, {
          response: {
            ...response,
            candidates: response.candidates?.map((candidate) => ({
              ...candidate,
              content: {
                ...candidate.content,
                parts: candidate.content?.parts?.map((part) => {
                  if (part.inlineData && part.inlineData.data) {
                    return { ...part, inlineData: { ...part.inlineData, data: 'BASE64_ENCODED_DATA' } };
                  } else if (part.text) {
                    return { ...part, text: 'TEXT_CONTENT' };
                  }
                  return part;
                }),
              },
            })),
          },
        });
        if (renderMessageId) {
          await TelegramBot.deleteMessage(chatId, renderMessageId);
          renderMessageId = undefined;
        }
        const candidate = response.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
          throw new GeminiError('Gemini API 返回结果不包含有效的内容', 'INVALID_RESPONSE', false);
        }
        const parts = candidate.content.parts;
        const resTexts = parts.map((part) => part.text).join('');
        const imageData = parts.find((part) => part.inlineData);
        if (!imageData || !imageData.inlineData?.data) {
          throw new GeminiError('Gemini API 未返回图片数据', 'INVALID_RESPONSE', false);
        }
        const base64Data = imageData.inlineData?.data as string;
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const result = await TelegramBot.sendPhoto(chatId, imageBuffer, resTexts, messageId);
        if (result.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: result.messageId }, 24 * 60 * 60 * 1000);
        }
      } catch (error: unknown) {
        if (renderMessageId) {
          await TelegramBot.deleteMessage(chatId, renderMessageId);
        }
        const errorMessage = error instanceof GeminiError ? error.message : String(error);
        throw new GeminiError(errorMessage, 'API_CLIENT_ERROR', false);
      }
    },
  },
  {
    name: 'exp_tts_gen',
    description: '生成语音',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /exp_tts_gen command.');
      const { chatId, messageId, message } = params;
      const { durableResourceId, geminiApiKeysKeyName, botName } = BotConfig.load();
      const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
      if (!apiKeys || apiKeys.length === 0) {
        throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
      }
      const [apiKey, apiKeyId] = apiKeys[Math.floor(Math.random() * apiKeys.length)];
      const ai = new GoogleGenAI({ apiKey });
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      const contents: Content[] = [];
      const parts: Part[] = [];
      const config: GenerateContentConfig = {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } } },
        safetySettings: GeminiApi.SAFETY_SETTINGS,
      };
      const messageText = (message.text || message.caption) as string;
      const cleanText = messageText.replace(`/exp_tts_gen@${botName}`, '').trim();
      if (!cleanText) {
        const notText = await TelegramBot.sendMessage(chatId, `没有有效的语音生成提示（NO_SPEECH_DESCRIPTION）`, 'HTML', messageId);
        if (notText.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1000);
        }
      }
      parts.push({ text: cleanText });
      contents.push({
        role: 'user',
        parts,
      });
      let synthMessageId: number | undefined = undefined;
      const synthResult = await TelegramBot.sendMessage(chatId, `🎙 Synthesizing...`, 'HTML', messageId);
      if (synthResult.ok) {
        synthMessageId = synthResult.messageId;
      }
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents,
          config,
        });
        Log.info(`Gemini API 响应: `, {
          response: {
            ...response,
            candidates: response.candidates?.map((candidate) => ({
              ...candidate,
              content: {
                ...candidate.content,
                parts: candidate.content?.parts?.map((part) => {
                  if (part.inlineData && part.inlineData.data) {
                    return { ...part, inlineData: { ...part.inlineData, data: 'BASE64_ENCODED_DATA' } };
                  } else if (part.text) {
                    return { ...part, text: 'TEXT_CONTENT' };
                  }
                  return part;
                }),
              },
            })),
          },
        });
        if (synthMessageId) {
          await TelegramBot.deleteMessage(chatId, synthMessageId);
          synthMessageId = undefined;
        }
        const candidate = response.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
          throw new GeminiError('Gemini API 返回结果不包含有效内容', 'INVALID_RESPONSE', false);
        }
        const responseParts = candidate.content.parts; // 重命名以避免与外部 parts 变量冲突
        const audioData = responseParts.find((part) => part.inlineData);
        if (!audioData || !audioData.inlineData?.data) {
          // 增加对 data 存在的检查
          throw new GeminiError('Gemini API 未返回音频数据', 'INVALID_RESPONSE', false);
        }
        const base64Data = audioData.inlineData.data as string;
        const pcmAudioBuffer = Buffer.from(base64Data, 'base64');
        Log.info('开始将 PCM 音频数据转换为 MP3...');
        const mp3AudioBuffer = await convertPcmToMp3(pcmAudioBuffer);
        Log.info('MP3 音频数据转换完成。');
        const result = await TelegramBot.sendVoice(chatId, mp3AudioBuffer, messageId); // 发送转换后的 MP3 Buffer
        if (result.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: result.messageId }, 24 * 60 * 60 * 1000);
        }
      } catch (error: unknown) {
        if (synthMessageId) {
          await TelegramBot.deleteMessage(chatId, synthMessageId);
        }
        const errorMessage = error instanceof GeminiError ? error.message : String(error);
        throw new GeminiError(errorMessage, 'API_CLIENT_ERROR', false);
      }
    },
  },
];
