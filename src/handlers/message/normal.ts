// src/handlers/message/normal.ts

import { GeminiError, Log, bot, callCustomModels, config } from '@/services';
import type * as Bot from '@/types';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';
import { faqData } from '@/configs';
import { scheduleDeletion, toHtml } from '@/utils';
import type { Content, GenerateContentConfig } from '@google/genai';
import { handleFile } from '@/handlers';

/**
 * @class NormalHandler
 * @description 处理接收到的 Telegram 普通消息（非提及、非命令）。
 *              此类负责检查消息是否是对 Bot 消息的回复，并对回复内容进行清理后，
 *              转交给提及消息处理器处理。同时，它也处理指令别名和预留的关键词回复。
 */
export class NormalHandler {
  private readonly botName: string;
  private readonly message: Bot.Message;
  private readonly chatId: number;
  private readonly userId: number;
  private readonly messageId: number;
  private readonly replyToMessage?: Bot.Message;
  private readonly photo?: Bot.PhotoSize[];
  private readonly document?: Bot.Document;
  private messageText: string;

  constructor(message: Bot.Message) {
    this.botName = config.load().botName;
    const { message_id, chat, from, reply_to_message, photo, document, text, caption } = message;
    this.message = message;
    this.chatId = chat.id;
    this.userId = from?.id as number;
    this.messageId = message_id;
    this.replyToMessage = reply_to_message;
    this.photo = photo;
    this.document = document;
    this.messageText = text || caption || '';

    Log.info('Handling normal message.', { chatId: this.chatId, messageId: this.messageId });
  }

  private async sendReply(text: string): Promise<void> {
    const sentResult = await bot.sendMessage(this.chatId, toHtml(text), {
      replyToMessageId: this.messageId,
      parseMode: 'HTML',
    });
    if (sentResult.ok) {
      scheduleDeletion(this.chatId, sentResult.messageId, 5 * 60 * 1_000);
    }
  }

  private async handleAskAlias(): Promise<boolean> {
    await handleMention(this.message);
    return true;
  }

  private async handleGenericCommandAlias(commandAlias: string, clean: string[]): Promise<boolean> {
    const commandAction = BotCommands.find(
      (command) => command.name === commandAlias || command.name === `script_${commandAlias}` || command.name === `gen_${commandAlias}`,
    );
    if (commandAction) {
      const cleanText = clean.join(' ').trim();
      Log.info('Handling commands message...', { chatId: this.chatId, messageId: this.messageId });
      await commandAction.action(this.chatId, this.userId, this.messageId, { cleanText, message: this.message });
      return true;
    }
    return false;
  }

  private async handleCommandAlias(): Promise<boolean> {
    if (!this.messageText.startsWith(':')) {
      return false;
    }
    const [commandAlias, ...clean] = this.messageText.replace(':', '').split(' ');
    if (commandAlias === 'ask') {
      return this.handleAskAlias();
    }
    return this.handleGenericCommandAlias(commandAlias, clean);
  }

