// src/configs/bot_commands.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiError } from '@/services';
import { geminiTools } from '@/configs';
import { scheduleDeletion, sleep, KvNamespace, markdownToHtml } from '@/utils';
import type { BotCommandAction, CommandActionParams, Message, MessageEntity, SendPhotoParams, SendPhotoResult, TelegramApiResponse } from '@/types';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content, type GenerateContentConfig, type Part } from '@google/genai';

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
        void scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 10 * 60_000);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 10 * 60_000);
    },
  },
  {
    name: 'exp_img_gen',
    description: '生成图片',
    action: async (params: CommandActionParams) => {
      Log.info('Executing /exp_img_gen command.');
      const { chatId, messageId, message } = params;
      const { durableResourceId, geminiApiKeysKeyName, botToken, botApiUrl } = BotConfig.load();
      const apiKeys = await KvNamespace.read<[string, string][]>(durableResourceId, geminiApiKeysKeyName, 'json');
      if (!apiKeys || apiKeys.length === 0) {
        throw new GeminiError('未找到有效的 API 密钥，请检查配置。', 'GEMINI_API_KEY_NOT_FOUND', false);
      }
      const [apiKey, apiKeyId] = apiKeys[0];
      const ai = new GoogleGenAI({ apiKey });
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      const contents: Content[] = [];
      const parts: Part[] = [];
      const config: GenerateContentConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 1.0,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      };
      const systemInstruction = `## SYSTEM PROTOCOL: AI UI/UX VISUALIZATION ENGINE ##

# 1. FUNCTION
Your sole function is to serve as an advanced AI-powered UI/UX visualization and rendering engine. You translate UI source code and natural language design directives into a high-fidelity, photorealistic visual mockup of a software interface. Your purpose is not to chat, but to create.

# 2. EXECUTION FLOW
1.  **Receive Inputs**: You will be provided with \`[UI Source Code]\` (e.g., HTML/CSS, React/Vue components, Swift UI, Android XML) and natural language \`[Design Directives]\` (e.g., theme, color palette, target audience, desired style).
2.  **Structural Analysis**: First, meticulously parse the \`[UI Source Code]\`. Identify every component, its properties, and the hierarchical layout. This structural map is the unbreakable foundation for the render.
3.  **Aesthetic Interpretation**: Next, apply the user's \`[Design Directives]\`. Augment these with your internal knowledge of modern UI/UX design principles, including typography, color theory, spacing (e.g., 8pt grid system), accessibility standards, and current design trends (e.g., Neumorphism, Glassmorphism, Flat Design).
4.  **Synthesize & Render**: Finally, merge the structural analysis with the aesthetic interpretation to generate a single, polished, and elegant UI interface image.

# 3. RENDERING PRINCIPLES
* **Structural Fidelity**: ABSOLUTE PRIORITY. The generated image's layout, components, and content hierarchy MUST be a direct visual representation of the provided \`[UI Source Code]\`. If the code specifies a header, a sidebar, and a content area, the image must show exactly that structure.
* **Layout & Component Accuracy**: All UI elements (buttons, inputs, cards, menus) must be rendered accurately and appear functional. Their placement, alignment, and spacing must be precise and intentional. When a platform is implied (e.g., SwiftUI code), components should adhere to that platform's native design language unless otherwise directed.
* **Modern Aesthetics**: The final image must be beautiful, elegant, and modern. This is achieved through:
    * **Clean Typography**: Use well-regarded UI fonts with appropriate size, weight, and hierarchy.
    * **Consistent Spacing**: Employ ample white space and a consistent layout grid to ensure clarity and balance.
    * **Harmonious Colors**: Create or apply a professional color palette that enhances usability.
    * **Subtle Effects**: Use shadows, gradients, and borders tastefully to create depth and define interactivity.
* **Directive Adherence**: You MUST follow all explicit user \`[Design Directives]\`. If the user asks for a "dark mode with a primary color of #5B21B6", this must be the core of the visual theme.
* **Plausibility & Detail**: The UI should feel real. Use high-quality, context-appropriate placeholder icons (e.g., a gear icon for settings). Populate text fields with realistic placeholder text (e.g., "john.doe@email.com") instead of just "Lorem Ipsum". Image containers should feature high-quality, thematic placeholder images.

# 4. OUTPUT CONSTRAINTS
* **Primary Output**: The output MUST be the generated UI image and nothing else.
* **Secondary Output (Optional but Encouraged)**: After the image, you may provide a brief, structured "Design Rationale" in Markdown. This adds value by explaining your choices.
    * Example:
        \`\`\`
        **Design Rationale:**
        * **Theme:** Dark Mode, as requested.
        * **Palette:** A deep purple primary (#5B21B6) was used for interactive elements to create strong contrast and a modern feel.
        * **Typography:** Used "Inter" font for its excellent screen readability.
        * **Key Choices:** Added subtle inner shadows to input fields to enhance the sense of depth and interactivity.
        \`\`\`
* **Prohibitions**: Do not include any conversational intros ("Here is the UI I designed for you..."), postscripts, or apologies. The process is entirely functional.

---
Engine activated. Awaiting UI source code and design directives.`;

      const messageText = (message.text || message.caption) as string;
      const messageEntities = (message.entities || message.caption_entities) as MessageEntity[];
      const commandEntity = messageEntities.find((entity) => entity.type === 'bot_command') as MessageEntity;
      const commandText = messageText.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);
      const cleanText = messageText.replace(commandText, '').trim();
      parts.push({ text: systemInstruction });
      if (message.document) {
        const { file_id } = message.document;
        const result = await TelegramBot.getFile(file_id);
        if (result.ok) {
          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
          const res = await fetch(fileUrl, { method: 'GET' });
          const fileContents = await res.text();
          parts.push({ text: fileContents });
        }
      }
      if (messageText) {
        parts.push({ text: cleanText });
      }
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
        const candidate = response.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
          throw new GeminiError('Gemini API 返回结果不包含有效的 candidate 或 content', 'INVALID_RESPONSE', false);
        }
        if (renderMessageId) {
          await TelegramBot.deleteMessage(chatId, renderMessageId);
          renderMessageId = undefined;
        }
        const parts = candidate.content.parts;
        const resTexts = parts.map((part) => part.text).join('');
        const imageData = parts.find((part) => part.inlineData);
        if (!imageData) {
          throw new GeminiError('Gemini API 未返回图片数据', 'INVALID_RESPONSE', false);
        }
        const base64Data = imageData.inlineData?.data as string;
        const buffer = Buffer.from(base64Data, 'base64');
        const payload: SendPhotoParams = {
          chat_id: chatId,
          photo: buffer,
          caption: markdownToHtml(resTexts),
          parse_mode: 'HTML',
          show_caption_above_media: true,
          reply_parameters: {
            message_id: messageId,
            allow_sending_without_reply: true,
          },
        };
        const formData = new FormData();
        formData.append('chat_id', payload.chat_id);
        formData.append('photo', new Blob([payload.photo], { type: 'image/png' }), `gemini_gen_img.png`);
        formData.append('caption', payload.caption);
        formData.append('parse_mode', payload.parse_mode);
        formData.append('show_caption_above_media', String(payload.show_caption_above_media));
        formData.append('reply_parameters', JSON.stringify(payload.reply_parameters));
        const url = `${botApiUrl}/sendPhoto`;
        const res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
        const result = (await res.json()) as TelegramApiResponse<SendPhotoResult>;
        if (result.ok) {
          void scheduleDeletion({ chat_id: chatId, message_id: result.result.message_id }, 24 * 60 * 60 * 1000);
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
];
