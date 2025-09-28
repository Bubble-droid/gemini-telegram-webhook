import Fastify from "fastify";
import { isIP } from "node:net";
import process$1 from "node:process";
import { createWorker } from "tesseract.js";
import "node:crypto";
import * as lame from "@breezystack/lamejs";
import { Logger } from "tslog";
import { Type, Behavior, HarmBlockThreshold, HarmCategory, FunctionCallingConfigMode, GoogleGenAI, ApiError } from "@google/genai";
import { VM } from "vm2";
import Cloudflare from "cloudflare";
import * as path from "path";
const LOGGER_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];
class ConfigLoader {
  DEFAULT_LISTEN_HOST = "127.0.0.1";
  DEFAULT_LISTEN_PORT = 39001;
  DEFAULT_LOGGER_LEVEL = "info";
  DEFAULT_MODEL_NAME = "gemini-2.5-flash";
  DEFAULT_CONTEXT_EXPIRATION_DAY = 7;
  DEFAULT_MAX_CONTEXT_LENGTH = 8;
  DEFAULT_REQUEST_INTERVAL_SECOND = 30;
  DEFAULT_MAX_API_CALL_ROUNDS = 12;
  DEFAULT_SYSTEM_PROMPT_KEY_NAME = "system_prompt";
  DEFAULT_GEMINI_API_KEYS_KEY_NAME = "gemini_api_keys";
  DEFAULT_START_REPLY_TEXT_KEY_NAME = "start_reply_text";
  DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME = "new_member_welcome_text";
  REQUIRED_ENV_VARS = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "SCHEDULER_API_URL",
    "SCHEDULER_API_TOKEN",
    "DURABLE_RESOURCE_NAMESPACE_ID",
    "SYSTEM_PROMPT_KEY_NAME",
    "GEMINI_API_KEYS_KEY_NAME",
    "SCRIPTS_STORAGE_NAMESPACE_ID",
    "RATE_LIMIT_NAMESPACE_ID",
    "CHAT_CONTEXT_NAMESPACE_ID",
    "GITHUB_ACCESS_TOKEN",
    "WEBHOOK_SECRET_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_USERNAME",
    "TELEGRAM_BOT_ADMIN_ID",
    "ALLOWED_USAGE_GROUPS"
  ];
  parseListenHost = (val, fallback = this.DEFAULT_LISTEN_HOST) => {
    if (!val || val.trim() === "") {
      return fallback;
    }
    const host = val.trim();
    if (isIP(host) === 0) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_HOST 无效："${host}" 不是有效的 IPv4 或 IPv6 地址`);
    }
    return host;
  };
  parsePort = (val, fallback = this.DEFAULT_LISTEN_PORT) => {
    if (!val || val.trim() === "") {
      return fallback;
    }
    if (!/^\d+$/.test(val)) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 不是纯数字`);
    }
    const n = Number.parseInt(val, 10);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 无效："${val}" 无法解析为有效数值`);
    }
    if (n < 1 || n > 65535) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_PORT 超出范围：${n}，应在 1-65535 之间`);
    }
    return n;
  };
  parseLoggerLevel = (val, fallback = this.DEFAULT_LOGGER_LEVEL) => {
    if (!val || val.trim() === "") {
      return fallback;
    }
    const trimmedVal = val.trim().toLowerCase();
    if (LOGGER_LEVELS.includes(trimmedVal)) {
      return trimmedVal;
    }
    throw new ConfigError(`环境变量 SERVER_LOGGER_LEVEL 非法："${val.trim()}"。可选值为 ${LOGGER_LEVELS.join(", ")}`);
  };
  load = () => {
    const ENV = process$1.env;
    const missing = this.REQUIRED_ENV_VARS.filter(
      (k) => !ENV[k] || ENV[k].trim() === ""
    );
    if (missing.length > 0) {
      throw new ConfigError(`缺少必要环境变量：${missing.join(", ")}`);
    }
    const listenHost = this.parseListenHost(ENV.SERVER_LISTEN_HOST);
    const listenPort = this.parsePort(ENV.SERVER_LISTEN_PORT);
    const loggerLevel = this.parseLoggerLevel(ENV.SERVER_LOGGER_LEVEL);
    const modelName = ENV.GEMINI_MODEL_NAME || this.DEFAULT_MODEL_NAME;
    const modelTemperature = Number(ENV.MODEL_CONFIG_TEMPERATURE) || 0.2;
    const maxApiCallRounds = Number(ENV.MAX_API_CALL_ROUNDS) || this.DEFAULT_MAX_API_CALL_ROUNDS;
    const cloudflareToken = ENV.CLOUDFLARE_API_TOKEN;
    const cloudflareAccountId = ENV.CLOUDFLARE_ACCOUNT_ID;
    const schedulerApiUrl = ENV.SCHEDULER_API_URL;
    const schedulerApiToken = ENV.SCHEDULER_API_TOKEN;
    const durableResourceId = ENV.DURABLE_RESOURCE_NAMESPACE_ID;
    const systemPromptKeyName = ENV.SYSTEM_PROMPT_KEY_NAME || this.DEFAULT_SYSTEM_PROMPT_KEY_NAME;
    const geminiApiKeysKeyName = ENV.GEMINI_API_KEYS_KEY_NAME || this.DEFAULT_GEMINI_API_KEYS_KEY_NAME;
    const startReplyTextKeyName = ENV.START_REPLY_TEXT_KEY_NAME || this.DEFAULT_START_REPLY_TEXT_KEY_NAME;
    const newMemberWelcomeTextKeyName = ENV.NEW_MEMBER_WELCOME_TEXT_KEY_NAME || this.DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME;
    const scriptsStorageId = ENV.SCRIPTS_STORAGE_NAMESPACE_ID;
    const rateLimitId = ENV.RATE_LIMIT_NAMESPACE_ID;
    const chatContextId = ENV.CHAT_CONTEXT_NAMESPACE_ID;
    const contextsExpirationSecond = (Number(ENV.CONTEXT_EXPIRATION_DAY) || this.DEFAULT_CONTEXT_EXPIRATION_DAY) * 24 * 60 * 60;
    const maxContextLength = Number(ENV.MAX_CONTEXT_LENGTH) || this.DEFAULT_MAX_CONTEXT_LENGTH;
    const requestIntervalSecond = Number(ENV.REQUEST_INTERVAL_SECOND) || this.DEFAULT_REQUEST_INTERVAL_SECOND;
    const githubToken = ENV.GITHUB_ACCESS_TOKEN;
    const secretToken = ENV.WEBHOOK_SECRET_TOKEN;
    const botToken = ENV.TELEGRAM_BOT_TOKEN;
    const botApiUrl = `https://api.telegram.org/bot${botToken}`;
    const botName = ENV.TELEGRAM_BOT_USERNAME;
    const adminId = Number(ENV.TELEGRAM_BOT_ADMIN_ID);
    const allowGroups = ENV.ALLOWED_USAGE_GROUPS.split(",").map((s) => Number(s.trim())) || [];
    return {
      listenHost,
      listenPort,
      loggerLevel,
      modelName,
      modelTemperature,
      maxApiCallRounds,
      cloudflareToken,
      cloudflareAccountId,
      schedulerApiUrl,
      schedulerApiToken,
      durableResourceId,
      systemPromptKeyName,
      geminiApiKeysKeyName,
      startReplyTextKeyName,
      newMemberWelcomeTextKeyName,
      scriptsStorageId,
      rateLimitId,
      chatContextId,
      contextsExpirationSecond,
      maxContextLength,
      requestIntervalSecond,
      githubToken,
      secretToken,
      botToken,
      botApiUrl,
      botName,
      adminId,
      allowGroups
    };
  };
}
const config = new ConfigLoader();
const OCR_PROMPT = `## SYSTEM PROTOCOL: HEADLESS OCR & FORMATTING ENGINE ##

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
class Recognizer {
  fileData;
  data;
  mimeType;
  constructor(fileData) {
    this.fileData = fileData;
    this.data = fileData.data;
    this.mimeType = fileData.mimeType;
  }
  async geminiOCR() {
    const model = "gemini-2.5-flash-lite";
    const config2 = {
      temperature: 0.3,
      thinkingConfig: {
        thinkingBudget: -1
      },
      systemInstruction: [{ text: OCR_PROMPT }]
    };
    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: this.fileData
          },
          {
            text: `Just recognize the text in the image. Do not offer unnecessary explanations.`
          }
        ]
      }
    ];
    try {
      const responseContent = await callCustomModels(model, config2, contents);
      const text = responseContent.parts?.filter((part) => part.text).map((part) => part.text).join("").trim();
      return text || null;
    } catch (error) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      Log.error("Gemini API 调用失败", { err: errorMessage });
      return null;
    }
  }
  async tesseractOCR() {
    try {
      const worker = await createWorker(["eng", "chi_sim", "chi_tra"]);
      Log.info("Tesseract OCR 开始识别...");
      const { data } = await worker.recognize(`data:${this.mimeType};base64,${this.data}`);
      await worker.terminate();
      return data.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Log.error("Tesseract OCR 内部错误", { err: errorMessage });
      return null;
    }
  }
  async process() {
    let recognizedText = await this.geminiOCR();
    if (!recognizedText) {
      recognizedText = await this.tesseractOCR();
    }
    return recognizedText;
  }
}
class KvNamespace {
  callCloudflareApi = async (action, baseParams, actionParams) => {
    const { cloudflareToken, cloudflareAccountId } = config.load();
    const { namespaceId, keyName } = baseParams;
    const client = new Cloudflare({
      apiToken: cloudflareToken
    });
    try {
      if (action === "update") {
        const { value, options } = actionParams;
        await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
          value,
          ...options
        });
      } else {
        const response = await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId
        });
        return response;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Log.error("Error calling Cloudflare API:", {
        err: errorMessage
      });
      throw new KvNamespaceError(`Error calling Cloudflare API: ${errorMessage}`);
    }
  };
  read = async (namespaceId, keyName, resData) => {
    try {
      const data = await this.callCloudflareApi("get", {
        namespaceId,
        keyName
      });
      return { success: true, data: resData === "json" ? await data.json() : await data.text() };
    } catch (error) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error reading from KV for ${keyName}:`, {
        err: errorMessage
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  };
  write = async (namespaceId, keyName, value, options) => {
    try {
      await this.callCloudflareApi(
        "update",
        { namespaceId, keyName },
        {
          value,
          options
        }
      );
      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error writing to KV for keyName ${keyName}:`, {
        err: errorMessage
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  };
  delete = async (namespaceId, keyName) => {
    try {
      await this.callCloudflareApi("delete", {
        namespaceId,
        keyName
      });
      Log.info(`Deleted from ${namespaceId} - keyName: ${keyName}`);
      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof KvNamespaceError ? error.message : String(error);
      Log.error(`Error deleting from KV for keyName ${keyName}:`, {
        err: errorMessage
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  };
}
class Escaper {
  markdownV2(text) {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }
  markdownV2Code(text) {
    return text.replace(/([`\\])/g, "\\$1");
  }
  markdownV2Url(url) {
    return url.replace(/([)\\])/g, "\\$1");
  }
  html(text) {
    return text.replace(/[<>&]/g, (char) => {
      switch (char) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        default:
          return char;
      }
    });
  }
  legacyMarkdown(text) {
    return text.replace(/([_*`[])/g, "\\$1");
  }
}
class Formatter {
  htmlGenerator;
  markdownV2Generator;
  legacyMarkdownGenerator;
  constructor() {
    this.htmlGenerator = new HtmlGenerator();
    this.markdownV2Generator = new MarkdownV2Generator();
    this.legacyMarkdownGenerator = new LegacyMarkdownGenerator();
  }
  parse(markdownText) {
    const parser = new Parser(markdownText);
    return parser.parse();
  }
  getGenerator(parseMode) {
    switch (parseMode) {
      case "HTML":
        return this.htmlGenerator;
      case "MarkdownV2":
        return this.markdownV2Generator;
      case "Markdown":
        return this.legacyMarkdownGenerator;
    }
  }
}
const MAX_CONTENT_LENGTH$1 = 4096;
const splitPlainText = (text, maxLength) => {
  if ([...text].length <= maxLength) {
    return [text];
  }
  const chunks = [];
  let remainingText = text;
  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }
    let splitIndex = remainingText.lastIndexOf("\n", maxLength);
    if (splitIndex === -1) {
      splitIndex = remainingText.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = maxLength;
    }
    chunks.push(remainingText.substring(0, splitIndex));
    remainingText = remainingText.substring(splitIndex).trimStart();
  }
  return chunks;
};
const sendFormattedMessage = async (chatId, standardMarkdownText, replyToMessageId, userId) => {
  if (!standardMarkdownText || standardMarkdownText.trim().length === 0) {
    return { ok: true, messageId: void 0 };
  }
  const modesToTry = ["HTML", "MarkdownV2", "Markdown", null];
  let lastError = null;
  const processedText = preprocessMarkdown(standardMarkdownText);
  const ast = formatter.parse(processedText);
  for (const mode of modesToTry) {
    Log.info(`尝试使用 [${mode ?? "纯文本"}] 格式发送全部消息...`);
    const sentMessageIdsInCurrentAttempt = [];
    let lastMessageId;
    let currentReplyTo = replyToMessageId;
    let modeSucceeded = true;
    try {
      let chunks;
      if (mode === null) {
        chunks = splitPlainText(processedText, MAX_CONTENT_LENGTH$1);
      } else {
        const generator = formatter.getGenerator(mode);
        chunks = splitAstAndGenerateChunks(ast, generator);
      }
      Log.info(`[${mode ?? "纯文本"}] 格式的文本被分割成 ${chunks.length} 块.`);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        Log.info(`发送消息 (块 ${i + 1}/${chunks.length}, 长度: ${[...chunk].length}, 格式: ${mode ?? "纯文本"})...`);
        const replyMarkup = { inline_keyboard: makeInlineKeyboard(userId) };
        const sendResult = await bot.sendMessage(chatId, chunk, {
          replyToMessageId: currentReplyTo,
          parseMode: mode === null ? void 0 : mode,
          replyMarkup
        });
        if (sendResult.ok) {
          Log.info(`消息块 ${i + 1}/${chunks.length} 发送成功.`);
          sentMessageIdsInCurrentAttempt.push(sendResult.messageId);
          scheduleDeletion(chatId, sendResult.messageId, 24 * 60 * 6e4);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
        } else {
          Log.error(`消息块 ${i + 1}/${chunks.length} 发送失败.`, { err: sendResult.error });
          lastError = new TelegramError(sendResult.error);
          modeSucceeded = false;
          if (sentMessageIdsInCurrentAttempt.length > 0) {
            Log.warn(`[${mode ?? "纯文本"}] 模式发送中断，开始清理 ${sentMessageIdsInCurrentAttempt.length} 条已发送的消息...`);
            const deleteResult = await bot.deleteMultipleMessages(chatId, sentMessageIdsInCurrentAttempt);
            if (deleteResult.ok) {
              Log.info("清理操作完成。");
            } else {
              Log.error("清理发生错误，为了不影响任务执行，将继续处理");
            }
          }
          break;
        }
      }
      if (modeSucceeded) {
        Log.info(`所有消息均已使用 [${mode ?? "纯文本"}] 格式成功发送.`);
        return { ok: true, messageId: lastMessageId };
      }
      Log.warn(`[${mode ?? "纯文本"}] 格式发送失败，将尝试下一个格式...`);
    } catch (error) {
      lastError = new TelegramError(error instanceof Error ? error.message : String(error));
      Log.error(`在处理 [${mode ?? "纯文本"}] 格式时发生严重错误.`, { err: lastError.message });
    }
  }
  Log.error("所有格式化模式均发送失败。");
  return { ok: false, error: lastError ?? new TelegramError("未知错误导致所有格式化模式发送失败", "ALL_FORMAT_MODES_FAILED") };
};
const MAX_CONTENT_LENGTH = 4096;
const getAstContentLength = (node) => {
  switch (node.type) {
    case "text":
    case "inline_code":
    case "code_block":
      return [...node.content ?? ""].length;
    case "newline":
      return 1;
    case "root":
    case "bold":
    case "underline":
    case "strikethrough":
    case "spoiler":
    case "link":
    case "blockquote":
      return node.children?.reduce((sum, child) => sum + getAstContentLength(child), 0) ?? 0;
    default:
      return 0;
  }
};
const splitAstAndGenerateChunks = (rootNode, generator) => {
  const chunks = [];
  let currentChunkString = "";
  let currentContentLength = 0;
  const openNodesStack = [];
  const startNewChunk = () => {
    currentChunkString = openNodesStack.map((node) => generator.getOpeningTag(node.type, node)).join("");
    currentContentLength = 0;
  };
  const finalizeCurrentChunk = () => {
    if (currentContentLength === 0 && currentChunkString === "") return;
    currentChunkString += [...openNodesStack].reverse().map((node) => generator.getClosingTag(node.type, node)).join("");
    if (currentChunkString.trim().length > 0) {
      chunks.push(currentChunkString);
    }
  };
  const traverse = (node) => {
    const nodeContentLength = getAstContentLength(node);
    if (node.type === "code_block") {
      if (nodeContentLength > MAX_CONTENT_LENGTH) {
        if (currentContentLength > 0) {
          finalizeCurrentChunk();
        }
        startNewChunk();
        let remainingContent = node.content ?? "";
        while (remainingContent.length > 0) {
          const contentNodeForGeneration = { ...node, content: "" };
          const emptyNodeStr = generator.generate(contentNodeForGeneration);
          const formattingCharsLength = emptyNodeStr.length;
          const availableContentSpace = MAX_CONTENT_LENGTH - formattingCharsLength;
          let splitIndex = Math.min(remainingContent.length, availableContentSpace);
          if (splitIndex < remainingContent.length) {
            const preferredSplitIndex = remainingContent.lastIndexOf("\n", splitIndex);
            if (preferredSplitIndex > 0) {
              splitIndex = preferredSplitIndex;
            }
          }
          const part = remainingContent.substring(0, splitIndex);
          const contentPartNode = { ...node, content: part };
          const codeChunk = generator.generate(contentPartNode);
          chunks.push(codeChunk);
          remainingContent = remainingContent.substring(splitIndex).trimStart();
        }
        startNewChunk();
        return;
      } else {
        if (currentContentLength > 0 && currentContentLength + nodeContentLength > MAX_CONTENT_LENGTH) {
          finalizeCurrentChunk();
          startNewChunk();
        }
        currentChunkString += generator.generate(node);
        currentContentLength += nodeContentLength;
        return;
      }
    }
    if (node.type === "inline_code" || node.type === "text" || node.type === "newline") {
      if (currentContentLength + nodeContentLength > MAX_CONTENT_LENGTH && nodeContentLength > 0) {
        if (node.type === "inline_code") {
          finalizeCurrentChunk();
          startNewChunk();
        }
      }
    }
    openNodesStack.push(node);
    currentChunkString += generator.getOpeningTag(node.type, node);
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    } else if (node.content || node.type === "newline") {
      const content = node.content ?? "\n";
      const contentLength = getAstContentLength(node);
      if (currentContentLength + contentLength <= MAX_CONTENT_LENGTH) {
        currentChunkString += generator.generateContent(node);
        currentContentLength += contentLength;
      } else {
        let remainingContent = content;
        while (remainingContent.length > 0) {
          const remainingSpace = MAX_CONTENT_LENGTH - currentContentLength;
          if (remainingSpace <= 0) {
            finalizeCurrentChunk();
            startNewChunk();
            continue;
          }
          let splitIndex = 0;
          let currentLength = 0;
          const chars = [...remainingContent];
          for (let i = 0; i < chars.length; i++) {
            if (currentLength + 1 > remainingSpace) {
              break;
            }
            currentLength++;
            splitIndex++;
          }
          if (splitIndex < chars.length) {
            let preferredSplitIndex = -1;
            const tempStr = chars.slice(0, splitIndex).join("");
            preferredSplitIndex = tempStr.lastIndexOf("\n");
            if (preferredSplitIndex === -1) {
              preferredSplitIndex = tempStr.lastIndexOf(" ");
            }
            if (preferredSplitIndex > 0) {
              splitIndex = [...tempStr.substring(0, preferredSplitIndex + 1)].length;
            }
          }
          const part1 = chars.slice(0, splitIndex).join("");
          const part2 = chars.slice(splitIndex).join("");
          const tempNodePart1 = { ...node, content: part1 };
          currentChunkString += generator.generateContent(tempNodePart1);
          currentContentLength += [...part1].length;
          if (part2.length > 0) {
            finalizeCurrentChunk();
            startNewChunk();
          }
          remainingContent = part2;
        }
      }
    }
    currentChunkString += generator.getClosingTag(node.type, node);
    openNodesStack.pop();
  };
  if (rootNode.children) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }
  if (currentContentLength > 0 || chunks.length === 0 && currentChunkString.length > 0) {
    finalizeCurrentChunk();
  }
  return chunks;
};
class Generator {
  generate(node) {
    return this.visitNode(node);
  }
  visitNode(node) {
    const open = this.getOpeningTag(node.type, node);
    const content = this.generateContent(node);
    const close = this.getClosingTag(node.type, node);
    return open + content + close;
  }
  generateContent(node) {
    return node.content ?? this.visitChildren(node);
  }
  visitChildren(node) {
    return node.children?.map((child) => this.visitNode(child)).join("") ?? "";
  }
}
class HtmlGenerator extends Generator {
  getOpeningTag(type, node) {
    switch (type) {
      case "bold":
        return "<b>";
      case "underline":
        return "<u>";
      case "strikethrough":
        return "<s>";
      case "spoiler":
        return '<span class="tg-spoiler">';
      case "inline_code":
        return "<code>";
      case "code_block": {
        const langClass = node.lang ? ` class="language-${escaper.html(node.lang)}"` : "";
        return `<pre><code${langClass}>`;
      }
      case "link":
        return `<a href="${escaper.html(node.href ?? "")}">`;
      case "blockquote":
        return node.expandable ? "<blockquote expandable>" : "<blockquote>";
      default:
        return "";
    }
  }
  getClosingTag(type, _node) {
    switch (type) {
      case "bold":
        return "</b>";
      case "underline":
        return "</u>";
      case "strikethrough":
        return "</s>";
      case "spoiler":
        return "</span>";
      case "inline_code":
        return "</code>";
      case "code_block":
        return "</code></pre>";
      case "link":
        return "</a>";
      case "blockquote":
        return "</blockquote>";
      default:
        return "";
    }
  }
  generateContent(node) {
    if (node.type === "text") return escaper.html(node.content ?? "");
    if (node.type === "newline") return "\n";
    if (node.type === "code_block" || node.type === "inline_code") {
      return escaper.html(node.content ?? "");
    }
    return this.visitChildren(node);
  }
}
class MarkdownV2Generator extends Generator {
  getOpeningTag(type, node) {
    switch (type) {
      case "bold":
        return "*";
      case "underline":
        return "__";
      case "strikethrough":
        return "~";
      case "spoiler":
        return "||";
      case "inline_code":
        return "`";
      case "code_block":
        return `\`\`\`${node.lang ?? ""}
`;
      case "link":
        return "[";
      default:
        return "";
    }
  }
  getClosingTag(type, node) {
    switch (type) {
      case "bold":
        return "*";
      case "underline":
        return "__";
      case "strikethrough":
        return "~";
      case "spoiler":
        return "||";
      case "inline_code":
        return "`";
      case "code_block":
        return "\n```";
      case "link":
        return `](${escaper.markdownV2Url(node.href ?? "")})`;
      default:
        return "";
    }
  }
  generateContent(node) {
    if (node.type === "text") return escaper.markdownV2(node.content ?? "");
    if (node.type === "newline") return "\n";
    if (node.type === "code_block" || node.type === "inline_code") {
      return escaper.markdownV2Code(node.content ?? "");
    }
    if (node.type === "blockquote") {
      const content = this.visitChildren(node);
      return content.split("\n").map((line) => `> ${line}`).join("\n");
    }
    return this.visitChildren(node);
  }
  visitNode(node) {
    if (node.type === "blockquote") {
      return this.generateContent(node);
    }
    return super.visitNode(node);
  }
}
class LegacyMarkdownGenerator extends Generator {
  getOpeningTag(type, node) {
    switch (type) {
      case "bold":
        return "*";
      case "inline_code":
        return "`";
      case "code_block":
        return `\`\`\`${node.lang ?? ""}
`;
      case "link":
        return "[";
      default:
        return "";
    }
  }
  getClosingTag(type, node) {
    switch (type) {
      case "bold":
        return "*";
      case "inline_code":
        return "`";
      case "code_block":
        return "\n```";
      case "link":
        return `](${node.href ?? ""})`;
      default:
        return "";
    }
  }
  generateContent(node) {
    if (node.type === "text") return escaper.legacyMarkdown(node.content ?? "");
    if (node.type === "newline") return "\n";
    if (node.type === "code_block" || node.type === "inline_code") {
      return node.content ?? "";
    }
    if (["underline", "strikethrough", "spoiler", "blockquote"].includes(node.type)) {
      return this.visitChildren(node);
    }
    return this.visitChildren(node);
  }
}
class Parser {
  text;
  pos = 0;
  markers = ["**", "__", "~~", "||", "`", "[", "]", "(", ")", "```", "\n", ">"];
  constructor(text) {
    this.text = text.replace(/\r\n/g, "\n");
  }
  parse() {
    return { type: "root", children: this.parseUntil((p) => p >= this.text.length) };
  }
  parseUntil(endCondition) {
    const nodes = [];
    while (!endCondition(this.pos)) {
      const startPos = this.pos;
      const node = this.parseCodeBlock() || this.parseBlockquote() || this.parseBold() || this.parseUnderline() || this.parseStrikethrough() || this.parseSpoiler() || this.parseLink() || this.parseInlineCode() || this.parseNewline() || this.parseText(endCondition);
      if (node) {
        nodes.push(node);
      }
      if (this.pos === startPos) {
        if (!endCondition(this.pos)) {
          nodes.push({ type: "text", content: this.text[this.pos] });
          this.pos++;
        }
      }
    }
    return nodes;
  }
  match(s) {
    return this.text.substring(this.pos).startsWith(s);
  }
  parseWithMarkers(type, marker) {
    if (!this.match(marker)) return null;
    const startPos = this.pos;
    this.pos += marker.length;
    const children = this.parseUntil((p) => this.text.substring(p).startsWith(marker) || p >= this.text.length);
    if (this.match(marker)) {
      this.pos += marker.length;
      return { type, children };
    }
    this.pos = startPos;
    return null;
  }
  parseBold = () => this.parseWithMarkers("bold", "**");
  parseUnderline = () => this.parseWithMarkers("underline", "__");
  parseStrikethrough = () => this.parseWithMarkers("strikethrough", "~~");
  parseSpoiler = () => this.parseWithMarkers("spoiler", "||");
  parseNewline = () => {
    if (!this.match("\n")) return null;
    this.pos++;
    return { type: "newline" };
  };
  parseInlineCode() {
    const match = /^`([^`]+?)`/.exec(this.text.substring(this.pos));
    if (!match) return null;
    this.pos += match[0].length;
    return { type: "inline_code", content: match[1] };
  }
  parseCodeBlock() {
    const match = /^```(\w*)\n([\s\S]+?)\n```/.exec(this.text.substring(this.pos));
    if (!match) return null;
    this.pos += match[0].length;
    return { type: "code_block", lang: match[1] || void 0, content: match[2] };
  }
  parseLink() {
    if (!this.match("[")) return null;
    const startPos = this.pos;
    this.pos++;
    const children = this.parseUntil((p) => this.text[p] === "]" || p >= this.text.length);
    if (!this.match("](")) {
      this.pos = startPos;
      return null;
    }
    this.pos += 2;
    const hrefEnd = this.text.indexOf(")", this.pos);
    if (hrefEnd === -1) {
      this.pos = startPos;
      return null;
    }
    const href = this.text.substring(this.pos, hrefEnd);
    this.pos = hrefEnd + 1;
    return { type: "link", href, children };
  }
  parseBlockquote() {
    const match = /^(>>? .+(?:\n>>? .*)*)/m.exec(this.text.substring(this.pos));
    if (!match) return null;
    const fullMatchText = match[0];
    this.pos += fullMatchText.length;
    const isExpandable = fullMatchText.startsWith(">>");
    const innerContent = fullMatchText.replace(/^(>>?)\s?/gm, "");
    const innerParser = new Parser(innerContent);
    const children = innerParser.parse().children || [];
    return { type: "blockquote", expandable: isExpandable, children };
  }
  parseText(endCondition) {
    const startPos = this.pos;
    let endPos = this.text.length;
    for (const marker of this.markers) {
      const markerPos = this.text.indexOf(marker, this.pos);
      if (markerPos !== -1) {
        endPos = Math.min(endPos, markerPos);
      }
    }
    let parentEndPos = this.pos;
    while (!endCondition(parentEndPos) && parentEndPos < this.text.length) {
      parentEndPos++;
    }
    endPos = Math.min(endPos, parentEndPos);
    if (endPos > startPos) {
      this.pos = endPos;
      return { type: "text", content: this.text.substring(startPos, endPos) };
    }
    return null;
  }
}
class TableFormatter {
  rows = [];
  columnWidths = [];
  MIN_COLUMN_WIDTH = 3;
  getDisplayLength(str) {
    if (!str) return 0;
    let visualWidth = 0;
    for (let i = 0; i < str.length; i++) {
      visualWidth += str.charCodeAt(i) > 255 ? 2 : 1;
    }
    return visualWidth;
  }
  format(tableString) {
    const lines = tableString.trim().split("\n").filter((line) => line.trim().startsWith("|"));
    if (lines.length < 2) {
      return tableString;
    }
    this.parseRows(lines);
    if (this.rows.length === 0 || this.rows[0].length === 0) {
      return tableString;
    }
    this.calculateColumnWidths();
    return this.buildFormattedTable();
  }
  parseRows(lines) {
    const dataLines = [lines[0], ...lines.slice(2)];
    this.rows = dataLines.map(
      (line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim().replace(/`/g, ""))
    );
  }
  calculateColumnWidths() {
    const columnCount = this.rows[0]?.length || 0;
    this.columnWidths = Array(columnCount).fill(this.MIN_COLUMN_WIDTH);
    for (const row of this.rows) {
      const validColumnCount = Math.min(columnCount, row.length);
      for (let i = 0; i < validColumnCount; i++) {
        const requiredWidth = this.getDisplayLength(row[i] || "") + 2;
        this.columnWidths[i] = Math.max(this.columnWidths[i], requiredWidth);
      }
    }
  }
  buildBorderLine() {
    const segments = this.columnWidths.map((width) => "-".repeat(width));
    return `+${segments.join("+")}+`;
  }
  buildFormattedTable() {
    const formattedLines = [];
    const borderLine = this.buildBorderLine();
    const separatorSegments = this.columnWidths.map((width) => "-".repeat(width));
    const separatorLine = `|${separatorSegments.join("|")}|`;
    formattedLines.push(borderLine);
    formattedLines.push(this.buildRow(this.rows[0]));
    formattedLines.push(separatorLine);
    for (let i = 1; i < this.rows.length; i++) {
      formattedLines.push(this.buildRow(this.rows[i]));
      if (i < this.rows.length - 1) {
        formattedLines.push(separatorLine);
      }
    }
    formattedLines.push(borderLine);
    return formattedLines.join("\n");
  }
  buildRow(rowData) {
    const cells = rowData.map((cell, i) => {
      if (i >= this.columnWidths.length) return "";
      const targetWidth = this.columnWidths[i];
      const cellDisplayLength = this.getDisplayLength(cell);
      const paddingTotal = targetWidth - cellDisplayLength;
      const paddingLeft = Math.floor(paddingTotal / 2);
      const paddingRight = Math.ceil(paddingTotal / 2);
      return `${" ".repeat(paddingLeft)}${cell}${" ".repeat(paddingRight)}`;
    });
    return `|${cells.join("|")}|`;
  }
}
const tableFormatter = new TableFormatter();
class MarkdownUtils {
  headerToc = [];
  processTextOutsideCodeBlocks(markdownText, processor) {
    const CODE_BLOCK_PLACEHOLDER = "__CODE_BLOCK_PLACEHOLDER_";
    const codeBlocks = [];
    const safeText = markdownText.replace(/```[\s\S]*?```/g, (block) => {
      const placeholder = `${CODE_BLOCK_PLACEHOLDER}${codeBlocks.length}__`;
      codeBlocks.push(block);
      return placeholder;
    });
    let processedSafeText = processor(safeText);
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      processedSafeText = processedSafeText.replace(`${CODE_BLOCK_PLACEHOLDER}${i}__`, codeBlocks[i]);
    }
    return processedSafeText;
  }
  normalizeCodeBlocks(markdownText) {
    if (typeof markdownText !== "string" || !markdownText) {
      return "";
    }
    let normalizedText = markdownText;
    normalizedText = normalizedText.replace(/([^\n])(\s*`{3})/g, (match, precedingChar, fenceBlock) => {
      return `${precedingChar}
${fenceBlock.trim()}`;
    });
    normalizedText = normalizedText.replace(/(`{3})(\s+[^\n\r]+)/g, (match, fence, trailingContent) => {
      return `${fence}
${trailingContent}`;
    });
    return normalizedText;
  }
  preprocessTables(markdownText) {
    if (typeof markdownText !== "string" || !markdownText) {
      return "";
    }
    return this.processTextOutsideCodeBlocks(markdownText, (safeText) => {
      const tableRegex = /^(\s*\|.+\|\r?\n\s*\|(?:\s*:?-+:?\s*\|)+\r?\n(?:(?:\s*\|.*\|\r?\n)*))/gm;
      return safeText.replace(tableRegex, (table) => {
        const formattedTable = tableFormatter.format(table);
        return `\`\`\`markdown
${formattedTable.trim()}
\`\`\``;
      });
    });
  }
  preprocessHeaders(markdownText) {
    if (typeof markdownText !== "string" || !markdownText) {
      return "";
    }
    this.headerToc = [];
    return this.processTextOutsideCodeBlocks(markdownText, (safeText) => {
      const headerRegex = /^(#+)\s+(.*?)\s*#*\s*$/gm;
      return safeText.replace(headerRegex, (match, hashes, title) => {
        const level = hashes.length;
        while (this.headerToc.length < level) {
          this.headerToc.push(0);
        }
        this.headerToc.length = level;
        this.headerToc[level - 1]++;
        const headerNumbers = this.headerToc.join(".");
        return `${headerNumbers}. **${title.trim()}**`;
      });
    });
  }
}
const markdownUtils = new MarkdownUtils();
const preprocessMarkdown = (markdownText) => {
  let processedText = markdownUtils.normalizeCodeBlocks(markdownText);
  processedText = markdownUtils.preprocessTables(processedText);
  processedText = markdownUtils.preprocessHeaders(processedText);
  return processedText;
};
const escaper = new Escaper();
const formatter = new Formatter();
const MARKDOWN_REGEX = {
  CODE_BLOCK: /^\s*```(\w*)\n([\s\S]+?)\n\s*```\s*$/gm,
  INLINE_CODE: /`([^`]+?)`/g,
  LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
  BOLD_ASTERISK: /\*\*(?!\s)([\s\S]*?)(?<!\s)\*\*/g,
  UNDERLINE_UNDERSCORE: /__(?!\s)([\s\S]*?)(?<!\s)__/g,
  STRIKETHROUGH: /~~(?!\s)([\s\S]*?)(?<!\s)~~/g,
  SPOILER: /^\s*\|\|\s*\n([\s\S]*?)\n\s*\|\|\s*$/gm,
  BLOCKQUOTE_LINE: /^(>>? .+(?:\n>>? .+)*)/gm
};
class SimpleFormatter {
  toHtml = (markdownText) => {
    let processedText = markdownText;
    processedText = processedText.replace(MARKDOWN_REGEX.CODE_BLOCK, (match, lang, code) => {
      if (lang) {
        return `<pre><code class="language-${escaper.html(lang)}">${code}</code></pre>`;
      }
      return `<pre>${code}</pre>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.SPOILER, (match, content) => {
      return `<span class="tg-spoiler">${content}</span>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.BLOCKQUOTE_LINE, (match) => {
      const isExpandable = match.startsWith(">>");
      const content = match.replace(/^(>>?)\s/gm, "");
      const escapedContent = escaper.html(content);
      if (isExpandable) {
        return `<blockquote expandable>${escapedContent}</blockquote>`;
      }
      return `<blockquote>${escapedContent}</blockquote>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.BOLD_ASTERISK, (match, content) => {
      const escapedContent = escaper.html(content);
      return `<b>${escapedContent}</b>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.STRIKETHROUGH, (match, content) => {
      const escapedContent = escaper.html(content);
      return `<s>${escapedContent}</s>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.UNDERLINE_UNDERSCORE, (match, content) => {
      const escapedContent = escaper.html(content);
      return `<u>${escapedContent}</u>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.INLINE_CODE, (match, code) => {
      const escapedCode = escaper.html(code);
      return `<code>${escapedCode}</code>`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.LINK, (match, text, url) => {
      const escapedText = escaper.html(text);
      const escapedUrl = escaper.html(url);
      return `<a href="${escapedUrl}">${escapedText}</a>`;
    });
    return processedText;
  };
  toMarkdownV2 = (markdownText) => {
    let processedText = markdownText;
    processedText = processedText.replace(MARKDOWN_REGEX.CODE_BLOCK, (match, lang, code) => {
      const escapedCode = escaper.markdownV2Code(code);
      return `\`\`\`${lang}
${escapedCode}
\`\`\``;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.INLINE_CODE, (match, code) => {
      const escapedCode = escaper.markdownV2Code(code);
      return `\`${escapedCode}\``;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.LINK, (match, text, url) => {
      const escapedText = escaper.markdownV2(text);
      const escapedUrl = escaper.markdownV2Url(url);
      return `[${escapedText}](${escapedUrl})`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.SPOILER, (match, content) => {
      const escapedContent = escaper.markdownV2(content);
      return `||${escapedContent}||`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.STRIKETHROUGH, (match, content) => {
      const escapedContent = escaper.markdownV2(content);
      return `~${escapedContent}~`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.BOLD_ASTERISK, (match, content) => {
      const escapedContent = escaper.markdownV2(content);
      return `*${escapedContent}*`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.UNDERLINE_UNDERSCORE, (match, content) => {
      const escapedContent = escaper.markdownV2(content);
      return `__${escapedContent}__`;
    });
    processedText = processedText.replace(MARKDOWN_REGEX.BLOCKQUOTE_LINE, (match, content) => {
      return `> ${content}`;
    });
    return processedText;
  };
}
const formatTime = (time = Date.now()) => {
  const timeDate = typeof time === "number" ? new Date(time) : time;
  const formatter2 = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
  const parts = formatter2.formatToParts(timeDate).reduce(
    (acc, { type, value }) => {
      if (type !== "literal") {
        acc[type] = value;
      }
      return acc;
    },
    {}
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC+8`;
};
const sleep = async (delayMs) => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};
const rotateArray = (arr, steps = 1, direction = "left") => {
  const len = arr.length;
  if (len === 0) return [];
  let actualSteps = Math.abs(steps) % len;
  if (direction === "right" || steps < 0) {
    actualSteps = (len - actualSteps) % len;
  }
  return arr.slice(actualSteps).concat(arr.slice(0, actualSteps));
};
const shortenString = (input) => {
  const MAX = 4096;
  const HEAD = 2040;
  const TAIL = 2040;
  if (typeof input !== "string") {
    throw new TypeError("input must be a string");
  }
  const chars = [...input];
  if (chars.length <= MAX) return input;
  const headPart = chars.slice(0, HEAD).join("");
  const tailPart = chars.slice(chars.length - TAIL).join("");
  return `${headPart}
...
${tailPart}`;
};
const convertPcmToMp3 = async (pcmBuffer) => {
  const sampleRate = 24e3;
  const channels = 1;
  const kbps = 128;
  const mp3encoder = new lame.Mp3Encoder(channels, sampleRate, kbps);
  const pcm16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  const mp3Data = [];
  const samplesPerFrame = 1152;
  for (let i = 0; i < pcm16.length; i += samplesPerFrame) {
    const chunk = pcm16.subarray(i, i + samplesPerFrame);
    const mp3buf2 = mp3encoder.encodeBuffer(chunk);
    if (mp3buf2.length > 0) {
      mp3Data.push(Buffer.from(mp3buf2));
    }
  }
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(Buffer.from(mp3buf));
  }
  return Buffer.concat(mp3Data);
};
const sendErrorNotification = async (error, context = "") => {
  const { adminId } = config.load();
  try {
    if (adminId) {
      const currentTime = formatTime(Date.now());
      const errorMessage = `🚨 [错误告警] 🚨

发生时间: \`${currentTime}\`

错误上下文: \`${escaper.html(context)}\`

错误信息 \`${escaper.html(error.message || String(error))}\`

堆栈追踪:
\`\`\`javascript
${error.stack || "N/A"}
\`\`\``;
      await bot.sendMessage(adminId, toHtml(errorMessage), { parseMode: "HTML" });
      Log.info("Error notification sent to admin.", { context, adminId });
    } else {
      Log.warn("Admin ID is not configured, unable to send error notification.", {
        context,
        error: error.message
      });
    }
  } catch (handlerError) {
    Log.error("Internal error occurred while sending error notification.", {
      err: handlerError,
      originalErrorContext: context
    });
  }
};
const makeGitHubApiRequest = async (options) => {
  const { githubToken } = config.load();
  const { method, urlPath, queryParams } = options;
  const apiUrl = `https://api.github.com/${urlPath}${queryParams ? `?${queryParams}` : ""}`;
  Log.info(`尝试通过 GitHub API 请求: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "Gemini-Telegram-Bot"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      Log.warn(`GitHub API 请求失败，状态码: ${response.status}, 错误: ${errorText}, URL: ${apiUrl}`);
      return {
        success: false,
        error: `GitHub API 请求失败 (状态码: ${response.status}) - ${errorText}`
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    Log.error(`GitHub API 请求时发生网络错误: ${errorMessage}, URL: ${apiUrl}`);
    return {
      success: false,
      error: `GitHub API 请求时发生网络错误 - ${errorMessage || "未知错误"}`
    };
  }
};
const makeRawFileRequest = async (rawPath) => {
  Log.info(`尝试获取原始文件内容: ${rawPath}`);
  const { githubToken } = config.load();
  const rawUrl = `https://raw.githubusercontent.com/${rawPath}`;
  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "Gemini-Telegram-Bot"
      }
    });
    if (!response.ok) {
      Log.warn(`获取原始文件内容失败，状态码: ${response.status}, PATH: ${rawPath}`);
      return {
        success: false,
        error: `无法获取文件内容 (状态码: ${response.status})`
      };
    }
    const content = await response.text();
    return { success: true, data: content };
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    Log.error(`获取原始文件时发生网络错误: ${errorMessage}, PATH: ${rawPath}`);
    return {
      success: false,
      error: `获取原始文件时发生网络错误 - ${errorMessage || "未知错误"}`
    };
  }
};
const scheduleTask = async (action, params, delayMs) => {
  const { schedulerApiUrl, schedulerApiToken } = config.load();
  const name = `${action}-${JSON.stringify(params)}`;
  const encoded = Buffer.from(schedulerApiToken, "utf-8").toString("base64");
  try {
    const res = await fetch(schedulerApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`
      },
      body: JSON.stringify({ action, params, delayMs })
    });
    const result = await res.json();
    if (result.status === "scheduled") {
      Log.info(`Registering scheduled task with name: ${name}, execute after ${delayMs / 1e3} s`, {
        params
      });
    }
  } catch (error) {
    Log.error(`Failed to register scheduled task with name: ${name}`, {
      params,
      err: error instanceof Error ? error.message : String(error)
    });
  }
};
const scheduleDeletion = (chatId, messageId, delayMs) => {
  return scheduleTask("deleteMessage", { chat_id: chatId, message_id: messageId }, delayMs);
};
const scheduleMultipleDeletion = (chatId, messageIds, delayMs) => {
  return scheduleTask("deleteMessages", { chat_id: chatId, message_ids: messageIds }, delayMs);
};
const DEFAULT_RETRY_SECONDS = 60;
const recordTimestamp = async (namespaceId, keyName, timestamp) => {
  await kv.write(namespaceId, keyName, timestamp.toString());
};
const getTimestamp = async (namespaceId, keyName) => {
  const timestampStr = await kv.read(namespaceId, keyName, "text");
  if (timestampStr.success) {
    const timestamp = parseInt(timestampStr.data, 10);
    if (!isNaN(timestamp)) {
      return timestamp;
    } else {
      Log.warn(`KV 中键 ${keyName} 存储了无效的时间戳: ${timestampStr}`);
      return null;
    }
  }
  return null;
};
const rateLimiterCheck = async (chatId) => {
  const { rateLimitId: namespaceId, requestIntervalSecond: intervalSecond } = config.load();
  const keyName = `rate_limit_${chatId}`;
  const now = Date.now();
  const intervalMilliseconds = intervalSecond * 1e3;
  try {
    const lastTimestamp = await getTimestamp(namespaceId, keyName);
    if (lastTimestamp === null || now - lastTimestamp >= intervalMilliseconds) {
      await recordTimestamp(namespaceId, keyName, now);
      return { canProceed: true };
    } else {
      const elapsedMilliseconds = now - lastTimestamp;
      const remainingMilliseconds = intervalMilliseconds - elapsedMilliseconds;
      const safeRemainingMilliseconds = Math.max(0, remainingMilliseconds);
      const retryAfterSeconds = Math.ceil(safeRemainingMilliseconds / 1e3);
      return { canProceed: false, retryAfterSeconds };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Log.error(`限流器错误 (键: ${keyName}):`, { err: errorMessage });
    return { canProceed: false, retryAfterSeconds: DEFAULT_RETRY_SECONDS };
  }
};
class HttpError extends Error {
  response;
  status;
  statusText;
  constructor(message, response) {
    super(message);
    this.name = "HttpError";
    this.response = response;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}
class CustomBody {
}
class JsonBody extends CustomBody {
  payload;
  constructor(payload) {
    super();
    this.payload = payload;
  }
  get body() {
    return JSON.stringify(this.payload);
  }
  get headers() {
    return { "Content-Type": "application/json;charset=UTF-8" };
  }
}
class FormDataBody extends CustomBody {
  formData;
  constructor(formData) {
    super();
    this.formData = formData;
  }
  get body() {
    return this.formData;
  }
  get headers() {
    return {};
  }
}
const Body = {
  json: (payload) => new JsonBody(payload),
  formData: (formData) => new FormDataBody(formData)
};
class HttpClient {
  DEFAULT_TIMEOUT = 6e4;
  async request(url, options = {}) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const error = new TypeError("HttpClient Error: URL 必须是一个有效的绝对路径 (以 http:// 或 https:// 开头)。");
      return { data: null, ok: false, status: 0, statusText: "客户端错误", error };
    }
    const { responseType = "json", queryParams, body: originalBody, timeout, ...restOptions } = options;
    const fetchOptions = { ...restOptions };
    const finalUrl = this.buildUrlWithParams(url, queryParams);
    const userHeaders = restOptions.headers || {};
    let bodyHeaders = {};
    if (originalBody instanceof CustomBody) {
      fetchOptions.body = originalBody.body;
      bodyHeaders = originalBody.headers;
    } else {
      fetchOptions.body = originalBody;
    }
    fetchOptions.headers = { ...bodyHeaders, ...userHeaders };
    const controller = new AbortController();
    const timeoutDuration = timeout ?? this.DEFAULT_TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    fetchOptions.signal = controller.signal;
    Log.info(`[HttpClient] 发起请求: ${fetchOptions.method || "GET"} ${finalUrl}`);
    try {
      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = new HttpError(`HTTP 请求失败，状态码: ${response.status}`, response);
        return { data: null, ok: false, status: response.status, statusText: response.statusText, error };
      }
      const data = await this.processResponse(response, responseType);
      return { data, ok: true, status: response.status, statusText: response.statusText };
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error instanceof Error ? error : new Error("未知网络错误");
      return { data: null, ok: false, status: 0, statusText: "客户端错误", error: err };
    }
  }
  get(url, options = {}) {
    return this.request(url, { ...options, method: "GET" });
  }
  post(url, body, options = {}) {
    return this.request(url, { ...options, method: "POST", body });
  }
  put(url, body, options = {}) {
    return this.request(url, { ...options, method: "PUT", body });
  }
  patch(url, body, options = {}) {
    return this.request(url, { ...options, method: "PATCH", body });
  }
  delete(url, options = {}) {
    return this.request(url, { ...options, method: "DELETE" });
  }
  buildUrlWithParams(url, queryParams) {
    if (!queryParams) return url;
    const urlObject = new URL(url);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== void 0 && value !== null) {
        urlObject.searchParams.append(key, String(value));
      }
    });
    return urlObject.toString();
  }
  async processResponse(response, responseType) {
    switch (responseType) {
      case "json": {
        const text = await response.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`HttpClient Error: 无法将响应解析为 JSON。`);
        }
      }
      case "text":
        return response.text();
      case "arrayBuffer":
        return response.arrayBuffer();
      case "response":
        return response;
      default:
        throw new Error(`HttpClient Error: 无效的 responseType '${responseType}'。`);
    }
  }
}
const Http = new HttpClient();
const handleOCR = async (fileData) => {
  const recognizer = new Recognizer(fileData);
  return recognizer.process();
};
const simpleFormatter = new SimpleFormatter();
const toHtml = (markdownText) => {
  return simpleFormatter.toHtml(markdownText);
};
const kv = new KvNamespace();
class ExecutionService {
  async executeScript(scriptContent, message, param) {
    const startTime = process.hrtime.bigint();
    const vm = new VM({
      timeout: 6e4,
      eval: false,
      allowAsync: true
    });
    const utils = {
      Http,
      Body
    };
    const options = {
      param,
      message,
      utils
    };
    try {
      vm.run(scriptContent);
      vm.freeze(options, "options");
      const result = await vm.run("run(options)");
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6;
      return {
        success: true,
        result,
        duration
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("'run' is not a function")) {
        return {
          success: false,
          error: "脚本执行失败：脚本中未定义有效的 'run' 函数。",
          duration
        };
      }
      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }
}
class ScriptManager {
  durableResourceId;
  constructor() {
    const { durableResourceId } = config.load();
    this.durableResourceId = durableResourceId;
  }
  _getUserScriptsKey(userId) {
    return `user_scripts_${userId}`;
  }
  async _getUserScripts(userId) {
    const key = this._getUserScriptsKey(userId);
    const result = await kv.read(this.durableResourceId, key, "json");
    if (!result.success) {
      if (result.error.includes("key not found")) {
        return [];
      }
      throw new ScriptError(`读取用户脚本列表失败: ${result.error}`);
    }
    return result.data ?? [];
  }
  async _saveUserScripts(userId, scripts) {
    const key = this._getUserScriptsKey(userId);
    const result = await kv.write(this.durableResourceId, key, JSON.stringify(scripts));
    if (!result.success) {
      throw new ScriptError(`更新用户脚本列表失败: ${result.error}`);
    }
  }
  async installForUser(userId, url, tag) {
    const userScripts = await this._getUserScripts(userId);
    if (userScripts.includes(tag)) {
      Log.warn(`脚本标签 "${tag}" 已存在，将覆盖已有的脚本。`);
    }
    Log.info(`[ScriptManager] 正在为用户 ${userId} 从 ${url} 下载脚本...`);
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new ScriptError(`下载脚本失败，状态码: ${response.status}`);
    }
    const scriptContent = await response.text();
    if (typeof scriptContent !== "string" || scriptContent.trim() === "") {
      throw new ScriptError("下载的脚本内容无效或为空。");
    }
    await storageService.saveScript(scriptContent, tag);
    try {
      if (!userScripts.includes(tag)) {
        const updatedScripts = [...userScripts, tag];
        await this._saveUserScripts(userId, updatedScripts);
      }
      Log.info(`[ScriptManager] 用户 ${userId} 的脚本安装成功，标签: ${tag}`);
    } catch (error) {
      Log.error(`[ScriptManager] 更新用户脚本列表失败，正在回滚...`, { err: error });
      await storageService.deleteScript(tag);
      throw error;
    }
  }
  async uninstallForUser(userId, tag) {
    const userScripts = await this._getUserScripts(userId);
    if (!userScripts.includes(tag)) {
      throw new ScriptError(`脚本卸载失败：未找到标签为 "${tag.replace(`script_${userId}_`, "")}" 的脚本。`);
    }
    const updatedScripts = userScripts.filter((t) => t !== tag);
    await this._saveUserScripts(userId, updatedScripts);
    try {
      await storageService.deleteScript(tag);
      Log.info(`[ScriptManager] 用户 ${userId} 的脚本卸载成功，标签: ${tag}`);
    } catch (error) {
      Log.error(`[ScriptManager] 脚本内容删除失败，但用户列表已更新。标签: ${tag}`, { err: error });
    }
  }
  async listForUser(userId) {
    return this._getUserScripts(userId);
  }
  async runForUser(userId, tag, message, param) {
    Log.info(`[ScriptManager] 用户 ${userId} 准备执行脚本，标签: ${tag}`);
    const userScripts = await this._getUserScripts(userId);
    if (!userScripts.includes(tag)) {
      return {
        success: false,
        error: `权限错误：你未安装标签为 "${tag.replace(`script_${userId}_`, "")}" 的脚本。`,
        duration: 0
      };
    }
    try {
      const scriptContent = await storageService.getScript(tag);
      return executionService.executeScript(scriptContent, message, param);
    } catch (error) {
      const message2 = error instanceof ScriptError ? error.message : String(error);
      return {
        success: false,
        error: `脚本执行准备失败: ${message2}`,
        duration: 0
      };
    }
  }
}
class StorageService {
  scriptsStorageId;
  constructor() {
    const { scriptsStorageId } = config.load();
    this.scriptsStorageId = scriptsStorageId;
  }
  async saveScript(scriptContent, tag) {
    const result = await kv.write(this.scriptsStorageId, tag, scriptContent);
    if (!result.success) {
      throw new ScriptError(`脚本内容保存失败: ${result.error}`);
    }
    Log.info(`[StorageService] 脚本内容已保存, 标签: ${tag}`);
  }
  async getScript(tag) {
    const result = await kv.read(this.scriptsStorageId, tag, "text");
    if (!result.success) {
      Log.error(`[StorageService] 读取脚本内容失败, 标签: ${tag}`, { err: result.error });
      throw new ScriptError(`脚本内容读取失败: ${result.error}`);
    }
    if (result.data === null || result.data === void 0) {
      throw new ScriptError(`脚本内容未找到, 标签: ${tag}`);
    }
    return result.data;
  }
  async deleteScript(tag) {
    const result = await kv.delete(this.scriptsStorageId, tag);
    if (!result.success) {
      throw new ScriptError(`脚本内容删除失败: ${result.error}`);
    }
    Log.info(`[StorageService] 脚本内容已删除, 标签: ${tag}`);
  }
}
const scriptManager = new ScriptManager();
const executionService = new ExecutionService();
const storageService = new StorageService();
const BaseCommands = [
  {
    name: "start",
    description: "开始使用",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing start command.");
      const { isCallback = false } = options;
      const { modelName, durableResourceId, startReplyTextKeyName, botName } = config.load();
      const startReply = await kv.read(durableResourceId, startReplyTextKeyName, "text");
      if (!startReply.success) {
        throw new KvNamespaceError(`Start 命令回复内容读取失败，${startReply.error}`, "START_REPLY_NOT_FOUND");
      }
      const replaceText = startReply.data.replace("${MODEL_NAME}", modelName).replace(/\${BOT_NAME}/g, botName).trim();
      const totalReactionsKeyName = `total_reactions_${chatId}`;
      const totalReactions = await kv.read(durableResourceId, totalReactionsKeyName, "json");
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: `群组 👍 ${totalReactions.success ? totalReactions.data.like : 0}`,
              callback_data: "PLACEHOLDER"
            },
            {
              text: `群组 👎 ${totalReactions.success ? totalReactions.data.dislike : 0}`,
              callback_data: "PLACEHOLDER"
            }
          ],
          [
            {
              text: "🗑 清理对话",
              callback_data: `cmd_clear_${userId}`
            },
            {
              text: "🛠 模型工具",
              callback_data: `cmd_tools_${userId}`
            }
          ],
          [
            {
              text: "📓 使用指南",
              url: "https://gui-for-cores.github.io/zh/guide"
            },
            {
              text: "❓ 常见问题",
              callback_data: `cmd_faq_${userId}`
            }
          ],
          [
            {
              text: "📢 通知频道",
              url: "https://t.me/GUI_for_Cores_Channel"
            },
            {
              text: "📄 项目地址",
              url: "https://github.com/GUI-for-Cores"
            }
          ]
        ]
      };
      let startResult;
      if (isCallback) {
        startResult = await bot.editMessageText(chatId, messageId, toHtml(replaceText), { parseMode: "HTML", replyMarkup });
      } else {
        startResult = await bot.sendMessage(chatId, toHtml(replaceText), {
          replyToMessageId: messageId,
          parseMode: "HTML",
          replyMarkup
        });
      }
      if (startResult.ok) {
        scheduleDeletion(chatId, startResult.messageId, 3 * 6e4);
      }
    }
  },
  {
    name: "faq",
    description: "常见问题",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing faq command.");
      const { isCallback = false } = options;
      const { durableResourceId } = config.load();
      const faqReply = await kv.read(durableResourceId, "cmd_faq_reply", "text");
      if (!faqReply.success) {
        throw new KvNamespaceError(`FAQ 命令回复内容读取失败，${faqReply.error}`, "FAQ_REPLY_NOT_FOUND");
      }
      const backReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: "⬅️ Go Back",
              callback_data: `cmd_start_${userId}`
            }
          ]
        ]
      };
      let faqResult;
      if (isCallback) {
        faqResult = await bot.editMessageText(chatId, messageId, toHtml(faqReply.data.trim()), {
          parseMode: "HTML",
          replyMarkup: backReplyMarkup
        });
      } else {
        faqResult = await bot.sendMessage(chatId, toHtml(faqReply.data.trim()), { replyToMessageId: messageId, parseMode: "HTML" });
      }
      if (faqResult.ok) {
        scheduleDeletion(chatId, faqResult.messageId, 5 * 6e4);
      }
    }
  },
  {
    name: "clear",
    description: "清理对话历史",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing clear command.");
      const { isCallback = false } = options;
      const clearingText = "🗑 Clearing...";
      const backReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: "⬅️ Go Back",
              callback_data: `cmd_start_${userId}`
            }
          ]
        ]
      };
      let clearingResult;
      if (isCallback) {
        clearingResult = await bot.editMessageText(chatId, messageId, clearingText);
      } else {
        clearingResult = await bot.sendMessage(chatId, clearingText, { replyToMessageId: messageId });
      }
      await contexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3e3);
        const clearedText = "✅ 已成功清除你和我的历史对话";
        const clearedResult = await bot.editMessageText(chatId, clearingResult.messageId, clearedText, {
          replyMarkup: isCallback ? backReplyMarkup : void 0
        });
        if (clearedResult.ok) {
          scheduleDeletion(chatId, clearedResult.messageId, 3 * 6e4);
        }
      }
    }
  },
  {
    name: "tools",
    description: "模型可用工具",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing tools command.");
      const { isCallback = false } = options;
      const toolFunctions = geminiTools[0]?.functionDeclarations || [];
      const toolList = toolFunctions?.map(
        (tool) => `* **${tool.name}**
    ${[...tool.description].length > 40 ? `${tool.description?.slice(0, 40)}...` : tool.description}`
      ).join("\n").trim() || "";
      const toolsText = `🛠 我可以使用以下工具：

${toolList}`;
      let toolsResult;
      if (isCallback) {
        const backReplyMarkup = {
          inline_keyboard: [
            [
              {
                text: "⬅️ Go Back",
                callback_data: `cmd_start_${userId}`
              }
            ]
          ]
        };
        toolsResult = await bot.editMessageText(chatId, messageId, toHtml(toolsText), {
          parseMode: "HTML",
          replyMarkup: backReplyMarkup
        });
      } else {
        toolsResult = await bot.sendMessage(chatId, toHtml(toolsText), {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
      }
      if (toolsResult.ok) {
        scheduleDeletion(chatId, toolsResult.messageId, 5 * 6e4);
      }
    }
  }
];
const GenerateCommands = [
  {
    name: "gen_img",
    description: "生成图片",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing gen_img command.");
      const { cleanText } = options;
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:img [图片生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion(chatId, notText.messageId, 3 * 60 * 1e3);
        }
        return;
      }
      let renderMessageId = void 0;
      const renderResult = await bot.sendMessage(chatId, `🎨 Rendering...`, { replyToMessageId: messageId });
      if (renderResult.ok) {
        renderMessageId = renderResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        prompt: cleanText
      };
      const response = await ToolExecutors.generateImage(args);
      if (renderMessageId) {
        await bot.deleteMessage(chatId, renderMessageId);
        renderMessageId = void 0;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    }
  },
  {
    name: "gen_tts",
    description: "生成语音",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing gen_tts command.");
      const { cleanText } = options;
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:tts [语音生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion(chatId, notText.messageId, 3 * 60 * 1e3);
        }
        return;
      }
      let synthMessageId = void 0;
      const synthResult = await bot.sendMessage(chatId, `🎙️ Synthesizing...`, { replyToMessageId: messageId });
      if (synthResult.ok) {
        synthMessageId = synthResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        prompt: cleanText
      };
      const response = await ToolExecutors.generateSpeech(args);
      if (synthMessageId) {
        await bot.deleteMessage(chatId, synthMessageId);
        synthMessageId = void 0;
      }
      if (!response.success) {
        throw new TelegramError(response.error);
      }
    }
  }
];
const ScriptCommands = [
  {
    name: "script_add",
    description: "添加脚本",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing script_add command.");
      const { cleanText, message } = options;
      const { botToken } = config.load();
      const { document, reply_to_message } = message;
      const targetDocument = document ?? reply_to_message?.document;
      let errorMessage = void 0;
      if (!cleanText || cleanText.length > 20) {
        errorMessage = ":add [脚本标签 < 20 个字符] ";
      }
      if (!targetDocument?.mime_type?.includes("javascript")) {
        errorMessage = "[脚本文件] :add [脚本标签 < 20 个字符]";
      }
      if (errorMessage) {
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
        return;
      }
      const scriptTag = `script_${userId}_${cleanText}`;
      const getResult = await bot.getFile(targetDocument.file_id);
      if (!getResult.ok) {
        throw new ScriptError(`无法获取文件信息: ${getResult.error}`);
      }
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${getResult.data.file_path}`;
      try {
        await scriptManager.installForUser(userId, fileUrl, scriptTag);
        const successMessage = `✅ 脚本安装成功！
**标签:** \`${cleanText}\``;
        const sentMsg = await bot.sendMessage(chatId, toHtml(successMessage), {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
      } catch (error) {
        const errorMessage2 = error instanceof Error ? error.message : "未知错误";
        throw new ScriptError(`脚本安装失败：${errorMessage2}`);
      }
    }
  },
  {
    name: "script_remove",
    description: "删除脚本",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing script_remove command.");
      const { cleanText } = options;
      if (!cleanText) {
        const errorMessage = ":remove [脚本标签]";
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
        return;
      }
      const scriptTag = `script_${userId}_${cleanText}`;
      try {
        await scriptManager.uninstallForUser(userId, scriptTag);
        const successMessage = `🗑️ 脚本删除成功！
**标签:** \`${cleanText}\``;
        const sentMsg = await bot.sendMessage(chatId, toHtml(successMessage), {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        const errorReply = `脚本删除失败：${errorMessage}`;
        const sentMsg = await bot.sendMessage(chatId, errorReply, {
          replyToMessageId: messageId
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
      }
    }
  },
  {
    name: "script_list",
    description: "列出已安装的所有脚本",
    action: async (chatId, userId, messageId) => {
      Log.info("Executing script_list command.");
      try {
        const scripts = await scriptManager.listForUser(userId);
        let replyText;
        if (scripts.length === 0) {
          replyText = "你还没有安装任何脚本。";
        } else {
          const scriptList = scripts.map((tag) => `  • \`${tag.replace(`script_${userId}_`, "")}\``).join("\n");
          replyText = `你已安装以下脚本：
${scriptList}`;
        }
        const sentMsg = await bot.sendMessage(chatId, toHtml(replyText), {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion(chatId, sentMsg.messageId, 3 * 6e4);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        throw new ScriptError(`脚本列表获取失败：${errorMessage}`);
      }
    }
  },
  {
    name: "script_run",
    description: "运行脚本",
    action: async (chatId, userId, messageId, options = {}) => {
      Log.info("Executing script_run command.");
      const { cleanText, message } = options;
      if (!cleanText) {
        const errorMessage = ":run [脚本标签] [参数]";
        const sentMsg2 = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId
        });
        if (sentMsg2.ok) {
          scheduleDeletion(chatId, sentMsg2.messageId, 3 * 6e4);
        }
        return;
      }
      const [tag, ...args] = cleanText.split(/\s+/);
      const scriptParam = args.join(" ");
      const scriptTag = `script_${userId}_${tag}`;
      const result = await scriptManager.runForUser(userId, scriptTag, message, scriptParam);
      let replyText;
      if (result.success) {
        replyText = `✅ **脚本执行成功** (耗时: ${result.duration > 1e3 ? (result.duration / 1e3).toFixed(2) + "s" : result.duration.toFixed(2) + "ms"})

\`\`\`markdown
${result.result}
\`\`\``;
      } else {
        replyText = `❌ **脚本执行失败** (耗时:  ${result.duration > 1e3 ? (result.duration / 1e3).toFixed(2) + "s" : result.duration.toFixed(2) + "ms"})

\`\`\`markdown
${result.error}
\`\`\``;
      }
      const sentMsg = await bot.sendMessage(chatId, toHtml(replyText), {
        replyToMessageId: messageId,
        parseMode: "HTML"
      });
      if (sentMsg.ok) {
        scheduleDeletion(chatId, sentMsg.messageId, 5 * 6e4);
      }
    }
  }
];
const BotCommands = [...BaseCommands, ...GenerateCommands, ...ScriptCommands];
const functionForSearch = [
  {
    name: "searchFilesInRepo",
    description: "根据关键词在指定的 GitHub 仓库、分支和特定路径下搜索文件内容，以获取相关文件路径。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Search GitHub Repository Files By Keyword Parameters",
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索文件内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "路由 AND 拦截"。'
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        branch: {
          type: Type.STRING,
          description: "要搜索的仓库分支，默认为仓库默认分支（如 main 或 master）。"
        }
      },
      required: ["keyword", "owner", "repo"]
    }
  },
  {
    name: "searchCommitsInRepo",
    description: "根据关键词在指定的 GitHub 仓库内搜索提交记录（Commit），返回匹配的提交列表。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Search GitHub Commits By Keyword Parameters",
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索提交消息内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "fix AND bug"。'
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        }
      },
      required: ["keyword", "owner", "repo"]
    }
  },
  {
    name: "searchIssuesInRepo",
    description: "根据关键词在指定的 GitHub 仓库内搜索 Issue，并可根据状态返回匹配的 Issue 列表。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Search GitHub Issues Parameters",
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索 Issue 内容和标题的关键词，多个关键词请用 AND 或 OR 分隔，例如 "tun AND error"。'
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"（开放）、"closed"（关闭），默认为 "open"。',
          default: "open",
          enum: ["open", "closed"]
        }
      },
      required: ["keyword", "owner", "repo"]
    }
  },
  {
    name: "searchReposInGlobal",
    description: "根据关键词在整个 GitHub 平台搜索相关的公开仓库。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Search GitHub Repositories Globally Parameters",
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索仓库名称和描述的关键词，例如 "sing-box dashboard"。'
        },
        qualifier: {
          type: Type.STRING,
          description: '搜索范围，可以是 "name"（仓库名称）、"description"（仓库描述）、"readme"（README 文件内容）。多个值用逗号分隔，例如 "name,description"。',
          default: "name,description",
          enum: ["name", "description", "readme"]
        }
      },
      required: ["keyword"]
    }
  },
  {
    name: "searchIssuesInGlobal",
    description: "根据关键词在整个 GitHub 平台搜索相关的公开 Issue。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Search GitHub Issues Globally Parameters",
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索 Issue 内容和标题的关键词，多个关键词请用 AND 或 OR 分隔，例如 "gvisor AND performance"。'
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"（开放）、"closed"（关闭），默认为 "open"。',
          default: "open",
          enum: ["open", "closed"]
        }
      },
      required: ["keyword"]
    }
  }
];
const functionForList = [
  {
    name: "listRepoTree",
    description: "递归列出指定 GitHub 仓库和分支下的所有文件及其完整路径。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Repository Tree Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        branch: {
          type: Type.STRING,
          description: "要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。"
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "listDirContents",
    description: "列出指定 GitHub 仓库、指定目录内的所有文件和子目录（只包含顶层内容）。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Directory Contents Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        path: {
          type: Type.STRING,
          description: '要列出文件和子目录的路径，默认为仓库根目录。例如 "docs/configuration/"。此路径应相对于仓库根目录。',
          default: ""
        },
        branch: {
          type: Type.STRING,
          description: "要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。"
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "listRepoCommits",
    description: "获取指定 GitHub 仓库的最近指定次数的提交记录。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Repository Commits Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        per_page: {
          type: Type.NUMBER,
          description: "每页返回的提交数量，默认为 20，最大 100。",
          default: 20,
          minimum: 1,
          maximum: 100
        },
        page: {
          type: Type.NUMBER,
          description: "页码，默认为 1。",
          default: 1,
          minimum: 1
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "listRepoReleases",
    description: "获取指定 GitHub 仓库的最近指定数量的发布版本。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Get GitHub Repository Releases Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        per_page: {
          type: Type.NUMBER,
          description: "每页返回的发布版本数量，默认为 10，最大 100。",
          default: 10,
          minimum: 1,
          maximum: 100
        },
        page: {
          type: Type.NUMBER,
          description: "页码，默认为 1。",
          default: 1,
          minimum: 1
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "listRepoBranches",
    description: "列出指定 GitHub 仓库的所有分支。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Repository Branches Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        }
      },
      required: ["owner", "repo"]
    }
  }
];
const functionForGet = [
  {
    name: "getFileContents",
    description: "根据提供的 GitHub 仓库文件路径列表，获取文件的原始内容。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Get Files Content Parameters",
      properties: {
        filePaths: {
          type: Type.ARRAY,
          description: '需要查询的文件路径列表，每次最少查询 4 个文件，例如：["MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md", "SagerNet/sing-box/refs/heads/dev-next/src/main.go"]',
          items: {
            type: Type.STRING,
            title: "File Path Item",
            description: '单个文件的完整路径，格式为 "owner/repo/refs/heads/branch/path/to/file.ext"'
          },
          minItems: "4"
        }
      },
      required: ["filePaths"]
    }
  },
  {
    name: "getCommitDetails",
    description: "获取指定 GitHub 仓库中某个提交的详细信息。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Get GitHub Commit Details Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        commit_sha: {
          type: Type.STRING,
          description: '要查询的提交的 SHA 值，例如 "2464ced48c504eb0dee616c6d474813621779afc"。'
        }
      },
      required: ["owner", "repo", "commit_sha"]
    }
  },
  {
    name: "getIssueComments",
    description: "获取指定 GitHub 仓库中某个 Issue 的所有评论。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Get GitHub Issue Comments Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。'
        },
        issue_number: {
          type: Type.NUMBER,
          description: "Issue 的编号，例如 3202。"
        }
      },
      required: ["owner", "repo", "issue_number"]
    }
  },
  {
    name: "getReleaseDetails",
    description: "获取指定 GitHub 仓库中某个发布版本的详细信息，包括所有资产。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Get GitHub Release Details Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "GUI-for-Cores"。'
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "GUI.for.SingBox"。'
        },
        release_id: {
          type: Type.NUMBER,
          description: "发布版本的 ID，例如 227541695。如果提供，将优先使用此 ID。",
          nullable: true
        },
        tag_name: {
          type: Type.STRING,
          description: '发布版本的标签名称，例如 "rolling-release-alpha"。如果未提供 release_id 或其查询失败，将尝试使用此标签名称。',
          nullable: true
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "getCurrentTime",
    description: "获取当前 UTC+8 时间并格式化字符串。",
    behavior: Behavior.BLOCKING
  }
];
const functionForGenerate = [
  {
    name: "generateImage",
    description: "使用此工具生成图片并用图片回复用户。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Generate Image Parameters",
      properties: {
        prompt: {
          type: Type.STRING,
          title: "Image Generation Prompt",
          description: `用于生成图片的文本提示。例如：
          A photorealistic [shot type] of [subject], [action or expression], set in
[environment]. The scene is illuminated by [lighting description], creating
a [mood] atmosphere. Captured with a [camera/lens details], emphasizing
[key textures and details]. The image should be in a [aspect ratio] format.

A [style] sticker of a [subject], featuring [key characteristics] and a
[color palette]. The design should have [line style] and [shading style].
The background must be transparent.

A single comic book panel in a [art style] style. In the foreground,
[character description and action]. In the background, [setting details].
The panel has a [dialogue/caption box] with the text "[Text]". The lighting
creates a [mood] mood. [Aspect ratio].

A high-resolution, studio-lit product photograph of a [product description]
on a [background surface/description]. The lighting is a [lighting setup,
e.g., three-point softbox setup] to [lighting purpose]. The camera angle is
a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp
focus on [key detail]. [Aspect ratio].`
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generateSpeech",
    description: "使用此工具生成语音并用语音回复用户。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "Generate Speech Parameters",
      properties: {
        prompt: {
          type: Type.STRING,
          title: "Speech Generation Prompt",
          description: `用于生成语音的文本提示，可以使用自然语言提示来控制语音的样式、语调、口音和语速。例如：
          Say in a helpless tone:
"拜托！我不会算命啊！"

Say in an spooky whisper:
"By the pricking of my thumbs...
Something wicked this way comes"

Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy:
Speaker1: So... what's on the agenda today?
Speaker2: You're never going to guess!`
        }
      },
      required: ["prompt"]
    }
  }
];
const geminiTools = [
  {
    functionDeclarations: [...functionForSearch, ...functionForList, ...functionForGet, ...functionForGenerate]
  }
];
class TelegramBot {
  botApiUrl;
  constructor() {
    this.botApiUrl = config.load().botApiUrl;
  }
  async sendRequest(httpMethod, apiMethod, body, isFormData = false) {
    const url = `${this.botApiUrl}/${apiMethod}`;
    let requestBody;
    let headers;
    if (isFormData) {
      if (!(body instanceof FormData)) {
        throw new TelegramError("When 'isFormData' is true, the body must be an instance of FormData.");
      }
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      headers = {
        "Content-Type": "application/json"
      };
    }
    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        headers,
        body: requestBody
      });
      const parsed = await response.json();
      if (!parsed.ok) {
        const desc = parsed.description;
        const errCode = `API_FAILED_${String(apiMethod).toUpperCase()}_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(`Telegram API error: ${desc}`, errCode)
        });
        throw new TelegramError(`Telegram API error: ${desc}`, errCode);
      }
      if (!response.ok) {
        const desc = `HTTP request failed with status: ${response.status}`;
        const errCode = `HTTP_ERROR_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(desc, errCode)
        });
        throw new TelegramError(desc, errCode);
      }
      return parsed.result;
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error;
      }
      Log.error(`Error sending request to ${apiMethod}`, {
        apiMethod,
        err: error,
        customError: new TelegramError(
          `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
          "NETWORK_ERROR"
        )
      });
      throw new TelegramError(
        `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
        "NETWORK_ERROR"
      );
    }
  }
  async sendMessage(chatId, text, options) {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode,
      link_preview_options: {
        is_disabled: true
      },
      reply_parameters: options?.replyToMessageId ? {
        message_id: options?.replyToMessageId,
        allow_sending_without_reply: true
      } : void 0,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : void 0
    };
    try {
      const result = await this.sendRequest("POST", "sendMessage", payload);
      Log.info("Telegram message sent successfully.", {
        chatId,
        messageId: result.message_id
      });
      return {
        ok: true,
        messageId: result.message_id
      };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error sending Telegram message", {
        err: errorMessage,
        chatId,
        text: text.substring(0, 20) + "..."
      });
      return {
        ok: false,
        error: errorMessage
      };
    }
  }
  async sendPhoto(chatId, photoBuffer, options) {
    const shorten = `<blockquote expandable>${escaper.html(shortenString(String(options?.caption)))}</blockquote>`;
    const payload = {
      chat_id: chatId,
      photo: photoBuffer,
      caption: shorten,
      parse_mode: "HTML",
      show_caption_above_media: true,
      reply_parameters: options?.replyToMessageId ? {
        message_id: options.replyToMessageId,
        allow_sending_without_reply: true
      } : void 0,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : void 0
    };
    const photoBlob = new Blob([payload.photo], { type: "image/png" });
    const formData = new FormData();
    formData.append("chat_id", payload.chat_id);
    formData.append("photo", photoBlob, `gemini_gen_img.png`);
    formData.append("caption", payload.caption);
    formData.append("parse_mode", payload.parse_mode);
    formData.append("show_caption_above_media", String(payload.show_caption_above_media));
    formData.append("reply_parameters", JSON.stringify(payload.reply_parameters));
    formData.append("reply_markup", payload.reply_markup);
    try {
      const result = await this.sendRequest("POST", "sendPhoto", formData, true);
      Log.info("Telegram photo message sent successfully.", {
        chatId,
        messageId: result.message_id
      });
      return {
        ok: true,
        messageId: result.message_id
      };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error sending Telegram photo message", {
        err: errorMessage,
        chatId
      });
      return {
        ok: false,
        error: errorMessage
      };
    }
  }
  async sendVoice(chatId, voiceBuffer, options) {
    const payload = {
      chat_id: chatId,
      voice: voiceBuffer,
      caption: options?.caption,
      reply_parameters: options?.replyToMessageId ? {
        message_id: options.replyToMessageId,
        allow_sending_without_reply: true
      } : void 0,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : void 0
    };
    const voiceBlob = new Blob([payload.voice], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("chat_id", payload.chat_id);
    formData.append("voice", voiceBlob, `gemini_gen_voice.mp3`);
    if (payload.caption) formData.append("caption", payload.caption);
    formData.append("reply_parameters", JSON.stringify(payload.reply_parameters));
    formData.append("reply_markup", payload.reply_markup);
    try {
      const result = await this.sendRequest("POST", "sendVoice", formData, true);
      Log.info("Telegram voice message sent successfully.", {
        chatId,
        messageId: result.message_id
      });
      return {
        ok: true,
        messageId: result.message_id
      };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error sending Telegram voice message", {
        err: errorMessage,
        chatId
      });
      return {
        ok: false,
        error: errorMessage
      };
    }
  }
  async editMessageText(chatId, messageId, text, options) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options?.parseMode ? { parse_mode: options.parseMode } : options?.entities ? { entities: JSON.stringify(options.entities) } : {},
      link_preview_options: {
        is_disabled: true
      },
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : void 0
    };
    try {
      const result = await this.sendRequest("POST", "editMessageText", payload);
      Log.info("Telegram message edited successfully.", {
        chatId,
        messageId: result.message_id
      });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error editing Telegram message", {
        err: errorMessage,
        chatId,
        messageId,
        text: text.substring(0, 20) + "..."
      });
      return { ok: false, error: errorMessage };
    }
  }
  async editMessageReplyMarkup(chatId, messageId, replyMarkup) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: JSON.stringify(replyMarkup)
    };
    try {
      const result = await this.sendRequest(
        "POST",
        "editMessageReplyMarkup",
        payload
      );
      Log.info("Telegram message reply markup edited successfully.", {
        chatId,
        messageId: result.message_id
      });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error editing Telegram message reply markup", {
        err: errorMessage,
        chatId,
        messageId
      });
      return { ok: false, error: errorMessage };
    }
  }
  async deleteMessage(chatId, messageId) {
    const payload = {
      chat_id: chatId,
      message_id: messageId
    };
    try {
      await this.sendRequest("POST", "deleteMessage", payload);
      Log.info("Telegram message deleted successfully.", { chatId, messageId });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error deleting Telegram message", {
        err: errorMessage,
        chatId,
        messageId
      });
      return { ok: false, error: errorMessage };
    }
  }
  async deleteMultipleMessages(chatId, messageIds) {
    const payload = {
      chat_id: chatId,
      message_ids: messageIds
    };
    try {
      await this.sendRequest("POST", "deleteMessages", payload);
      Log.info("Telegram message deleted successfully.", { chatId, messageIds });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error deleting Telegram message", {
        err: errorMessage,
        chatId,
        messageIds
      });
      return { ok: false, error: errorMessage };
    }
  }
  async setBotCommands(chatId, userId) {
    const payload = {
      commands: BotCommands.map((command) => ({
        command: command.name,
        description: command.description
      })),
      scope: {
        type: "chat_member",
        chat_id: chatId,
        user_id: userId
      }
    };
    try {
      await this.sendRequest("POST", "setMyCommands", payload);
      Log.info("Bot commands set successfully.", { chatId });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error setting bot commands", { err: errorMessage });
      return { ok: false, error: errorMessage };
    }
  }
  async getFile(fileId) {
    Log.info(`Getting file info for file_id: ${fileId}`);
    try {
      const result = await this.sendRequest("POST", "getFile", {
        file_id: fileId
      });
      return { ok: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error(`Error in getFile for file_id ${fileId}`, {
        err: errorMessage,
        fileId
      });
      return { ok: false, error: errorMessage };
    }
  }
  async getChatMember(chatId, userId) {
    const payload = {
      chat_id: chatId,
      user_id: userId
    };
    try {
      const result = await this.sendRequest("POST", "getChatMember", payload);
      return { ok: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error(`Error in getChatMember for chat_id ${chatId}, user_id ${userId}`, {
        err: errorMessage,
        chatId,
        userId
      });
      return { ok: false, error: errorMessage };
    }
  }
  async answerCallbackQuery(callbackQueryId, options) {
    const payload = {
      callback_query_id: callbackQueryId,
      text: options?.callbackText,
      show_alert: options?.showAlert
    };
    try {
      await this.sendRequest("POST", "answerCallbackQuery", payload);
      Log.info("Callback query answered successfully.", { callbackQueryId, callbackText: options?.callbackText });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error answering callback query", {
        err: errorMessage,
        callbackQueryId,
        callbackText: options?.callbackText
      });
      return { ok: false, error: errorMessage };
    }
  }
  async answerInlineQuery(inlineQueryId, inlineResult, options) {
    const payload = {
      inline_query_id: inlineQueryId,
      results: JSON.stringify(inlineResult),
      cache_time: options?.cacheTime,
      is_personal: options?.isPersonal,
      next_offset: options?.nextOffset,
      button: options?.button ? JSON.stringify(options.button) : void 0
    };
    try {
      await this.sendRequest("POST", "answerInlineQuery", payload);
      Log.info("Inline query answered successfully.", { inlineQueryId });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error answering inline query", {
        err: errorMessage,
        inlineQueryId
      });
      return { ok: false, error: errorMessage };
    }
  }
  async leaveChat(chatId) {
    const payload = {
      chat_id: chatId
    };
    try {
      await this.sendRequest("POST", "leaveChat", payload);
      Log.info("Bot left chat successfully.", { chatId });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error("Error leaving chat", {
        err: errorMessage,
        chatId
      });
      return { ok: false, error: errorMessage };
    }
  }
}
const REACTiON_ROW = [
  {
    text: "👍",
    callback_data: "reaction_like"
  },
  {
    text: "👎",
    callback_data: "reaction_dislike"
  }
];
const BASE_INLINE_KEYBOARD = [REACTiON_ROW];
const makeInlineKeyboard = (userId) => {
  return BASE_INLINE_KEYBOARD.map(
    (row) => row.map((button) => {
      if (button.callback_data?.includes("USER_ID")) {
        return {
          ...button,
          callback_data: button.callback_data.replace("USER_ID", String(userId))
        };
      } else {
        return button;
      }
    })
  );
};
class ChatContexts {
  chatContextId;
  maxContextLength;
  contextsExpirationSecond;
  constructor() {
    const { chatContextId, maxContextLength, contextsExpirationSecond } = config.load();
    this.chatContextId = chatContextId;
    this.maxContextLength = maxContextLength;
    this.contextsExpirationSecond = contextsExpirationSecond;
  }
  get = async (chatId, userId) => {
    const keyName = `contexts_${chatId}_${userId}`;
    const contexts2 = await kv.read(this.chatContextId, keyName, "json");
    return contexts2.success ? contexts2.data : [];
  };
  update = async (chatId, userId, contexts2) => {
    const keyName = `contexts_${chatId}_${userId}`;
    const historyContexts = await this.get(chatId, userId);
    const newContexts = [...historyContexts, ...contexts2];
    if (newContexts.length > this.maxContextLength) {
      newContexts.splice(0, newContexts.length - this.maxContextLength);
    }
    await kv.write(this.chatContextId, keyName, JSON.stringify(newContexts), {
      expiration_ttl: this.contextsExpirationSecond
    });
    Log.info(`${keyName}: Chat context updated success, current length ${newContexts.length}`);
  };
  clear = async (chatId, userId) => {
    const keyName = `contexts_${chatId}_${userId}`;
    await kv.write(this.chatContextId, keyName, JSON.stringify([]), {
      expiration_ttl: this.contextsExpirationSecond
    });
    Log.info(`${keyName}: Chat contexts cleared success.`);
  };
}
const contexts = new ChatContexts();
class AppError extends Error {
  code;
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    if (code) {
      this.code = code;
    }
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
class ScriptError extends AppError {
  constructor(message, code) {
    super(message, code || "SCRIPT_HANDLE_ERROR");
    this.message = message;
    this.code = code;
  }
}
class GeminiError extends AppError {
  hasToolThoughts;
  constructor(message, code, hasToolThoughts) {
    super(message, code || "GEMINI_API_ERROR");
    this.hasToolThoughts = hasToolThoughts;
  }
}
class KvNamespaceError extends AppError {
  constructor(message, code) {
    super(message, code || "KV_NAMESPACE_ERROR");
    this.message = message;
    this.code = code;
  }
}
class ConfigError extends AppError {
  constructor(message, code) {
    super(message, code || "CONFIG_ERROR");
  }
}
class TelegramError extends AppError {
  constructor(message, code) {
    super(message, code || "TELEGRAM_API_ERROR");
  }
}
const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
];
class GeminiApi {
  MAX_EMPTY_REPLY_RETRIES = 3;
  MAX_CLIENT_ERROR_RETRIES = 3;
  BASE_RETRY_DELAY_MS = 1e4;
  maxApiCallRounds;
  durableResourceId;
  systemPromptKeyName;
  modelName;
  modelTemperature;
  chatId;
  userId;
  userMessageId;
  thinkMessageId;
  baseConfig = {
    maxOutputTokens: 65536,
    thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
    tools: geminiTools,
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO
      }
    },
    safetySettings: GEMINI_SAFETY_SETTINGS
  };
  startProcessTime;
  NON_RETRY_ERRORS = ["An internal error has occurred", "Unsupported MIME type"];
  constructor(chatParams) {
    const { maxApiCallRounds, durableResourceId, systemPromptKeyName, modelName, modelTemperature } = config.load();
    this.maxApiCallRounds = maxApiCallRounds;
    this.durableResourceId = durableResourceId;
    this.systemPromptKeyName = systemPromptKeyName;
    this.modelName = modelName;
    this.modelTemperature = modelTemperature;
    this.chatId = chatParams.chatId;
    this.userId = chatParams.userId;
    this.userMessageId = chatParams.userMessageId;
    this.thinkMessageId = chatParams.thinkMessageId;
    this.startProcessTime = process.hrtime.bigint();
  }
  async _initializeApiCallContext(initialContents) {
    const systemPrompt = await kv.read(this.durableResourceId, this.systemPromptKeyName, "text");
    if (!systemPrompt.success) {
      throw new KvNamespaceError(`系统提示获取失败，${systemPrompt.error}`, "SYSTEM_PROMPT_NOT_FOUND");
    }
    Log.info(`系统提示 (systemPrompt):`, { systemPrompt: systemPrompt.data.slice(0, 200) });
    const baseConfig = {
      ...this.baseConfig,
      temperature: this.modelTemperature,
      systemInstruction: [{ text: systemPrompt.data }]
    };
    return {
      config: baseConfig,
      contents: [...initialContents],
      mergeThinkingTexts: "",
      metrics: {
        apiCallSuccessCount: 0,
        totalUsageToken: 0,
        usageToolCount: 0,
        emptyReplyRetryCount: 0,
        errorRetryCount: 0,
        totalRetryCount: 0,
        totalDurationSecond: 0,
        hasToolThoughts: false
      }
    };
  }
  async _callGeminiApi(context) {
    Log.info(
      `API 调用轮次: ${context.metrics.apiCallSuccessCount}, 无效回复重试: ${context.metrics.emptyReplyRetryCount}, 客户端错误重试: ${context.metrics.errorRetryCount}`
    );
    Log.info("当前发送的 contents:", {
      contents: simplifyGeminiApiContents(context.contents)
    });
    const newApiKey = await rotateGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey: newApiKey });
    Log.info("发送 Gemini API 请求...");
    const response = await ai.models.generateContent({
      model: this.modelName,
      config: context.config,
      contents: context.contents
    });
    context.metrics.totalUsageToken = response.usageMetadata?.totalTokenCount && !isNaN(response.usageMetadata.totalTokenCount) ? context.metrics.totalUsageToken + response.usageMetadata.totalTokenCount : context.metrics.totalUsageToken;
    Log.info(`Gemini API 响应: `, {
      response: simplifyGeminiApiResponse(response)
    });
    return response;
  }
  async _executeApiCallWithRetries(context) {
    for (let attempt = 0; attempt <= this.MAX_CLIENT_ERROR_RETRIES; attempt++) {
      try {
        const response = await this._callGeminiApi(context);
        return response;
      } catch (error) {
        const err = error instanceof ApiError ? error : new GeminiError(String(error), "API_CLIENT_ERROR", context.metrics.hasToolThoughts);
        const isNonRetry = this.NON_RETRY_ERRORS.some((msg) => err.message.includes(msg));
        if (isNonRetry) {
          throw new GeminiError(`Gemini API 客户端错误。

${err}`, "NON_RETRY_ERROR", context.metrics.hasToolThoughts);
        }
        Log.error(`Gemini API 客户端或网络错误 (尝试 ${attempt + 1}/${this.MAX_CLIENT_ERROR_RETRIES}):`, { err });
        if (attempt < this.MAX_CLIENT_ERROR_RETRIES) {
          const delay = Math.floor(this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.errorRetryCount++;
          const errorRetryText = `Gemini API 客户端错误，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${attempt + 1} 次重试...`;
          if (context.lastRetryMessageId) {
            await bot.editMessageText(this.chatId, context.lastRetryMessageId, errorRetryText);
          } else {
            const sendMsg = await bot.sendMessage(this.chatId, errorRetryText, { replyToMessageId: this.userMessageId });
            if (sendMsg.ok) {
              context.lastRetryMessageId = sendMsg.messageId;
            }
          }
          await sleep(delay);
          Log.info(`Gemini API 客户端错误，进行第 ${attempt + 1} 次重试...`);
        } else {
          if (context.lastRetryMessageId) {
            await bot.deleteMessage(this.chatId, context.lastRetryMessageId);
            context.lastRetryMessageId = void 0;
          }
          throw new GeminiError(
            `Gemini API 客户端错误，已达最大重试次数 (${this.MAX_CLIENT_ERROR_RETRIES})。

${err}`,
            "MAX_API_CLIENT_RETRIES_REACHED",
            context.metrics.hasToolThoughts
          );
        }
      }
    }
    throw new GeminiError("未知错误：客户端重试循环异常退出。", "UNKNOWN_RETRY_LOOP_EXIT", context.metrics.hasToolThoughts);
  }
  async _handleToolCalls(context, modelParts) {
    const functionCalls = modelParts.filter((part) => part.functionCall);
    const functionTexts = modelParts.filter((part) => part.text);
    if (functionTexts.length > 0) {
      const thoughtTexts = functionTexts.map((part) => part.text).join("").trim();
      if (thoughtTexts) {
        context.metrics.hasToolThoughts = true;
        context.mergeThinkingTexts += thoughtTexts;
        if (this.thinkMessageId !== void 0) {
          const displayThoughtText = `<b>Thoughts</b>:

<blockquote expandable>${escaper.html(shortenString(context.mergeThinkingTexts))}</blockquote>`;
          await bot.editMessageText(this.chatId, this.thinkMessageId, displayThoughtText, { parseMode: "HTML" });
        }
      }
    }
    Log.info(`检测到工具调用 (${functionCalls.length} 个)`);
    context.metrics.usageToolCount += functionCalls.length;
    const toolResponseParts = [];
    for (const functionCall of functionCalls) {
      const functionName = functionCall.functionCall?.name;
      const functionArgs = functionCall.functionCall?.args;
      const toolExecArgs = {
        chatId: this.chatId,
        userId: this.userId,
        userMessageId: this.userMessageId,
        ...functionArgs
      };
      if (typeof functionName === "string" && functionName in ToolExecutors) {
        try {
          const executor = ToolExecutors[functionName];
          const toolResult = await executor(toolExecArgs);
          toolResponseParts.push({
            functionResponse: {
              name: functionName,
              response: toolResult
            }
          });
          Log.info(`工具 ${functionName} 执行成功，结果已记录`);
        } catch (toolError) {
          const err = toolError instanceof GeminiError ? toolError : new GeminiError(String(toolError), "TOOL_EXECUTION_ERROR", context.metrics.hasToolThoughts);
          Log.error(`执行工具 ${functionName} 失败:`, { err });
          toolResponseParts.push({
            functionResponse: {
              name: functionName,
              response: {
                error: `错误：执行工具 ${functionName} 失败 - ${err.message || "未知错误"}`
              }
            }
          });
        }
      } else {
        const errorMsg = `模型调用了未实现的工具: ${functionName || "未知工具"}`;
        Log.warn(errorMsg);
        toolResponseParts.push({
          functionResponse: {
            name: functionName || "unknown_tool",
            response: {
              error: `错误：工具 ${functionName || "未知工具"} 未实现`
            }
          }
        });
      }
    }
    return toolResponseParts;
  }
  _buildSuccessResponse(context, textParts) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.startProcessTime) / 1e6;
    return {
      response: {
        role: "model",
        parts: textParts
      },
      totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
      apiCallSuccessCount: context.metrics.apiCallSuccessCount,
      totalUsageToken: context.metrics.totalUsageToken,
      usageToolCount: context.metrics.usageToolCount,
      totalDurationSecond: Number((duration / 1e3).toFixed(2)),
      hasToolThoughts: context.metrics.hasToolThoughts,
      mergeThinkingTexts: context.mergeThinkingTexts,
      emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
      errorRetryCount: context.metrics.errorRetryCount
    };
  }
  generateContent = async (initialContents) => {
    let context;
    try {
      context = await this._initializeApiCallContext(initialContents);
    } catch (error) {
      const err = error instanceof GeminiError ? error : new GeminiError(String(error), "INITIALIZATION_ERROR", false);
      Log.error("初始化 API 调用上下文失败:", { err });
      throw err;
    }
    let apiCallRoundCounter = 0;
    while (apiCallRoundCounter < this.maxApiCallRounds) {
      let response;
      try {
        response = await this._executeApiCallWithRetries(context);
      } catch (error) {
        throw error;
      }
      let candidate = response.candidates?.[0];
      let currentEmptyReplyAttempt = 0;
      while (!candidate || !candidate.content || !candidate.content.parts) {
        if (currentEmptyReplyAttempt < this.MAX_EMPTY_REPLY_RETRIES) {
          const delay = Math.floor(this.BASE_RETRY_DELAY_MS * Math.pow(2, currentEmptyReplyAttempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.emptyReplyRetryCount++;
          currentEmptyReplyAttempt++;
          const emptyReplyRetryText = `Gemini API 响应为空，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${currentEmptyReplyAttempt} 次重试...`;
          if (context.lastRetryMessageId) {
            await bot.editMessageText(this.chatId, context.lastRetryMessageId, emptyReplyRetryText);
          } else {
            const sendMsg = await bot.sendMessage(this.chatId, emptyReplyRetryText, { replyToMessageId: this.userMessageId });
            if (sendMsg.ok) {
              context.lastRetryMessageId = sendMsg.messageId;
            }
          }
          await sleep(delay);
          Log.warn(
            `Gemini API 返回结果不包含有效的 candidate 或 content，尝试重试 (无效回复重试 ${currentEmptyReplyAttempt}/${this.MAX_EMPTY_REPLY_RETRIES})。`,
            { response }
          );
          try {
            response = await this._executeApiCallWithRetries(context);
            candidate = response.candidates?.[0];
          } catch (error) {
            throw error;
          }
        } else {
          if (context.lastRetryMessageId) {
            await bot.deleteMessage(this.chatId, context.lastRetryMessageId);
            context.lastRetryMessageId = void 0;
          }
          const errorMsg2 = `Gemini API 未返回有效结果，已达最大无效回复重试次数 (${this.MAX_EMPTY_REPLY_RETRIES})，请稍后再重新提问。`;
          Log.error(errorMsg2);
          throw new GeminiError(errorMsg2, "MAX_EMPTY_REPLY_RETRIES_REACHED", context.metrics.hasToolThoughts);
        }
      }
      if (context.lastRetryMessageId) {
        await bot.deleteMessage(this.chatId, context.lastRetryMessageId);
        context.lastRetryMessageId = void 0;
      }
      apiCallRoundCounter++;
      currentEmptyReplyAttempt = 0;
      context.metrics.apiCallSuccessCount++;
      const parts = candidate.content.parts;
      const functionCalls = parts.filter((part) => part.functionCall);
      context.contents.push({
        role: "model",
        parts
      });
      if (functionCalls.length > 0) {
        const toolResponseParts = await this._handleToolCalls(context, parts);
        if (toolResponseParts.length > 0) {
          context.contents.push({
            role: "user",
            parts: toolResponseParts
          });
          Log.info("工具执行结果已添加到消息历史，准备下一轮 API 调用");
        } else {
          Log.warn("模型调用了工具，但没有工具执行结果被记录，可能出现逻辑问题。");
          return {
            response: { role: "model", parts: [{ text: "😥 抱歉，模型尝试使用工具但未能获取结果。" }] },
            ...context.metrics,
            mergeThinkingTexts: context.mergeThinkingTexts,
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount
          };
        }
      } else {
        const textParts = parts.filter((part) => part.text);
        if (textParts.length > 0) {
          Log.info(`Gemini API 请求成功，返回文本响应。`);
          return this._buildSuccessResponse(context, textParts);
        } else {
          Log.warn("Gemini API 返回非工具调用响应，但没有文本内容或其他可处理的 parts。", { response });
          const finishReason = candidate.finishReason;
          return {
            response: {
              role: "model",
              parts: [{ text: `😥 抱歉，未能获取有效的文本回复。Finish Reason: ${finishReason || "未知"}` }]
            },
            ...context.metrics,
            mergeThinkingTexts: context.mergeThinkingTexts,
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount
          };
        }
      }
    }
    const errorMsg = `达到最大 API 调用轮次 (${this.maxApiCallRounds})，未能获取最终回复。`;
    Log.error(errorMsg);
    throw new GeminiError(errorMsg, "MAX_CALL_ROUNDS_REACHED", context.metrics.hasToolThoughts);
  };
}
const rotateGeminiApiKey = async () => {
  const { durableResourceId, geminiApiKeysKeyName } = config.load();
  const apiKeys = await kv.read(durableResourceId, geminiApiKeysKeyName, "json");
  if (!apiKeys.success) {
    throw new KvNamespaceError(`无法获取 API 密钥，请检查配置，${apiKeys.error}`, "GEMINI_API_KEY_NOT_FOUND");
  }
  const [currentApiKey, currentApiKeyId] = apiKeys.data[0];
  const nextApiKeys = rotateArray(apiKeys.data);
  await kv.write(durableResourceId, geminiApiKeysKeyName, JSON.stringify(nextApiKeys));
  Log.info(`当前使用的 API 密钥: ${currentApiKeyId}`);
  return currentApiKey;
};
const simplifyGeminiApiContents = (contents) => {
  return contents.map((content) => ({
    ...content,
    parts: content.parts?.map((part) => {
      const newPart = { ...part };
      if (newPart.inlineData?.data) {
        newPart.inlineData = {
          ...newPart.inlineData,
          data: "BASE64_ENCODED_DATA"
        };
        return newPart;
      }
      if (newPart.thoughtSignature) {
        newPart.thoughtSignature = "THOUGHT_SIGNATURE";
        return newPart;
      }
      if (newPart.thought) {
        newPart.text = "THOUGHT_TEXT";
        return newPart;
      }
      if (newPart.functionResponse?.response?.success) {
        newPart.functionResponse = {
          ...newPart.functionResponse,
          response: {
            ...newPart.functionResponse.response,
            data: "FUNCTION_RESPONSE_DATA"
          }
        };
        return newPart;
      }
      return newPart;
    })
  }));
};
const simplifyGeminiApiResponse = (response) => {
  const simplifiedResponse = {
    ...response,
    candidates: response.candidates?.map((candidate) => ({
      ...candidate,
      content: {
        ...candidate.content,
        parts: candidate.content?.parts?.map((part) => {
          const newPart = { ...part };
          if (newPart.thought) {
            newPart.text = "THOUGHT_TEXT";
          }
          if (newPart.thoughtSignature) {
            newPart.thoughtSignature = "THOUGHT_SIGNATURE";
          }
          if (newPart.inlineData?.data) {
            newPart.inlineData = {
              ...newPart.inlineData,
              data: "BASE64_ENCODED_DATA"
            };
          }
          if (newPart.text && !newPart.thought) {
            newPart.text = "TEXT_CONTENT";
          }
          return newPart;
        })
      }
    }))
  };
  return simplifiedResponse;
};
let tslogInstance = null;
const mapLoggerLevelToNumber = (levelStr) => {
  switch (levelStr) {
    case "trace":
      return 0;
    case "debug":
      return 1;
    case "info":
      return 2;
    case "warn":
      return 3;
    case "error":
      return 4;
    case "fatal":
      return 5;
    default:
      return 2;
  }
};
const createTslogInstance = (minLevel) => {
  return new Logger({
    name: "App",
    minLevel,
    prettyLogTemplate: "{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}	{{logLevelName}}	",
    prettyLogTimeZone: "local",
    prettyErrorStackTemplate: "",
    prettyErrorLoggerNameDelimiter: "",
    prettyLogStyles: {
      logLevelName: {
        "*": ["bold", "black", "bgWhiteBright", "dim"],
        INFO: ["bold", "blue"],
        WARN: ["bold", "yellow"],
        ERROR: ["bold", "red"],
        FATAL: ["bold", "redBright"]
      }
    }
  });
};
const initLogger = (opts) => {
  const minLevel = typeof opts?.minLevel === "number" ? opts.minLevel : opts?.loggerLevel ? mapLoggerLevelToNumber(opts.loggerLevel) : mapLoggerLevelToNumber("info");
  tslogInstance = createTslogInstance(minLevel);
};
const serializeError = (err) => ({
  name: err.name,
  message: err.message
});
const Log = {
  info: (message, data) => {
    const payload = { message, ...data || {} };
    if (tslogInstance) {
      tslogInstance.info(JSON.stringify(payload, null, 2));
    } else {
      console.log("INFO", JSON.stringify(payload, null, 2));
    }
  },
  warn: (message, data) => {
    const payload = { message, ...data || {} };
    if (tslogInstance) {
      tslogInstance.warn(JSON.stringify(payload, null, 2));
    } else {
      console.warn("WARN", JSON.stringify(payload, null, 2));
    }
  },
  error: (message, data) => {
    const payload = { message, ...data || {} };
    if (data?.err instanceof Error) {
      payload.error = serializeError(data.err);
      delete payload.err;
    }
    if (tslogInstance) {
      tslogInstance.error(JSON.stringify(payload, null, 2));
    } else {
      console.error("ERROR", JSON.stringify(payload, null, 2));
    }
  },
  fatal: (message, data) => {
    const payload = { message, ...data || {} };
    if (data?.err instanceof Error) {
      payload.error = serializeError(data.err);
      delete payload.err;
    }
    if (tslogInstance) {
      if (typeof tslogInstance.fatal === "function") {
        tslogInstance.fatal(JSON.stringify(payload, null, 2));
      } else {
        tslogInstance.error(JSON.stringify(payload, null, 2));
      }
    } else {
      console.error("FATAL", JSON.stringify(payload, null, 2));
    }
  }
};
const loggerAdapter = {
  write: (pinoLogJson) => {
    try {
      const { level, msg, ...rest } = JSON.parse(pinoLogJson);
      delete rest.time;
      delete rest.pid;
      delete rest.hostname;
      switch (true) {
        case level >= 60:
          Log.fatal(msg, rest);
          break;
        case level >= 50:
          Log.error(msg, rest);
          break;
        case level >= 40:
          Log.warn(msg, rest);
          break;
        case level >= 30:
          Log.info(msg, rest);
          break;
        default:
          Log.info(msg, rest);
          break;
      }
    } catch (e) {
      Log.error("Failed to parse pino log JSON, logging as info.", {
        originalLog: pinoLogJson.trim(),
        err: e
      });
    }
  }
};
const ToolExecutors = {
  searchFilesInRepo: async (args) => {
    Log.info("执行工具: searchFilesInRepo, 参数:", { args });
    const { keyword, owner, repo, branch = "main" } = args;
    const urlPath = `search/code`;
    const queryParams = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}+in:file`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const foundFiles = result.data.items.map((item) => `${item.repository.full_name}/refs/heads/${branch}/${item.path}`);
      Log.info(`searchFilesInRepo 工具执行完毕，找到 ${foundFiles.length} 个文件。`);
      return { success: true, data: { foundFiles } };
    } else {
      return result;
    }
  },
  searchCommitsInRepo: async (args) => {
    Log.info("执行工具: searchCommitsInRepo, 参数:", { args });
    const { keyword, owner, repo } = args;
    const urlPath = `search/commits`;
    const queryParams = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const commits = result.data.items.map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        author: item.commit.author.name,
        date: item.commit.author.date,
        url: item.html_url,
        repository_full_name: item.repository?.full_name
      }));
      Log.info(`searchCommitsInRepo 工具执行完毕，找到 ${commits.length} 条提交记录，总数 ${result.data.total_count}。`);
      return { success: true, data: { commits, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },
  searchIssuesInRepo: async (args) => {
    Log.info("执行工具: searchIssuesInRepo, 参数:", { args });
    const { keyword, owner, repo, state = "open" } = args;
    const urlPath = `search/issues`;
    const queryParams = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}+state:${state}+is:issue`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const issues = result.data.items.map((item) => ({
        id: item.id,
        number: item.number,
        html_url: item.html_url,
        title: item.title,
        state: item.state,
        created_at: item.created_at,
        updated_at: item.updated_at,
        comments: item.comments,
        author_login: item.user?.login || "未知",
        labels: item.labels?.map((label) => label.name) || [],
        body: item.body
      }));
      Log.info(`searchIssuesInRepo 工具执行完毕，找到 ${issues.length} 个 Issue，总数 ${result.data.total_count}。`);
      return { success: true, data: { issues, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },
  searchReposInGlobal: async (args) => {
    Log.info("执行工具: searchReposInGlobal, 参数:", { args });
    const { keyword, qualifier } = args;
    const urlPath = `search/repositories`;
    const queryParams = `q=${encodeURIComponent(keyword)}+in:${qualifier}`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const repositories = result.data.items.map((item) => ({
        id: item.id,
        name: item.name,
        full_name: item.full_name,
        private: item.private,
        owner_login: item.owner.login,
        html_url: item.html_url,
        description: item.description,
        fork: item.fork,
        stargazers_count: item.stargazers_count,
        language: item.language,
        forks_count: item.forks_count,
        open_issues_count: item.open_issues_count,
        default_branch: item.default_branch,
        updated_at: item.updated_at
      }));
      Log.info(`searchReposInGlobal 工具执行完毕，找到 ${repositories.length} 个仓库，总数 ${result.data.total_count}。`);
      return { success: true, data: { repositories, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },
  searchIssuesInGlobal: async (args) => {
    Log.info("执行工具: searchIssuesInGlobal, 参数:", { args });
    const { keyword, state = "open" } = args;
    const urlPath = `search/issues`;
    const queryParams = `q=${encodeURIComponent(keyword)}+state:${state}+is:issue`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const issues = result.data.items.map((item) => ({
        id: item.id,
        number: item.number,
        html_url: item.html_url,
        repository_url: item.repository_url,
        title: item.title,
        state: item.state,
        created_at: item.created_at,
        updated_at: item.updated_at,
        author_login: item.user?.login || "未知",
        body: item.body
      }));
      Log.info(`searchIssuesInGlobal 工具执行完毕，找到 ${issues.length} 个 Issue，总数 ${result.data.total_count}。`);
      return { success: true, data: { issues, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },
  listRepoTree: async (args) => {
    Log.info("执行工具: listRepoTree, 参数:", { args });
    const { owner, repo, branch = "main" } = args;
    const branchUrlPath = `repos/${owner}/${repo}/branches/${branch}`;
    const branchResult = await makeGitHubApiRequest({
      method: "GET",
      urlPath: branchUrlPath
    });
    if (!branchResult.success) {
      return branchResult;
    }
    const treeSha = branchResult.data.commit.sha;
    Log.info(`获取到分支 ${branch} 的 tree SHA: ${treeSha}`);
    const treeUrlPath = `repos/${owner}/${repo}/git/trees/${treeSha}`;
    const queryParams = `recursive=1`;
    const treeResult = await makeGitHubApiRequest({
      method: "GET",
      urlPath: treeUrlPath,
      queryParams
    });
    if (treeResult.success) {
      const fileList = treeResult.data.tree.filter((item) => item.path).map((item) => ({
        name: item.path.split("/").pop() || "",
        path: `${owner}/${repo}/refs/heads/${branch}/${item.path}`,
        type: item.type === "blob" ? "file" : "tree"
      }));
      Log.info(`listRepoTree 工具执行完毕，找到 ${fileList.length} 个文件/目录。`);
      return { success: true, data: { fileList } };
    } else {
      return treeResult;
    }
  },
  listDirContents: async (args) => {
    Log.info("执行工具: listDirContents, 参数:", { args });
    const { owner, repo, path: path2 = "", branch = "main" } = args;
    const cleanedPath = path2.startsWith("/") ? path2.substring(1) : path2;
    const urlPath = `repos/${owner}/${repo}/contents/${cleanedPath}`;
    const queryParams = `ref=${branch}`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const fileList = result.data.map((item) => ({
        name: item.name,
        path: `${owner}/${repo}/refs/heads/${branch}/${item.path}`,
        type: item.type
      }));
      Log.info(`listDirContents 工具执行完毕，找到 ${fileList.length} 个文件/目录。`);
      return { success: true, data: { fileList } };
    } else {
      return result;
    }
  },
  listRepoCommits: async (args) => {
    Log.info("执行工具: listRepoCommits, 参数:", { args });
    const { owner, repo, per_page = 20, page = 1 } = args;
    const urlPath = `repos/${owner}/${repo}/commits`;
    const queryParams = `per_page=${per_page}&page=${page}`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const commits = result.data.map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        author: item.commit.author.name,
        date: item.commit.author.date,
        url: item.html_url
      }));
      Log.info(`listRepoCommits 工具执行完毕，找到 ${commits.length} 条提交记录。`);
      return { success: true, data: { commits } };
    } else {
      return result;
    }
  },
  listRepoReleases: async (args) => {
    Log.info("执行工具: listRepoReleases, 参数:", { args });
    const { owner, repo, per_page = 10, page = 1 } = args;
    const urlPath = `repos/${owner}/${repo}/releases`;
    const queryParams = `per_page=${per_page}&page=${page}`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath,
      queryParams
    });
    if (result.success) {
      const releases = result.data.map((item) => ({
        id: item.id,
        tag_name: item.tag_name,
        name: item.name,
        body: item.body,
        author_login: item.author.login,
        author_type: item.author.type,
        published_at: item.published_at,
        html_url: item.html_url,
        prerelease: item.prerelease,
        draft: item.draft
      }));
      Log.info(`listRepoReleases 工具执行完毕，找到 ${releases.length} 个发布版本。`);
      return { success: true, data: { releases } };
    } else {
      return result;
    }
  },
  listRepoBranches: async (args) => {
    Log.info("执行工具: listRepoBranches, 参数:", { args });
    const { owner, repo } = args;
    const urlPath = `repos/${owner}/${repo}/branches`;
    const result = await makeGitHubApiRequest({ method: "GET", urlPath });
    if (result.success) {
      const branches = result.data.map((item) => ({
        name: item.name,
        commit_sha: item.commit.sha,
        commit_url: item.commit.url,
        protected: item.protected
      }));
      Log.info(`listRepoBranches 工具执行完毕，找到 ${branches.length} 个分支。`);
      return { success: true, data: { branches } };
    } else {
      return result;
    }
  },
  getFileContents: async (args) => {
    Log.info("执行工具: getFileContents, 参数:", { args });
    const processedFiles = [];
    for (const file of args.filePaths) {
      if (typeof file === "string") {
        const fileNameParts = file.split("/");
        const repoName = fileNameParts[1] ?? "未知仓库";
        const branchName = fileNameParts[4] ?? "未知分支";
        const fileName = fileNameParts.slice(5).join("_").replace(/\.[^/.]+$/, "");
        const fileIdentifier = `${repoName}_${branchName}_${fileName}`;
        const result = await makeRawFileRequest(file);
        if (result.success) {
          const assetContent = result.data;
          const MAX_CHUNK_LENGTH = 2048;
          const chunkedContent = [];
          for (let i = 0; i < assetContent.length; i += MAX_CHUNK_LENGTH) {
            chunkedContent.push({
              text: assetContent.slice(i, i + MAX_CHUNK_LENGTH)
            });
          }
          processedFiles.push({
            path: file,
            content: chunkedContent,
            identifier: fileIdentifier
          });
        } else {
          processedFiles.push({
            path: file,
            error: result.error,
            identifier: fileIdentifier
          });
        }
      } else {
        processedFiles.push({
          path: String(file),
          error: "文件路径类型无效，期望字符串。",
          identifier: "invalid_file_path"
        });
      }
    }
    Log.info(`getFileContents 工具执行完毕，结果数量: ${processedFiles.length}`);
    return { success: true, data: { files: processedFiles } };
  },
  getCommitDetails: async (args) => {
    Log.info("执行工具: getCommitDetails, 参数:", { args });
    const { owner, repo, commit_sha } = args;
    const urlPath = `repos/${owner}/${repo}/commits/${commit_sha}`;
    const result = await makeGitHubApiRequest({ method: "GET", urlPath });
    if (result.success) {
      const data = result.data;
      const commitDetails = {
        sha: data.sha,
        author: {
          name: data.commit.author.name,
          email: data.commit.author.email,
          date: data.commit.author.date
        },
        message: data.commit.message,
        html_url: data.html_url,
        stats: data.stats,
        files: data.files.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch
        }))
      };
      Log.info(`getCommitDetails 工具执行完毕，获取到提交 ${commit_sha} 的关键详细信息。`);
      return { success: true, data: { commitDetails } };
    } else {
      return result;
    }
  },
  getIssueComments: async (args) => {
    Log.info("执行工具: getIssueComments, 参数:", { args });
    const { owner, repo, issue_number } = args;
    const urlPath = `repos/${owner}/${repo}/issues/${issue_number}/comments`;
    const result = await makeGitHubApiRequest({
      method: "GET",
      urlPath
    });
    if (result.success) {
      const comments = result.data.map((item) => ({
        id: item.id,
        html_url: item.html_url,
        user_login: item.user?.login || "未知",
        created_at: item.created_at,
        updated_at: item.updated_at,
        body: item.body
      }));
      Log.info(`getIssueComments 工具执行完毕，找到 ${comments.length} 条评论。`);
      return { success: true, data: { comments } };
    } else {
      return result;
    }
  },
  getReleaseDetails: async (args) => {
    Log.info("执行工具: getReleaseDetails, 参数:", { args });
    const { owner, repo, release_id, tag_name } = args;
    const urlPath = `repos/${owner}/${repo}/releases/${release_id ? release_id : `tags/${tag_name}`}`;
    const releaseResult = await makeGitHubApiRequest({
      method: "GET",
      urlPath
    });
    if (!releaseResult.success) {
      return releaseResult;
    }
    const releaseData = releaseResult.data;
    const releaseDetails = {
      id: releaseData.id,
      tag_name: releaseData.tag_name,
      name: releaseData.name,
      body: releaseData.body,
      author_login: releaseData.author?.login || "未知",
      published_at: releaseData.published_at,
      html_url: releaseData.html_url,
      prerelease: releaseData.prerelease,
      draft: releaseData.draft,
      assets: releaseData.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        browser_download_url: asset.browser_download_url,
        size: asset.size,
        download_count: asset.download_count,
        created_at: asset.created_at,
        updated_at: asset.updated_at
      }))
    };
    Log.info(`getReleaseDetails 工具执行完毕，获取到发布版本 ${release_id || tag_name} 的详细信息。`);
    return { success: true, data: { releaseDetails } };
  },
  getCurrentTime: () => {
    Log.info("执行工具: getCurrentTime");
    const currentTime = formatTime(Date.now());
    Log.info("getCurrentTime 工具执行完毕，当前时间:", { currentTime });
    return { success: true, data: { currentTime } };
  },
  generateImage: async (args) => {
    Log.info("执行工具: sendPhotoMessage，参数:", { args });
    const { chatId, userId, userMessageId, prompt } = args;
    const modelName = "gemini-2.0-flash-preview-image-generation";
    const modelConfig = {
      responseModalities: ["IMAGE", "TEXT"]
    };
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];
    try {
      const response = await callCustomModels(modelName, modelConfig, contents);
      const resTexts = response.parts?.map((part) => part.text).join("") || "";
      const imageData = response.parts?.find((part) => part.inlineData && part.inlineData.data);
      const base64Data = imageData?.inlineData?.data;
      const imageBuffer = Buffer.from(base64Data, "base64");
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(userId)
      };
      const result = await bot.sendPhoto(chatId, imageBuffer, { caption: resTexts, replyToMessageId: userMessageId, replyMarkup });
      if (!result.ok) {
        return { success: false, error: `Error replying image message, ${result.error}` };
      }
      scheduleDeletion(chatId, result.messageId, 24 * 60 * 60 * 1e3);
      return { success: true, data: "Image generate and reply message successfully." };
    } catch (error) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
  generateSpeech: async (args) => {
    Log.info("执行工具: sendVoiceMessage，参数:", { args });
    const { chatId, userId, userMessageId, prompt } = args;
    const modelName = "gemini-2.5-flash-preview-tts";
    const modelConfig = {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } }
    };
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];
    try {
      const response = await callCustomModels(modelName, modelConfig, contents);
      const audioData = response.parts?.find((part) => part.inlineData && part.inlineData.data);
      const base64Data = audioData?.inlineData?.data;
      const pcmAudioBuffer = Buffer.from(base64Data, "base64");
      Log.info("开始将 PCM 音频数据转换为 MP3...");
      const mp3AudioBuffer = await convertPcmToMp3(pcmAudioBuffer);
      Log.info("MP3 音频数据转换完成。");
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(userId)
      };
      const result = await bot.sendVoice(chatId, mp3AudioBuffer, { replyToMessageId: userMessageId, replyMarkup });
      if (!result.ok) {
        return { success: false, error: `Error replying speech message, ${result.error}` };
      }
      scheduleDeletion(chatId, result.messageId, 24 * 60 * 60 * 1e3);
      return { success: true, data: "Speech generate and reply message successfully." };
    } catch (error) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }
};
const callCustomModels = async (model, modelConfig, contents) => {
  const newApiKey = await rotateGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey: newApiKey });
  const config2 = {
    ...modelConfig,
    safetySettings: GEMINI_SAFETY_SETTINGS
  };
  Log.info("发送 Gemini API 请求...");
  Log.info("当前发送的 contents:", { contents: simplifyGeminiApiContents(contents) });
  const response = await ai.models.generateContent({ model, contents, config: config2 });
  Log.info(`Gemini API 响应: `, {
    response: simplifyGeminiApiResponse(response)
  });
  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new GeminiError("Gemini API 返回结果不包含有效的内容", "INVALID_RESPONSE");
  }
  return candidate.content;
};
const bot = new TelegramBot();
const SUPPORTED_MIME_TYPE = {
  APPLICATION_TYPES: ["pdf"],
  IMAGE_TYPES: ["png", "jpeg", "webp", "heic", "heif"],
  VIDEO_TYPES: ["mp4", "mpeg", "mov", "avi", "x-flv", "mpg", "webm", "wmv", "3gpp"],
  AUDIO_TYPES: ["wav", "mp3", "aiff", "aac", "ogg", "flac"]
};
const FILE_EXTENSION_MIME_MAP = {
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  vue: "text/html",
  css: "text/css",
  less: "text/css",
  csv: "text/csv",
  md: "text/markdown",
  mdx: "text/markdown",
  js: "text/javascript",
  ts: "text/javascript",
  jsx: "text/javascript",
  tsx: "text/javascript",
  json: "application/json",
  jsonc: "application/json",
  json5: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  sh: "application/x-shellscript",
  py: "text/plain",
  java: "text/plain",
  c: "text/plain",
  cpp: "text/plain",
  cs: "text/plain",
  go: "text/plain",
  php: "text/plain",
  sql: "text/plain",
  xml: "text/xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mov: "video/mov",
  avi: "video/avi",
  flv: "video/x-flv",
  "x-flv": "video/x-flv",
  mpg: "video/mpg",
  webm: "video/webm",
  wmv: "video/wmv",
  "3gpp": "video/3gpp",
  wav: "audio/wav",
  mp3: "audio/mp3",
  aiff: "audio/aiff",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac"
};
const getTelegramFileUrl = async (fileId, botToken) => {
  const result = await bot.getFile(fileId);
  if (!result.ok || !result.data.file_path) {
    throw new AppError(`获取文件路径失败: ${fileId}`, "TELEGRAM_API_ERROR");
  }
  return `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
};
const downloadFileAsArrayBuffer = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(`文件下载失败: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileSizeInBytes = arrayBuffer.byteLength;
    const displaySize = fileSizeInBytes >= 1024 * 1024 ? `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB` : `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
    Log.info(`文件下载成功. 大小: ${displaySize}`);
    return arrayBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Log.error(`从 ${url} 下载文件时出错:`);
    throw new AppError(errorMessage, "FILE_DOWNLOAD_ERROR");
  }
};
const downloadAndEncodeFile = async (fileId, botToken, mimeType) => {
  const fileUrl = await getTelegramFileUrl(fileId, botToken);
  const arrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
  const base64Data = Buffer.from(arrayBuffer).toString("base64");
  return { data: base64Data, mimeType };
};
const isBinaryApplicationMime = (mime) => {
  if (!mime || typeof mime !== "string") return true;
  const clean = mime.split(";")[0].trim().toLowerCase();
  if (!clean.startsWith("application/")) {
    return true;
  }
  const subtype = clean.slice("application/".length);
  const textSet = /* @__PURE__ */ new Set([
    "json",
    "ld+json",
    "activity+json",
    "problem+json",
    "json-seq",
    "javascript",
    "ecmascript",
    "xml",
    "xhtml+xml",
    "rss+xml",
    "atom+xml",
    "x-www-form-urlencoded",
    "graphql",
    "graphql+json",
    "hal+json",
    "xml-dtd"
  ]);
  const binarySet = /* @__PURE__ */ new Set([
    "octet-stream",
    "pdf",
    "zip",
    "x-7z-compressed",
    "x-rar-compressed",
    "x-tar",
    "gzip",
    "x-gzip",
    "x-bzip2",
    "x-xz",
    "x-msdownload",
    "x-shockwave-flash",
    "wasm",
    "x-iso9660-image",
    "postscript"
  ]);
  if (textSet.has(subtype)) return false;
  if (binarySet.has(subtype)) return true;
  if (subtype.includes("+")) {
    const suffix = subtype.split("+").pop();
    if (suffix && ["json", "xml", "javascript", "ecmascript", "xhtml+xml"].includes(suffix)) return false;
    if (suffix && ["zip", "gzip", "tar", "pdf", "wasm", "octet-stream"].includes(suffix)) return true;
  }
  if (subtype.startsWith("vnd.")) return true;
  return true;
};
class FileHandler {
  message;
  botToken;
  document;
  photo;
  video;
  audio;
  voice;
  constructor(message) {
    const { document, photo, video, audio, voice } = message;
    this.document = document;
    this.photo = photo?.[photo.length - 1];
    this.video = video;
    this.audio = audio;
    this.voice = voice;
    this.message = message;
    this.botToken = config.load().botToken;
    Log.info("Handling file", { chatId: this.message.chat.id, messageId: this.message.message_id });
  }
  async handleImage(photo) {
    const { file_id } = photo;
    return downloadAndEncodeFile(file_id, this.botToken, "image/jpeg");
  }
  async handleVideo(video) {
    const { file_id, mime_type } = video;
    const finalMimeType = mime_type && SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(mime_type.split("/")[1]) ? mime_type : "video/mp4";
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }
  async handleAudio(audioSource, defaultMimeType) {
    const { file_id, mime_type } = audioSource;
    const finalMimeType = mime_type && SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(mime_type.split("/")[1]) ? mime_type : defaultMimeType;
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }
  async handleDocument(document) {
    const { file_id, mime_type, file_name } = document;
    let determinedMimeType = mime_type;
    if (file_name) {
      const ext = path.extname(file_name).toLowerCase().replace(".", "");
      if (ext && FILE_EXTENSION_MIME_MAP[ext]) {
        determinedMimeType = FILE_EXTENSION_MIME_MAP[ext];
        Log.info(`通过文件后缀 "${ext}" 确定 MIME 类型为 "${determinedMimeType}"`);
      }
    }
    if (!determinedMimeType) {
      throw new AppError(`无法确定文件类型: ${file_name || "未知文件名"}`, "FILE_TYPE_NOT_SUPPORTED");
    }
    if (determinedMimeType === "image/gif") {
      Log.info("检测到 GIF 文件，将作为 video/mp4 类型处理");
      return downloadAndEncodeFile(file_id, this.botToken, "video/mp4");
    }
    const [mainType, subType] = determinedMimeType.split("/");
    let finalMimeType;
    switch (mainType) {
      case "text":
        finalMimeType = determinedMimeType;
        break;
      case "application":
        if (SUPPORTED_MIME_TYPE.APPLICATION_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else if (!isBinaryApplicationMime(determinedMimeType)) {
          Log.info(`将无法直接处理的 application 类型 "${determinedMimeType}" 作为 text/plain 处理`);
          finalMimeType = "text/plain";
        }
        break;
      case "image":
        if (SUPPORTED_MIME_TYPE.IMAGE_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = "image/jpeg";
        }
        break;
      case "video":
        if (SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = "video/mp4";
        }
        break;
      case "audio":
        if (SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = "audio/mp3";
        }
        break;
    }
    if (!finalMimeType) {
      throw new AppError(`不支持的文件类型: ${determinedMimeType || "未知文件类型"}`, "FILE_TYPE_NOT_SUPPORTED");
    }
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }
  async process() {
    if (this.photo) return this.handleImage(this.photo);
    if (this.video) return this.handleVideo(this.video);
    if (this.audio) return this.handleAudio(this.audio, "audio/mp3");
    if (this.voice) return this.handleAudio(this.voice, "audio/ogg");
    if (this.document) return this.handleDocument(this.document);
    return void 0;
  }
}
const isContainsFile = (message) => {
  return message ? message.document || message.photo || message.video || message.audio || message.voice ? true : false : false;
};
const extractMessageParts = async (message, botName) => {
  const parts = [];
  let messageText = message.text || message.caption || "";
  messageText = messageText.replace(new RegExp(`(@${botName})`, "gi"), "").replace(/(:ask)/gi, "").trim();
  if (messageText.includes("🤖 模型：") || messageText.includes("✨ 本次任务")) {
    messageText = messageText.replace(/^🤖 模型：.*?\n+/g, "").replace(/✨ API 调用[\s\S]*$/m, "").trim();
  }
  if (isContainsFile(message)) {
    const fileData = await handleFile(message);
    if (fileData) {
      parts.push({ inlineData: fileData });
    }
    if (!messageText) {
      if (message.document) messageText = "分析这个文件";
      else if (message.photo) messageText = "分析这张图片";
      else if (message.video) messageText = "分析这个视频";
    }
  }
  if (messageText) {
    parts.push({ text: messageText });
  }
  return parts;
};
class MentionHandler {
  modelName;
  botName;
  adminId;
  message;
  chatId;
  userId;
  userMessageId;
  replyToMessage;
  quote;
  constructor(message) {
    const { modelName, botName, adminId } = config.load();
    const { message_id, chat, from, reply_to_message, quote } = message;
    this.modelName = modelName;
    this.botName = botName;
    this.adminId = adminId;
    this.message = message;
    this.chatId = chat.id;
    this.userId = from?.id;
    this.userMessageId = message_id;
    this.replyToMessage = reply_to_message;
    this.quote = quote;
    Log.info("Handling mention message.", {
      chatId: this.chatId,
      messageId: this.userMessageId
    });
  }
  async handleRateLimiting() {
    const checkResult = await rateLimiterCheck(this.chatId);
    if (!checkResult.canProceed && this.userId !== this.adminId) {
      Log.info(`Rate limit exceeded for chat ${this.chatId}. Retry after ${checkResult.retryAfterSeconds} seconds.`);
      const rateLimitResult = await bot.sendMessage(this.chatId, `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`, {
        replyToMessageId: this.userMessageId
      });
      if (rateLimitResult.ok) {
        scheduleDeletion(this.chatId, rateLimitResult.messageId, checkResult.retryAfterSeconds * 1e3);
      }
      return true;
    }
    return false;
  }
  async sendFileUploadMessage() {
    if (isContainsFile(this.message) || isContainsFile(this.replyToMessage)) {
      const uploadingResult = await bot.sendMessage(this.chatId, "📄 File uploading...", {
        replyToMessageId: this.userMessageId
      });
      return uploadingResult.ok ? uploadingResult.messageId : null;
    }
    return null;
  }
  async buildCompleteContents() {
    const historyChatContents = await contexts.get(this.chatId, this.userId);
    const completeContents = [...historyChatContents];
    const currentMessageCopy = { ...this.message };
    if (this.quote?.text) {
      const quotedContents = `> ${this.quote.text}

${this.message.text || this.message.caption || ""}`;
      currentMessageCopy.text = quotedContents;
    } else {
      if (this.replyToMessage) {
        const replyToParts = await extractMessageParts(this.replyToMessage, this.botName);
        if (replyToParts.length > 0) {
          const replyRole = this.replyToMessage.from?.username === this.botName ? "model" : "user";
          completeContents.push({
            role: replyRole,
            parts: replyToParts
          });
        }
      }
    }
    const currentParts = await extractMessageParts(currentMessageCopy, this.botName);
    if (currentParts.length > 0) {
      completeContents.push({
        role: "user",
        parts: currentParts
      });
    }
    return completeContents;
  }
  async sendThinkingMessage() {
    const thinkingResult = await bot.sendMessage(this.chatId, "✨ Thinking...", {
      replyToMessageId: this.userMessageId
    });
    if (!thinkingResult.ok) {
      Log.error("Failed to send thinking message.");
      throw new TelegramError("Failed to send thinking message.");
    }
    return thinkingResult.messageId;
  }
  async processGeminiResponse(geminiResponse, thinkMessageId, completeContentsBeforeCall) {
    let hasDisplayedThoughts = false;
    const {
      response,
      apiCallSuccessCount,
      totalRetryCount,
      totalUsageToken,
      usageToolCount,
      totalDurationSecond,
      hasToolThoughts,
      mergeThinkingTexts,
      emptyReplyRetryCount,
      errorRetryCount
    } = geminiResponse;
    const resThoughtParts = response.parts?.filter((part) => part.text && part.thought);
    const resThoughtTexts = resThoughtParts?.map((part) => part.text).join("").trim();
    if (resThoughtTexts) {
      hasDisplayedThoughts = true;
      const finalThinkingText = mergeThinkingTexts + resThoughtTexts;
      const displayThoughtText = `<b>Thoughts</b>:

<blockquote expandable>${escaper.html(shortenString(finalThinkingText))}</blockquote>`;
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(this.userId)
      };
      await bot.editMessageText(this.chatId, thinkMessageId, displayThoughtText, { parseMode: "HTML", replyMarkup });
    }
    if (!hasToolThoughts && !hasDisplayedThoughts) {
      await bot.deleteMessage(this.chatId, thinkMessageId);
    } else {
      scheduleDeletion(this.chatId, thinkMessageId, 60 * 6e4);
    }
    const resTextParts = response.parts?.filter((part) => part.text && !part.thought);
    const resTexts = resTextParts?.map((part) => part.text).join("").trim() || "";
    if (!resTexts) {
      const replyText = "Gemini API 未返回有效文本回复：模型可能只生成了工具调用或思考内容。";
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(this.userId)
      };
      const replyResult = await bot.sendMessage(this.chatId, replyText, {
        replyToMessageId: this.userMessageId,
        replyMarkup
      });
      if (replyResult.ok) {
        scheduleDeletion(this.chatId, replyResult.messageId, 3 * 60 * 1e3);
      }
      return;
    }
    const fullText = `🤖 模型：\`${this.modelName}\`

${resTexts}

✨ API 调用 ${apiCallSuccessCount} 次，重试 ${totalRetryCount} 次 (无效 ${emptyReplyRetryCount}, 错误 ${errorRetryCount})。使用工具 ${usageToolCount} 次，耗时 ${totalDurationSecond} 秒，消耗 ${totalUsageToken} Token。

⚠️ 本 AI 回答仅供参考，可能存在不准确之处，请您自行判断。`;
    const finalReplyResult = await sendFormattedMessage(this.chatId, fullText, this.userMessageId, this.userId);
    if (!finalReplyResult.ok) {
      throw finalReplyResult.error;
    }
    if (resTexts) {
      const botResponseContent = {
        role: "model",
        parts: response.parts
      };
      await contexts.update(this.chatId, this.userId, [
        ...completeContentsBeforeCall,
        botResponseContent
      ]);
    }
  }
  async process() {
    if (await this.handleRateLimiting()) {
      return;
    }
    let fileUploadMessageId = null;
    let thinkMessageId = null;
    let completeContents = [];
    try {
      fileUploadMessageId = await this.sendFileUploadMessage();
      completeContents = await this.buildCompleteContents();
      if (completeContents.length === 0) {
        const replyText = "未能从消息中提取到有效内容，请检查消息格式。";
        const sentResult = await bot.sendMessage(this.chatId, replyText, {
          replyToMessageId: this.userMessageId
        });
        if (sentResult.ok) {
          scheduleDeletion(this.chatId, sentResult.messageId, 3 * 60 * 1e3);
        }
        return;
      }
      if (fileUploadMessageId) {
        await sleep(3e3);
        await bot.deleteMessage(this.chatId, fileUploadMessageId);
        fileUploadMessageId = null;
      }
      thinkMessageId = await this.sendThinkingMessage();
      const ai = new GeminiApi({
        chatId: this.chatId,
        userId: this.userId,
        userMessageId: this.userMessageId,
        thinkMessageId
      });
      const geminiResponse = await ai.generateContent(completeContents);
      await this.processGeminiResponse(geminiResponse, thinkMessageId, completeContents);
    } catch (apiError) {
      Log.error("Error during Gemini API call or response processing.", {
        err: apiError,
        chatId: this.chatId,
        messageId: this.userMessageId
      });
      if (fileUploadMessageId) {
        await bot.deleteMessage(this.chatId, fileUploadMessageId);
      }
      if (thinkMessageId) {
        const err = apiError instanceof GeminiError ? apiError : void 0;
        if (!err?.hasToolThoughts) {
          await bot.deleteMessage(this.chatId, thinkMessageId);
        } else {
          scheduleDeletion(this.chatId, thinkMessageId, 60 * 6e4);
        }
      }
      throw apiError;
    }
  }
}
class FaqMatcher {
  messageText;
  faqData;
  constructor(messageText, faqData) {
    this.messageText = messageText;
    this.faqData = faqData;
  }
  static testAndGroup(group, text) {
    return group.every((pattern) => {
      try {
        return new RegExp(pattern, "ims").test(text);
      } catch (err) {
        Log.error(`无效的正则表达式模式: "${pattern}"`, { err });
        return false;
      }
    });
  }
  static matchAndGroup(group, text) {
    const matchedTexts = [];
    for (const pattern of group) {
      try {
        const regex = new RegExp(pattern, "ims");
        const match = regex.exec(text);
        if (match) {
          matchedTexts.push(match[0]);
        } else {
          return null;
        }
      } catch (err) {
        Log.error(`无效的正则表达式模式: "${pattern}"`, { err });
        return null;
      }
    }
    return matchedTexts;
  }
  findMatch() {
    for (const faqItem of this.faqData) {
      let winningGroup = null;
      let matchedTexts = null;
      for (const group of faqItem.keywordGroups) {
        const currentMatches = FaqMatcher.matchAndGroup(group, this.messageText);
        if (currentMatches) {
          winningGroup = group;
          matchedTexts = currentMatches;
          break;
        }
      }
      if (!winningGroup || !matchedTexts) {
        continue;
      }
      let isExcluded = false;
      if (faqItem.excludeKeywords && faqItem.excludeKeywords.length > 0) {
        isExcluded = faqItem.excludeKeywords.some((group) => FaqMatcher.testAndGroup(group, this.messageText));
      }
      Log.info(`匹配检查: 包含匹配=${!!winningGroup}, 排除匹配=${isExcluded}`);
      if (isExcluded) {
        continue;
      }
      return { matchedFaq: faqItem, winningGroup, matchedTexts };
    }
    return null;
  }
}
class NormalHandler {
  durableResourceId;
  faqDataKeyName;
  botName;
  message;
  chatId;
  userId;
  messageId;
  replyToMessage;
  photo;
  document;
  messageText;
  constructor(message) {
    const { durableResourceId, botName } = config.load();
    this.durableResourceId = durableResourceId;
    this.faqDataKeyName = "faq_data";
    this.botName = botName;
    const { message_id, chat, from, reply_to_message, photo, document, text, caption } = message;
    this.message = message;
    this.chatId = chat.id;
    this.userId = from?.id;
    this.messageId = message_id;
    this.replyToMessage = reply_to_message;
    this.photo = photo;
    this.document = document;
    this.messageText = text || caption || "";
    Log.info("Handling normal message.", { chatId: this.chatId, messageId: this.messageId });
  }
  async sendReply(text) {
    const sentResult = await bot.sendMessage(this.chatId, toHtml(text), {
      replyToMessageId: this.messageId,
      parseMode: "HTML"
    });
    if (sentResult.ok) {
      scheduleDeletion(this.chatId, sentResult.messageId, 5 * 60 * 1e3);
    }
  }
  async handleAskAlias() {
    await handleMention(this.message);
    return true;
  }
  async handleGenericCommandAlias(commandAlias, clean) {
    const commandAction = BotCommands.find(
      (command) => command.name === commandAlias || command.name === `script_${commandAlias}` || command.name === `gen_${commandAlias}`
    );
    if (commandAction) {
      const cleanText = clean.join(" ").trim();
      Log.info("Handling commands message...", { chatId: this.chatId, messageId: this.messageId });
      await commandAction.action(this.chatId, this.userId, this.messageId, { cleanText, message: this.message });
      return true;
    }
    return false;
  }
  async handleCommandAlias() {
    if (!this.messageText.startsWith(":")) {
      return false;
    }
    const [commandAlias, ...clean] = this.messageText.replace(":", "").split(" ");
    if (commandAlias === "ask") {
      return this.handleAskAlias();
    }
    return this.handleGenericCommandAlias(commandAlias, clean);
  }
  async handleKeywordReply() {
    if (this.photo || this.document?.mime_type?.startsWith("image/") && !this.document.mime_type.endsWith("gif")) {
      const fileData = await handleFile(this.message).catch(() => null);
      if (fileData) {
        const recognizedText = await handleOCR(fileData);
        if (recognizedText) {
          this.messageText += `

<image>
${recognizedText}
</image>`;
        }
      }
    }
    const faqDataResult = await kv.read(this.durableResourceId, this.faqDataKeyName, "json");
    if (!faqDataResult.success) return false;
    const matcher = new FaqMatcher(this.messageText, faqDataResult.data);
    const matchResult = matcher.findMatch();
    if (matchResult) {
      Log.info("发现匹配的 FAQ 条目。", {
        chatId: this.chatId,
        messageId: this.messageId,
        winningGroup: matchResult.winningGroup,
        matchedTexts: matchResult.matchedTexts
      });
      await this.sendReply(matchResult.matchedFaq.answer);
      return true;
    }
    return false;
  }
  async handleReplyToBot() {
    if (!this.replyToMessage) return false;
    if (this.replyToMessage.from?.username === this.botName) {
      await handleMention(this.message);
      return true;
    }
    return false;
  }
  async process() {
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
const handleCommand = async (message) => {
  const { message_id: messageId, from, chat } = message;
  Log.info("Handling commands message...", { chatId: chat.id, messageId });
  const messageText = message.text || message.caption;
  const messageEntities = message.entities || message.caption_entities;
  const commandEntity = messageEntities.find((entity) => entity.type === "bot_command");
  const fullCommandText = messageText.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);
  bot.setBotCommands(chat.id, from?.id);
  const commandName = fullCommandText.slice(1).split("@")[0].trim();
  const cleanText = messageText.replace(fullCommandText, "").trim();
  const targetCommand = BotCommands.find((cmd) => cmd.name === commandName);
  if (targetCommand) {
    await targetCommand.action(chat.id, from?.id, messageId, { cleanText, message });
  }
};
const POLLING_TIMEOUT_MS = 3 * 60 * 1e3;
const POLLING_INTERVAL_MS = 5 * 1e3;
const pollChatMemberStatus = async (chatId, user, timeoutMs, intervalMs) => {
  const { id: userId, first_name, last_name = "" } = user;
  const userName = `${first_name} ${last_name}`.trim();
  const startTime = Date.now();
  Log.info(`开始轮询用户 ${userName}(${userId}) 在聊天 ${chatId} 中的状态...`);
  while (Date.now() - startTime < timeoutMs) {
    const result = await bot.getChatMember(chatId, userId);
    if (!result.ok) {
      Log.error(`获取用户 ${userName}(${userId}) 聊天成员信息失败: ${result.error || "未知错误"}`, {
        chatId,
        userId
      });
      await sleep(intervalMs);
      continue;
    }
    const chatMember = result.data;
    switch (chatMember.status) {
      case "member":
        Log.info(`用户 ${userName}(${userId}) 已通过验证 (状态: member)。`, { chatId, userId });
        return { userId, isVerified: true };
      case "restricted":
        if (!chatMember.can_send_messages) {
          await sleep(intervalMs);
          continue;
        } else {
          Log.info(`用户 ${userName}(${userId}) 状态为 restricted 但已解除消息发送限制。`, { chatId, userId });
          return { userId, isVerified: true };
        }
      case "creator":
      case "administrator":
        Log.info(`用户 ${userName}(${userId}) 是 ${chatMember.status}，视为已通过验证。`, { chatId, userId });
        return { userId, isVerified: true };
      case "kicked":
      case "left":
        Log.info(`用户 ${userName}(${userId}) 状态为 ${chatMember.status}，验证失败或已离开/被踢出。`, { chatId, userId });
        return { userId, isVerified: false };
      default:
        Log.warn(`用户 ${userName}(${userId}) 处于未知或非验证状态，继续等待...`, { chatId, userId });
        await sleep(intervalMs);
        continue;
    }
  }
  Log.warn(`轮询用户 ${userName}(${userId}) 状态超时 (${timeoutMs / 1e3}秒)，未能通过验证。`, { chatId, userId });
  return { userId, isVerified: false };
};
const handleNewMember = async (message) => {
  const { botName, durableResourceId, newMemberWelcomeTextKeyName } = config.load();
  const { message_id, chat, new_chat_members } = message;
  if (!new_chat_members || new_chat_members.length === 0) return;
  const newMemberIds = new_chat_members?.map((member) => member.id);
  Log.info("Handling new chat member message", { chatId: chat.id, newMemberIds });
  const pollingTasks = new_chat_members.map((member) => pollChatMemberStatus(chat.id, member, POLLING_TIMEOUT_MS, POLLING_INTERVAL_MS));
  const results = await Promise.all(pollingTasks);
  for (const { userId, isVerified } of results) {
    const newMember = new_chat_members.find((m) => m.id === userId);
    if (!newMember) {
      Log.error(`未找到ID为 ${userId} 的新成员，这不应该发生。`, { chatId: chat.id, userId });
      continue;
    }
    if (isVerified) {
      const newMemberFullName = `${newMember.first_name} ${newMember.last_name || ""}`.trim();
      const newMemberMention = `[${newMemberFullName}](tg://user?id=${newMember.id})`;
      const newMemberWelcome = await kv.read(durableResourceId, newMemberWelcomeTextKeyName, "text");
      if (!newMemberWelcome.success) return;
      const replaceText = newMemberWelcome.data.replace("${NEW_MEMBER_MENTION}", newMemberMention).replace("${CHAT_TITLE}", chat.title).replace("${BOT_NAME}", botName).trim();
      Log.info(`向已验证的新成员 ${newMemberFullName}(${newMember.id}) 发送欢迎消息。`, { chatId: chat.id, newMemberId: newMember.id });
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "📓 使用指南", url: "https://gui-for-cores.github.io/zh/guide" },
            {
              text: "❓ 常见问题",
              callback_data: `cmd_faq_${newMember.id}`
            }
          ],
          [
            { text: "📢 通知频道", url: "https://t.me/GUI_for_Cores_Channel" },
            { text: "📄 项目地址", url: "https://github.com/GUI-for-Cores" }
          ]
        ]
      };
      const welcomeResult = await bot.sendMessage(chat.id, toHtml(replaceText), {
        replyToMessageId: message_id,
        parseMode: "HTML",
        replyMarkup
      });
      if (welcomeResult.ok) {
        scheduleDeletion(chat.id, welcomeResult.messageId, 3 * 6e4);
      }
    } else {
      Log.warn(`新成员 ${newMember.first_name}(${newMember.id}) 未通过验证或超时，不发送欢迎消息。`, { chatId: chat.id, newMemberId: newMember.id });
    }
  }
};
const handleMention = async (message) => {
  const mention = new MentionHandler(message);
  return await mention.process();
};
const handleNormal = async (message) => {
  const normal = new NormalHandler(message);
  return await normal.process();
};
class CallbackQueryHandler {
  message;
  data;
  queryId;
  userId;
  chatId;
  messageId;
  date;
  InlinedKeyboard;
  constructor(callbackQuery) {
    if (!callbackQuery.message || !callbackQuery.data) {
      Log.info("Invalid callback query", { queryId: callbackQuery.id });
      throw new Error("Invalid callback query");
    }
    const { id: queryId, from, message, data } = callbackQuery;
    const { chat, message_id, date, reply_to_message, reply_markup } = message;
    this.queryId = queryId;
    this.userId = from.id;
    this.chatId = chat.id;
    this.messageId = message_id;
    this.date = date;
    this.data = data;
    this.InlinedKeyboard = reply_markup?.inline_keyboard;
    this.message = { ...message, message_id: reply_to_message?.message_id || this.messageId, from };
    Log.info("Handling callback query", { chatId: this.chatId, messageId: this.messageId, userId: this.userId, data: this.data });
  }
  async _handleMention() {
    const [, , allowUserId] = this.data.split("_");
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: "你没有权限进行此操作" });
      return;
    }
    bot.answerCallbackQuery(this.queryId, { callbackText: "询问请求..." });
    const newMessageText = "简单说明下你能做什么？";
    this.message.text = newMessageText;
    delete this.message.reply_to_message;
    await handleMention(this.message);
  }
  async _handleTool() {
    const [, action, tool, allowUserId] = this.data.split("_");
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: "你没有权限进行此操作" });
      return;
    }
    if (action === "demo") {
      bot.answerCallbackQuery(this.queryId, { callbackText: "开始演示工具..." });
      const newMessageText = `请简单演示下 ${tool} 工具`;
      this.message.text = newMessageText;
      delete this.message.reply_to_message;
      await handleMention(this.message);
    }
  }
  async _handleCommand() {
    const [, command, allowUserId] = this.data.split("_");
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: "你没有权限进行此操作" });
      return;
    }
    bot.answerCallbackQuery(this.queryId, { callbackText: "开始执行..." });
    const targetCommand = BotCommands.find((cmd) => cmd.name === command);
    if (targetCommand) {
      await targetCommand.action(this.chatId, Number(allowUserId), this.messageId, {
        isCallback: true
      });
    }
  }
  async _handleReaction() {
    const { rateLimitId, durableResourceId } = config.load();
    const reaction = this.data.split("_")[1];
    const keyName = `reacted_${this.chatId}_${this.messageId}`;
    const reactedRes = await kv.read(rateLimitId, keyName, "json");
    const reactedUsers = reactedRes.success ? [...reactedRes.data] : [];
    if (reactedUsers.includes(this.userId)) {
      await bot.answerCallbackQuery(this.queryId, {
        callbackText: "你已做出过反应"
      });
      return;
    }
    await bot.answerCallbackQuery(this.queryId, { callbackText: "反应成功" });
    reactedUsers.push(this.userId);
    await kv.write(rateLimitId, keyName, JSON.stringify(reactedUsers), { expiration_ttl: 48 * 60 * 60 });
    const newInlineKeyboard = JSON.parse(JSON.stringify(this.InlinedKeyboard));
    let keyboardUpdated = false;
    for (const row of newInlineKeyboard) {
      for (const button of row) {
        if (button.callback_data === `reaction_${reaction}`) {
          const currentText = button.text;
          const parts = currentText.split(" ");
          const emoji = parts[0];
          const currentCount = parseInt(parts[1] || "0", 10);
          if (!isNaN(currentCount)) {
            const newCount = currentCount + 1;
            button.text = `${emoji} ${newCount}`;
            keyboardUpdated = true;
            break;
          }
        }
      }
      if (keyboardUpdated) {
        break;
      }
    }
    if (keyboardUpdated) {
      await bot.editMessageReplyMarkup(this.chatId, this.messageId, {
        inline_keyboard: newInlineKeyboard
      });
    }
    const totalReactionsKeyName = `total_reactions_${this.chatId}`;
    const oldTotalReactions = await kv.read(durableResourceId, totalReactionsKeyName, "json");
    if (!oldTotalReactions.success) return;
    const newTotalReactions = {
      like: reaction === "like" ? oldTotalReactions.data.like + 1 : oldTotalReactions.data.like,
      dislike: reaction === "dislike" ? oldTotalReactions.data.dislike + 1 : oldTotalReactions.data.dislike
    };
    await kv.write(durableResourceId, totalReactionsKeyName, JSON.stringify(newTotalReactions));
  }
  async _handleDelete() {
    const [, content, allowUserId] = this.data.split("_");
    if (this.userId !== Number(allowUserId)) {
      bot.answerCallbackQuery(this.queryId, { callbackText: "你没有权限进行此操作" });
      return;
    }
    if (content === "message") {
      if (Date.now() - this.date * 1e3 <= 30 * 60 * 1e3) {
        bot.answerCallbackQuery(this.queryId, { callbackText: "消息锁定中，无法删除" });
        return;
      }
      bot.answerCallbackQuery(this.queryId, { callbackText: "删除成功" });
      await bot.deleteMessage(this.chatId, this.messageId);
    }
  }
  async process() {
    switch (true) {
      case this.data === "PLACEHOLDER": {
        bot.answerCallbackQuery(this.queryId);
        break;
      }
      case this.data.startsWith("mention_"): {
        await this._handleMention();
        break;
      }
      case this.data.startsWith("tool_"): {
        await this._handleTool();
        break;
      }
      case this.data.startsWith("cmd_"): {
        await this._handleCommand();
        break;
      }
      case this.data.startsWith("reaction_"): {
        await this._handleReaction();
        break;
      }
      case this.data.startsWith("delete_"): {
        await this._handleDelete();
        break;
      }
    }
  }
}
const handleUpdate = async (update) => {
  const { botName, allowGroups } = config.load();
  const { update_id, message, callback_query } = update;
  if (message?.sticker) return;
  Log.info("Handling Telegram update", { update: simplifyUpdateLog(update) });
  if (!message && !callback_query) return;
  const msg = message || callback_query?.message;
  if (!msg) {
    Log.warn("No message or callback_query message found in update to process chat info", { updateId: update_id });
    return;
  }
  const { message_id, chat } = msg;
  if (!["group", "supergroup"].includes(chat.type)) {
    const replyText = "不支持私聊与频道，请在群组内使用此机器人。";
    const sentResult = await bot.sendMessage(chat.id, replyText);
    if (sentResult.ok) {
      scheduleMultipleDeletion(chat.id, [sentResult.messageId, message_id], 3 * 6e4);
    }
    return;
  }
  if (!allowGroups.includes(chat.id)) {
    const replyText = "群组未授权！";
    await bot.sendMessage(chat.id, replyText);
    await sleep(3e3);
    bot.leaveChat(chat.id);
    return;
  }
  const messageText = msg.text || msg.caption || "";
  const messageEntities = msg.entities || msg.caption_entities || [];
  try {
    if (callback_query?.data) {
      return await handleCallbackQuery(callback_query);
    }
    if (msg.new_chat_members) {
      return await handleNewMember(msg);
    }
    if (messageEntities.length > 0) {
      for (const entity of messageEntities) {
        if (entity.type === "mention" || entity.type === "text_mention") {
          const mentionedText = messageText.substring(entity.offset, entity.offset + entity.length);
          if (mentionedText === `@${botName}`) {
            return await handleMention(msg);
          }
        }
      }
      for (const entity of messageEntities) {
        if (entity.type === "bot_command") {
          const commandText = messageText.substring(entity.offset, entity.offset + entity.length);
          const atIndex = commandText.indexOf("@");
          if (atIndex !== -1) {
            const mentionedTarget = commandText.slice(atIndex + 1);
            if (mentionedTarget === botName) {
              return await handleCommand(msg);
            }
          }
        }
      }
    }
    return await handleNormal(msg);
  } catch (err) {
    const errorMessage = err instanceof AppError ? err.message : String(err);
    Log.error("Error while handling update", { err, updateId: update_id });
    sendErrorNotification(err, `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`);
    const shorten = `<blockquote expandable>${escaper.html(shortenString(`❌ ${errorMessage}`))}</blockquote>`;
    const errorResult = await bot.sendMessage(chat.id, shorten, { replyToMessageId: message_id, parseMode: "HTML" });
    if (errorResult.ok) {
      scheduleDeletion(chat.id, errorResult.messageId, 3 * 6e4);
    }
  }
};
const simplifyMessage = (message) => {
  if (!message) {
    return void 0;
  }
  const truncate = (text) => text ? text.length > 20 ? `${text.slice(0, 20)}...` : text : void 0;
  const filterEntity = (entities) => entities?.filter((e) => ["text_mention", "mention", "bot_command"].includes(e.type));
  return {
    ...message,
    text: truncate(message.text),
    caption: truncate(message.caption),
    entities: filterEntity(message.entities),
    caption_entities: filterEntity(message.caption_entities),
    photo: message.photo && message.photo.length > 0 ? [{ ...message.photo[message.photo.length - 1] }] : message.photo,
    reply_to_message: simplifyMessage(message.reply_to_message),
    reply_markup: message.reply_markup?.inline_keyboard?.[0] ? {
      ...message.reply_markup,
      inline_keyboard: [
        message.reply_markup.inline_keyboard[0].map((button) => ({ ...button }))
      ]
    } : message.reply_markup
  };
};
const simplifyUpdateLog = (update) => {
  const newUpdate = { ...update };
  if (newUpdate.message) {
    newUpdate.message = simplifyMessage(newUpdate.message);
  }
  if (newUpdate.edited_message) {
    newUpdate.edited_message = simplifyMessage(newUpdate.edited_message);
  }
  if (newUpdate.callback_query?.message) {
    newUpdate.callback_query = {
      ...newUpdate.callback_query,
      message: simplifyMessage(newUpdate.callback_query.message)
    };
  }
  return newUpdate;
};
const handleCallbackQuery = async (callbackQuery) => {
  const callback = new CallbackQueryHandler(callbackQuery);
  return await callback.process();
};
const handleFile = async (message) => {
  const file = new FileHandler(message);
  return await file.process();
};
const RequestHeadersSchema = {
  type: "object",
  properties: {
    "content-type": {
      type: "string",
      const: "application/json"
    },
    "x-telegram-bot-api-secret-token": {
      type: "string"
    }
  },
  required: ["content-type", "x-telegram-bot-api-secret-token"],
  additionalProperties: true
};
const RequestBodySchema = {
  type: "object",
  properties: {
    update_id: {
      type: "number"
    }
  },
  required: ["update_id"],
  additionalProperties: true
};
const routeSchema = {
  body: RequestBodySchema,
  headers: RequestHeadersSchema
};
const createRoutes = async (route) => {
  route.get("/", (request, reply) => {
    return reply.code(200).type("application/json").send({ code: 200, message: `It's worked` });
  });
  const constantTimeEqual = (a = "", b = "") => {
    if (a.length !== b.length) return false;
    let res = 0;
    for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return res === 0;
  };
  route.post("/webhook", {
    schema: routeSchema,
    preHandler: async (request, reply) => {
      const { secretToken } = config.load();
      const safeHeaders = { ...request.headers, "x-telegram-bot-api-secret-token": "***" };
      Log.info("Webhook Request Headers", { headers: safeHeaders });
      const secretTokenFromHeader = request.headers["x-telegram-bot-api-secret-token"] || "";
      if (!constantTimeEqual(secretTokenFromHeader, secretToken)) {
        Log.warn("Unauthorized webhook access attempt", { clientIp: request.headers["x-real-ip"], userAgent: request.headers["user-agent"] });
        return reply.code(401).type("application/json").send({ code: 401, message: "Bad Credentials" });
      }
    },
    handler: async (request, reply) => {
      Log.info("Webhook Verification successful");
      const update = request.body;
      setImmediate(() => {
        handleUpdate(update).catch((error) => {
          Log.error("Error handling update", {
            err: error instanceof Error ? error.message : String(error)
          });
        });
      });
      return reply.code(202).type("application/json").send({ code: 202, message: `OK` });
    }
  });
  route.setNotFoundHandler((request, reply) => {
    return reply.code(404).type("application/json").send({ code: 404, message: "Not Found" });
  });
};
const buildApp = async () => {
  const { loggerLevel } = config.load();
  initLogger({ loggerLevel });
  const app = Fastify({
    logger: {
      level: loggerLevel,
      stream: loggerAdapter
    }
  });
  app.register(createRoutes);
  return app;
};
const startServer = async () => {
  const { listenHost: host, listenPort: port } = config.load();
  const server = await buildApp();
  try {
    await server.listen({ port, host });
    const addressInfo = server.server.address();
    if (addressInfo && typeof addressInfo === "object") {
      const serverUrl = `http://${addressInfo.address === "0.0.0.0" ? "127.0.0.1" : addressInfo.address}:${addressInfo.port}`;
      Log.info(`🚀 Server ready`, { url: serverUrl });
    } else {
      Log.info(`🚀 Server ready, listening on ${host}:${port}`);
    }
  } catch (error) {
    Log.fatal("Server startup failed", {
      err: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
};
startServer();
//# sourceMappingURL=index.js.map