  private async handleOCR(): Promise<string | void> {
    const contents: Content[] = [];
    const fileData = await handleFile(this.message).catch(() => null);
    if (!fileData) return;
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: fileData,
        },
        {
          text: `Just recognize the text in the image. Do not offer unnecessary explanations.`,
        },
      ],
    });
    const model = 'gemini-2.5-flash-lite';
    const prompt = `## SYSTEM PROTOCOL: HEADLESS OCR & FORMATTING ENGINE ##

# 1. FUNCTION
Your sole function is to serve as a high-fidelity, image-to-text recognition and structuring engine (OCR). You operate as a headless service. You do not have a personality. You do not interact. You only process.

# 2. EXECUTION FLOW
1.  Receive a \`[Source Image]\` from the user input.
2.  Visually analyze the \`[Source Image]\` to perform Optical Character Recognition (OCR) and structural analysis according to the \`[Recognition Directives]\` below.
3.  Generate the final output strictly adhering to the \`[Output Constraints]\`.

# 3. RECOGNITION DIRECTIVES
* **High-Fidelity OCR**: All characters, words, and symbols visible in the \`[Source Image]\` must be extracted with perfect accuracy across all languages. Pay close attention to punctuation, spacing, and case sensitivity.
* **Visual Structure to Markdown**: Any visual structural elements within the \`[Source Image]\` (e.g., tables, lists, code blocks from a screenshot, presentation slides, documents) MUST be interpreted and converted into their corresponding clean Markdown format.
* **Mathematical Formula Handling**: Mathematical expressions and formulas spotted in the \`[Source Image]\` should be identified and correctly enclosed in LaTeX delimiters (\`$...$\` for inline, \`$$...$$\` for block).
* **Content Integrity**: The informational content visible in the \`[Source Image]\` must be fully preserved. No information may be added, omitted, or summarized. Recognize and transcribe everything as seen.
* **Readability & Layout Optimization**: The final Markdown output must be well-formatted and organized for optimal human readability. This includes proper line breaks, spacing, and consistent list/table structure.

# 4. OUTPUT CONSTRAINTS
* **ABSOLUTE RULE**: The output MUST be the recognized and formatted text, and NOTHING else.
* **MUST NOT**: Under NO circumstances should the output contain any of the following:
    * Prefaces or introductions (e.g., "Here is the recognized text:", "好的，识别内容如下：").
    * Postscripts or summaries (e.g., "The image contains...", "希望您满意。").
    * Any form of conversational filler, greetings, or apologies.
    * Explanations about the recognition process or formatting choices.
    * Any text that is not the direct, formatted representation of the content in the \`[Source Image]\`.
* The response body must begin with the first character of the recognized text and end with its last character.

---
### TEST CASES

**User Input:**
[An image of a textbook page showing the text: The famous equation is E = mc^2. It relates energy to mass.]

**Your Output:**
The famous equation is $E = mc^2$. It relates energy to mass.

**User Input:**
[A screenshot of a simple spreadsheet with two columns, 'Name' and 'Role', and one data row: 'Alice', 'Engineer'.]

**Your Output:**
| Name  | Role     |
|-------|----------|
| Alice | Engineer |

**User Input:**
[A clean screenshot of a code editor showing a python function.]
\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

**Your Output:**

\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

-----

Engine activated. Awaiting input.`;
    const config: GenerateContentConfig = {
      temperature: 0.3,
      systemInstruction: [{ text: prompt }],
    };
    const responseContent = await callCustomModels(model, config, contents).catch((error: unknown) => {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      Log.error('Gemini API 调用失败', { err: errorMessage });
      return;
    });
    if (!responseContent) return;
    const recognize = responseContent.parts
      ?.filter((part) => part.text)
      .map((part) => part.text)
      .join('')
      .trim();
    return recognize;
  }

  /**
   * @description 该方法动态构建正则表达式，以灵活匹配用户消息，并回复相应的 FAQ 答案。
   * @returns {Promise<boolean>} 如果进行了关键词回复，则返回 true，否则返回 false。
   */
  private async handleKeywordReply(): Promise<boolean> {
    if (this.photo || this.document?.mime_type?.startsWith('image/')) {
      const recognizedText = await this.handleOCR();
      if (recognizedText) {
        this.messageText += `\n\n<image>\n${recognizedText}\n</image>`;
      }
    }
    // 寻找第一个能够完全匹配用户消息的 FAQ 条目
    const matchedFaq = faqData.find((faqItem) => {
      // 将多个 "与" 条件组 (`keywordGroups`) 映射成一个由 "或" 连接的完整正则表达式
      const pattern = faqItem.keywordGroups
        .map((group) => {
          // 对于每个 "与" 条件组，将其中的所有正则模式转换为正向预查 `(?=.*pattern)`
          // 这可以确保消息中包含所有模式，且不关心它们的顺序
          const andConditions = group.map((p) => `(?=.*${p})`).join('');
          // 返回一个代表完整 "与" 条件的字符串
          return `(${andConditions})`;
        })
        .join('|'); // 使用 "|" 将所有 "与" 条件组连接起来，形成最终的 "或" 逻辑

      // 创建一个新的正则表达式对象，并启用不区分大小写模式 ('i')
      const regex = new RegExp(pattern, 'i');

      // 测试用户消息是否匹配构建好的正则表达式
      return regex.test(this.messageText);
    });

    // 如果找到了匹配项
    if (matchedFaq) {
      Log.info('Found a matching FAQ item via regex, sending reply.', {
        chatId: this.chatId,
        messageId: this.messageId,
      });
      // 发送对应的答案
      await this.sendReply(matchedFaq.answer);
      // 返回 true，表示消息已被处理
      return true;
    }

    // 如果没有找到匹配项，返回 false
    return false;
  }

  private async handleReplyToBot(): Promise<boolean> {
    if (!this.replyToMessage) return false;
    if (this.replyToMessage.from?.username === this.botName) {
      await handleMention(this.message);
      return true;
    }
    return false;
  }

  public async process(): Promise<void> {
    if (await this.handleCommandAlias()) {
      return;
    }
    if (await this.handleReplyToBot()) {
      return;
    }
    if (await this.handleKeywordReply()) {
      return;
    }
  }
}
