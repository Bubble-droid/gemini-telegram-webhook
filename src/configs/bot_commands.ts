// src/configs/bot_commands.ts

import { config, bot, contexts, Log, ToolExecutors, TelegramError, KvNamespaceError, ScriptError } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, kv, sampleByShuffle, toHtml } from '@/utils';
import type { BotCommandAction, InlineKeyboardButton, Message, ReplyMarkup, ToolExecArgs } from '@/types';
import type { FunctionDeclaration } from '@google/genai';
import { scriptManager } from '@/script';

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
              text: `群组 👍 ${totalReactions.success ? totalReactions.data.like || 0 : 0}`,
              callback_data: 'PLACEHOLDER',
            },
            {
              text: `群组 👎 ${totalReactions.success ? totalReactions.data.dislike || 0 : 0}`,
              callback_data: 'PLACEHOLDER',
            },
          ],
          [
            {
              text: '🖼️ 生成图片',
              switch_inline_query_current_chat: '请生成一幅图像：IMAGE_GENERATION_PROMPT',
            },
            {
              text: '🗣️ 生成语音',
              switch_inline_query_current_chat: '请生成一段语音：SPEECH_GENERATION_PROMPT',
            },
          ],
          [
            {
              text: '🗑 清理对话',
              callback_data: `cmd_clear_${userId}`,
            },
            {
              text: '🛠 模型工具',
              callback_data: `cmd_tools_${userId}`,
            },
          ],
          [
            {
              text: '📓 使用指南',
              url: 'https://gui-for-cores.github.io/zh/guide',
            },
            {
              text: '❓ 常见问题',
              callback_data: `cmd_faq_${userId}`,
            },
          ],
          [
            {
              text: '📢 通知频道',
              url: 'https://t.me/GUI_for_Cores_Channel',
            },
            {
              text: '📄 项目地址',
              url: 'https://github.com/GUI-for-Cores',
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
        clearingResult = await bot.editMessageText(chatId, messageId, clearingText, { replyMarkup: backReplyMarkup });
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
    description: '模型可用工具',
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
      const randomTools = sampleByShuffle<FunctionDeclaration>(toolFunctions, 4);

      const keyboard1: InlineKeyboardButton[] = randomTools.slice(0, 2).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}_${userId}`,
      }));
      const keyboard2: InlineKeyboardButton[] = randomTools.slice(2, 4).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}_${userId}`,
      }));

      const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: '✋ 工具演示',
              switch_inline_query_current_chat: `请简单演示下 TOOL_NAME 工具`,
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
          replyMarkup,
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
      const synthResult = await bot.sendMessage(chatId, `🎙 Synthesizing...`, { replyToMessageId: messageId });
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

const ScriptCommands: BotCommandAction[] = [
  {
    name: 'script_add',
    description: '添加脚本',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing script_add command.');
      const { cleanText, message } = options;
      const { botToken } = config.load();
      const { document, reply_to_message } = message as Message;
      const targetDocument = document ?? reply_to_message?.document;

      let errorMessage: string | undefined = undefined;
      if (!cleanText || cleanText.length > 20) {
        errorMessage = ':add [脚本标签 < 20 个字符] ';
      }
      if (!targetDocument?.mime_type?.includes('javascript')) {
        errorMessage = '[脚本文件] :add [脚本标签 < 20 个字符]';
      }

      if (errorMessage) {
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId,
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
        return;
      }

      // 使用用户ID和自定义文本构造唯一的、有命名空间的标签
      const scriptTag = `script_${userId}_${cleanText}`;

      // 确保 targetDocument 在这里是非空的，因为上面已经进行了检查
      const getResult = await bot.getFile(targetDocument!.file_id);
      if (!getResult.ok) {
        throw new ScriptError(`无法获取文件信息: ${getResult.error}`);
      }

      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${getResult.data.file_path}`;

      try {
        await scriptManager.installForUser(userId, fileUrl, scriptTag);

        const successMessage = `✅ 脚本安装成功！\n**标签:** \`${cleanText}\``;
        const sentMsg = await bot.sendMessage(chatId, toHtml(successMessage), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        throw new ScriptError(`脚本安装失败：${errorMessage}`);
      }
    },
  },
  {
    name: 'script_remove',
    description: '删除脚本',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing script_remove command.');
      const { cleanText } = options;
      if (!cleanText) {
        const errorMessage = ':remove [脚本标签]';
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId,
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
        return;
      }

      const scriptTag = `script_${userId}_${cleanText}`;

      try {
        await scriptManager.uninstallForUser(userId, scriptTag);
        const successMessage = `🗑️ 脚本删除成功！\n**标签:** \`${cleanText}\``;
        const sentMsg = await bot.sendMessage(chatId, toHtml(successMessage), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const errorReply = `脚本删除失败：${errorMessage}`;
        const sentMsg = await bot.sendMessage(chatId, errorReply, {
          replyToMessageId: messageId,
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
      }
    },
  },
  {
    name: 'script_list',
    description: '列出已安装的所有脚本',
    action: async (chatId, userId, messageId) => {
      Log.info('Executing script_list command.');
      try {
        const scripts = await scriptManager.listForUser(userId);
        let replyText: string;

        if (scripts.length === 0) {
          replyText = '你还没有安装任何脚本。';
        } else {
          // 从完整标签中移除用户ID前缀，只显示用户关心的部分
          const scriptList = scripts.map((tag) => `  • \`${tag.replace(`script_${userId}_`, '')}\``).join('\n');
          replyText = `你已安装以下脚本：\n${scriptList}`;
        }

        const sentMsg = await bot.sendMessage(chatId, toHtml(replyText), {
          replyToMessageId: messageId,
          parseMode: 'HTML',
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        throw new ScriptError(`脚本列表获取失败：${errorMessage}`);
      }
    },
  },
  {
    name: 'script_run',
    description: '运行脚本',
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info('Executing script_run command.');
      const { cleanText, message } = options;

      if (!cleanText) {
        const errorMessage = ':run [脚本标签] [参数]';
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId,
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 60_000);
        }
        return;
      }

      const [tag, ...args] = cleanText.split(/\s+/);
      const scriptParam = args.join(' ');
      const scriptTag = `script_${userId}_${tag}`;

      const result = await scriptManager.runForUser(userId, scriptTag, message as Message, scriptParam);

      let replyText: string;
      if (result.success) {
        replyText = `✅ **脚本执行成功** (耗时: ${result.duration > 1000 ? (result.duration / 1000).toFixed(2) + 's' : result.duration.toFixed(2) + 'ms'})

\`\`\`markdown
${result.result}
\`\`\``;
      } else {
        replyText = `❌ **脚本执行失败** (耗时:  ${result.duration > 1000 ? (result.duration / 1000).toFixed(2) + 's' : result.duration.toFixed(2) + 'ms'})

\`\`\`markdown
${result.error}
\`\`\``;
      }

      const sentMsg = await bot.sendMessage(chatId, toHtml(replyText), {
        replyToMessageId: messageId,
        parseMode: 'HTML',
      });
      if (sentMsg.ok) {
        scheduleDeletion(chatId, sentMsg.messageId, 30 * 60_000);
      }
    },
  },
];
/**
 * @constant BotCommands
 * @description 定义所有 Telegram Bot 命令的数组。
 *              每个命令都包含名称和执行动作。
 */
export const BotCommands: BotCommandAction[] = [...BaseCommands, ...GenerateCommands, ...ScriptCommands];
