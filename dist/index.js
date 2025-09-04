import Fastify from "fastify";
import { isIP } from "node:net";
import process$1 from "node:process";
import "node:crypto";
import * as lame from "@breezystack/lamejs";
import { Type, Behavior, HarmBlockThreshold, HarmCategory, FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import Cloudflare from "cloudflare";
import { Logger } from "tslog";
import { VM } from "vm2";
const LOGGER_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];
class BotConfig {
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
    const modelTemperature = Number(ENV.MODEL_CONFIG_TEMPERATURE) || 0.3;
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
const config = new BotConfig();
const formatTime = (time = Date.now()) => {
  const timeDate = typeof time === "number" ? new Date(time) : time;
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
  const parts = formatter.formatToParts(timeDate).reduce(
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
const sampleByShuffle = (arr, k = 3) => {
  if (k <= 0) return [];
  if (k >= arr.length) return arr.slice();
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
};
const shortenString = (input) => {
  const MAX = 4096;
  const HEAD = 2e3;
  const TAIL = 2e3;
  if (typeof input !== "string") {
    throw new TypeError("input must be a string");
  }
  const chars = getUTF8Byte(input);
  if (chars.length <= MAX) return input;
  const headPart = chars.slice(0, HEAD).join("");
  const tailPart = chars.slice(chars.length - TAIL).join("");
  return `${headPart}

......

${tailPart}`;
};
function getUTF8Byte(str) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  return encoded;
}
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
const MARKDOWN_MARK_REGEX = {
  CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g,
  INLINE_CODE: /`([^`]+?)`/g,
  LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
  BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g,
  UNDERLINE_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g,
  STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
  SPOILER: /\|\|(?!\s)([\s\S]*?)(?<!\s)\|\|/g,
  BLOCKQUOTE_LINE: /^(>>? .+(?:\n>>? .+)*)/gm
};
class Escapers {
  markdownV2Text = (str) => {
    return str.replace(/([_*[\]()~`>#+-=|{}.!])/g, "\\$1");
  };
  markdownV2Code = (str) => {
    return str.replace(/([`\\])/g, "\\$1");
  };
  markdownV2Url = (str) => {
    return str.replace(/([)\\])/g, "\\$1");
  };
  Html = (str) => {
    return str.replace(/[<>&]/g, (c) => {
      switch (c) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        default:
          return c;
      }
    });
  };
  markdown = (str) => {
    return str.replace(/([_*[`])/g, "\\$1");
  };
}
const escapers = new Escapers();
class Formatters {
  markdownV2 = (markdownText) => {
    let processedText = markdownText;
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang, code) => {
      const escapedCode = escapers.markdownV2Code(code);
      return `\`\`\`${lang}
${escapedCode}
\`\`\``;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code) => {
      const escapedCode = escapers.markdownV2Code(code);
      return `\`${escapedCode}\``;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text, url) => {
      const escapedText = escapers.markdownV2Text(text);
      const escapedUrl = escapers.markdownV2Url(url);
      return `[${escapedText}](${escapedUrl})`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content) => {
      const escapedContent = escapers.markdownV2Text(content);
      return `||${escapedContent}||`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content) => {
      const escapedContent = escapers.markdownV2Text(content);
      return `~${escapedContent}~`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content) => {
      const escapedContent = escapers.markdownV2Text(content);
      return `*${escapedContent}*`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content) => {
      const escapedContent = escapers.markdownV2Text(content);
      return `__${escapedContent}__`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BLOCKQUOTE_LINE, (match, content) => {
      return `> ${content}`;
    });
    return processedText;
  };
  Html = (markdownText) => {
    let processedText = markdownText;
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang, code) => {
      if (lang) {
        return `<pre><code class="language-${escapers.Html(lang)}">${code}</code></pre>`;
      }
      return `<pre>${code}</pre>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code) => {
      const escapedCode = escapers.Html(code);
      return `<code>${escapedCode}</code>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text, url) => {
      const escapedText = escapers.Html(text);
      const escapedUrl = escapers.Html(url);
      return `<a href="${escapedUrl}">${escapedText}</a>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content) => {
      const escapedContent = escapers.Html(content);
      return `<span class="tg-spoiler">${escapedContent}</span>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content) => {
      const escapedContent = escapers.Html(content);
      return `<s>${escapedContent}</s>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content) => {
      const escapedContent = escapers.Html(content);
      return `<b>${escapedContent}</b>`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content) => {
      const escapedContent = escapers.Html(content);
      return `<u>${escapedContent}</u>`;
    });
    processedText = processedText.replace(/^(>>? .+(?:\n>>? .+)*)/gm, (match) => {
      const isExpandable = match.startsWith(">>");
      const content = match.replace(/^(>>?)\s/gm, "");
      const escapedContent = escapers.Html(content);
      if (isExpandable) {
        return `<blockquote expandable>${escapedContent}</blockquote>`;
      }
      return `<blockquote>${escapedContent}</blockquote>`;
    });
    return processedText;
  };
  markdown = (markdownText) => {
    let processedText = markdownText;
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang, code) => {
      const escapedCode = escapers.markdown(code);
      return `\`\`\`${lang}
${escapedCode}
\`\`\``;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code) => {
      const escapedCode = escapers.markdown(code);
      return `\`${escapedCode}\``;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text, url) => {
      const linkText = escapers.markdown(text);
      return `[${linkText}](${url})`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content) => {
      const innerContent = escapers.markdown(content);
      return `*${innerContent}*`;
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content) => {
      return escapers.markdown(content);
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content) => {
      return escapers.markdown(content);
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content) => {
      return escapers.markdown(content);
    });
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BLOCKQUOTE_LINE, (match, content) => {
      return escapers.markdown(content);
    });
    let finalResult = "";
    let k = 0;
    const legacySpecialChars = "_*`[";
    const markersToSkip = ["```", "[", "`", "*", "_"];
    while (k < processedText.length) {
      let isMarkerStart = false;
      for (const marker of markersToSkip) {
        if (processedText.substring(k, k + marker.length) === marker) {
          finalResult += processedText[k];
          k++;
          isMarkerStart = true;
          break;
        }
      }
      if (isMarkerStart) {
        continue;
      }
      if (processedText[k] === "\\") {
        finalResult += "\\\\";
        k++;
        continue;
      }
      if (legacySpecialChars.includes(processedText[k])) {
        finalResult += "\\" + processedText[k];
        k++;
      } else {
        finalResult += processedText[k];
        k++;
      }
    }
    return finalResult;
  };
}
const formatters = new Formatters();
function formatText(text, parseMode) {
  if (parseMode === null) {
    return escapers.Html(text);
  }
  switch (parseMode) {
    case "HTML":
      return formatters.Html(text);
    case "MarkdownV2":
      return formatters.markdownV2(text);
    case "Markdown":
      return formatters.markdown(text);
    default:
      throw new TelegramError(`不支持的 parseMode: ${parseMode}`);
  }
}
const getOpeningTagString = (type, parseMode) => {
  if (parseMode === "HTML") {
    switch (type) {
      case "b":
      case "strong":
        return "<b>";
      case "u":
      case "ins":
        return "<u>";
      case "s":
      case "strike":
      case "del":
        return "<s>";
      case "span":
      case "tg-spoiler":
        return '<span class="tg-spoiler">';
      case "a":
        return '<a href="">';
      case "code":
        return "<code>";
      case "pre":
        return "<pre>";
      case "pre_code_lang":
        return `<pre><code class="language-">`;
      case "blockquote":
        return "<blockquote>";
      case "blockquote_expandable":
        return "<blockquote expandable>";
      case "tg-emoji":
        return '<tg-emoji emoji-id="">';
      default:
        return "";
    }
  } else if (parseMode === "MarkdownV2") {
    switch (type) {
      case "mv2_bold":
        return "*";
      case "mv2_underline":
        return "__";
      case "mv2_strikethrough":
        return "~";
      case "mv2_spoiler":
        return "||";
      case "mv2_code_inline":
        return "`";
      case "mv2_code_block":
        return "```";
      case "mv2_link":
        return "[";
      case "mv2_blockquote":
      case "mv2_blockquote_expandable":
        return "> ";
      default:
        return "";
    }
  } else if (parseMode === "Markdown") {
    switch (type) {
      case "legacy_bold":
        return "*";
      case "legacy_code_inline":
        return "`";
      case "legacy_code_block":
        return "```";
      case "legacy_link":
        return "[";
      default:
        return "";
    }
  }
  return "";
};
const getClosingTagString = (type, parseMode) => {
  if (parseMode === "HTML") {
    switch (type) {
      case "b":
      case "strong":
        return "</b>";
      case "u":
      case "ins":
        return "</u>";
      case "s":
      case "strike":
      case "del":
        return "</s>";
      case "span":
      case "tg-spoiler":
        return "</span>";
      case "a":
        return "</a>";
      case "code":
        return "</code>";
      case "pre":
        return "</pre>";
      case "pre_code_lang":
        return "</code></pre>";
      case "blockquote":
      case "blockquote_expandable":
        return "</blockquote>";
      case "tg-emoji":
        return "</tg-emoji>";
      default:
        return "";
    }
  } else if (parseMode === "MarkdownV2") {
    switch (type) {
      case "mv2_bold":
        return "*";
      case "mv2_underline":
        return "__";
      case "mv2_strikethrough":
        return "~";
      case "mv2_spoiler":
        return "||";
      case "mv2_code_inline":
        return "`";
      case "mv2_code_block":
        return "```";
      case "mv2_link":
        return ")";
      case "mv2_blockquote":
      case "mv2_blockquote_expandable":
        return "";
      default:
        return "";
    }
  } else if (parseMode === "Markdown") {
    switch (type) {
      case "legacy_bold":
        return "*";
      case "legacy_code_inline":
        return "`";
      case "legacy_code_block":
        return "```";
      case "legacy_link":
        return ")";
      default:
        return "";
    }
  }
  return "";
};
const balanceChunkTags = (chunk, parseMode, inheritedOpenTags) => {
  if (parseMode === null) {
    return { balancedChunk: chunk, nextInheritedOpenTags: [] };
  }
  const currentStack = [...inheritedOpenTags];
  let processedChunk = "";
  let i = 0;
  let openingTagsString = "";
  for (const tagType of inheritedOpenTags) {
    const openStr = getOpeningTagString(tagType, parseMode);
    if (openStr && !["> "].includes(openStr)) {
      openingTagsString += openStr;
    }
  }
  while (i < chunk.length) {
    let matched = false;
    if (parseMode === "HTML") {
      const htmlTagMatch = chunk.substring(i).match(/^<(\/?[\w-]+)(?:\s+[^>]*)?>/);
      if (htmlTagMatch) {
        const fullMatch = htmlTagMatch[0];
        const tagNameWithSlash = htmlTagMatch[1].toLowerCase();
        const isClosing = tagNameWithSlash.startsWith("/");
        const cleanTagName = isClosing ? tagNameWithSlash.substring(1) : tagNameWithSlash;
        const supportedTags = [
          "b",
          "strong",
          "u",
          "ins",
          "s",
          "strike",
          "del",
          "span",
          "tg-spoiler",
          "a",
          "code",
          "pre",
          "blockquote",
          "blockquote_expandable",
          "tg-emoji"
        ];
        if (supportedTags.includes(cleanTagName) || cleanTagName === "code" && currentStack.includes("pre")) {
          if (isClosing) {
            const stackIndex = currentStack.lastIndexOf(cleanTagName);
            if (stackIndex !== -1) {
              currentStack.splice(stackIndex, 1);
            } else {
              Log.warn(`HTML 格式中发现未匹配的闭合标签: </${cleanTagName}>`);
            }
          } else {
            if (cleanTagName === "code" && currentStack[currentStack.length - 1] === "pre") {
              currentStack.push("pre_code_lang");
            } else {
              currentStack.push(cleanTagName);
            }
          }
          processedChunk += fullMatch;
          i += fullMatch.length;
          matched = true;
        }
      }
      const entityRegexMatch = chunk.substring(i).match(/^&(\w+|#\d+|#x[0-9a-fA-F]+);/);
      if (entityRegexMatch) {
        const entityMatch = entityRegexMatch;
        processedChunk += entityMatch;
        i += entityMatch.length;
        matched = true;
      }
    } else if (parseMode === "MarkdownV2" || parseMode === "Markdown") {
      if (chunk[i] === "\\" && i + 1 < chunk.length) {
        processedChunk += chunk.substring(i, i + 2);
        i += 2;
        matched = true;
      } else {
        const mv2MarkersMap = {
          "```": "mv2_code_block",
          "||": "mv2_spoiler",
          __: "mv2_underline",
          "*": "mv2_bold",
          "~": "mv2_strikethrough",
          "`": "mv2_code_inline",
          "[": "mv2_link",
          ")": "mv2_link_end",
          "> ": "mv2_blockquote"
        };
        const legacyMarkersMap = {
          "```": "legacy_code_block",
          "*": "legacy_bold",
          "`": "legacy_code_inline",
          "[": "legacy_link",
          ")": "legacy_link_end"
        };
        const currentMarkers = parseMode === "MarkdownV2" ? mv2MarkersMap : legacyMarkersMap;
        let markerFound = false;
        const multiCharMarkers = parseMode === "MarkdownV2" ? ["```", "||", "__"] : ["```"];
        for (const marker of multiCharMarkers) {
          if (currentMarkers[marker] && chunk.substring(i, i + marker.length) === marker) {
            const type = currentMarkers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;
            if (top === type) {
              currentStack.pop();
            } else {
              currentStack.push(type);
            }
            processedChunk += marker;
            i += marker.length;
            matched = true;
            markerFound = true;
            break;
          }
        }
        if (markerFound) continue;
        const singleCharMarkers = parseMode === "MarkdownV2" ? ["`", "*", "_", "[", ")", "~"] : ["`", "*", "_", "[", ")"];
        for (const marker of singleCharMarkers) {
          if (currentMarkers[marker] && chunk[i] === marker) {
            if (marker === "_" && chunk.substring(i, i + 2) === "__") {
              continue;
            }
            const type = currentMarkers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;
            if (marker === ")") {
              if (top === "mv2_link" || top === "legacy_link") {
                currentStack.pop();
              } else {
                Log.warn(`${parseMode} 格式中发现未匹配的链接闭合标记: )`);
              }
            } else if (marker === "[") {
              currentStack.push(type);
            } else if (marker === "`" || marker === "*" || parseMode === "MarkdownV2" && marker === "~") {
              if (top === type) {
                currentStack.pop();
              } else {
                currentStack.push(type);
              }
            }
            processedChunk += marker;
            i += marker.length;
            matched = true;
            break;
          }
        }
        if (!matched && chunk.substring(i).startsWith("> ")) {
          const isNewlineBefore = i === 0 || chunk[i - 1] === "\n";
          if (isNewlineBefore) {
            const topTag = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;
            if (topTag !== "mv2_blockquote" && topTag !== "mv2_blockquote_expandable") {
              currentStack.push("mv2_blockquote");
            }
            processedChunk += "> ";
            i += 2;
            matched = true;
          }
        } else if (!matched && currentStack.length > 0 && (currentStack[currentStack.length - 1] === "mv2_blockquote" || currentStack[currentStack.length - 1] === "mv2_blockquote_expandable") && (i === 0 || chunk[i - 1] === "\n")) {
          currentStack.pop();
        }
      }
    }
    if (!matched) {
      processedChunk += chunk[i];
      i++;
    }
  }
  let closingTagsString = "";
  for (let j = currentStack.length - 1; j >= 0; j--) {
    const tagType = currentStack[j];
    if (tagType !== "mv2_blockquote" && tagType !== "mv2_blockquote_expandable") {
      const closeStr = getClosingTagString(tagType, parseMode);
      closingTagsString += closeStr;
    }
  }
  const nextInheritedOpenTags = [...currentStack];
  return {
    balancedChunk: openingTagsString + processedChunk + closingTagsString,
    nextInheritedOpenTags
  };
};
const splitFormattedText = (formattedText, parseMode) => {
  const maxLength = 4e3;
  const chunks = [];
  let currentPos = 0;
  const codeBlockRanges = [];
  if (parseMode === "HTML") {
    const preRegex = /<pre(?:[^>]*?)?>[\s\S]*?<\/pre>/g;
    let match;
    while ((match = preRegex.exec(formattedText)) !== null) {
      codeBlockRanges.push({ start: match.index, end: match.index + match.length });
    }
  } else if (parseMode === "MarkdownV2" || parseMode === "Markdown") {
    let match;
    while ((match = MARKDOWN_MARK_REGEX.CODE_BLOCK.exec(formattedText)) !== null) {
      codeBlockRanges.push({ start: match.index, end: match.index + match.length });
    }
  }
  while (currentPos < formattedText.length) {
    let endPos = Math.min(currentPos + maxLength, formattedText.length);
    if (endPos < formattedText.length) {
      let isInCodeBlock = false;
      let currentBlockEnd = -1;
      for (const range of codeBlockRanges) {
        if (endPos > range.start && endPos < range.end) {
          isInCodeBlock = true;
          currentBlockEnd = range.end;
          break;
        }
      }
      if (isInCodeBlock) {
        if (currentBlockEnd - currentPos <= maxLength) {
          endPos = currentBlockEnd;
        } else {
          const searchStart = Math.max(currentPos, endPos - 200);
          let safeSplitPoint = -1;
          for (let i = endPos - 1; i >= searchStart; i--) {
            if (formattedText[i] === "\n") {
              safeSplitPoint = i + 1;
              break;
            }
          }
          if (safeSplitPoint !== -1) {
            endPos = safeSplitPoint;
          }
        }
      } else {
        const searchStart = Math.max(currentPos, endPos - 200);
        let safeSplitPoint = -1;
        for (let i = endPos - 1; i >= searchStart; i--) {
          if (formattedText[i] === "\n" || formattedText[i] === " ") {
            safeSplitPoint = i + 1;
            break;
          }
        }
        if (safeSplitPoint !== -1) {
          endPos = safeSplitPoint;
        }
      }
    }
    const chunk = formattedText.substring(currentPos, endPos);
    chunks.push(chunk);
    currentPos = endPos;
  }
  return chunks;
};
const scheduleTask = async (action, params, delayMs) => {
  const { schedulerApiUrl, schedulerApiToken } = config.load();
  const name = `${action}-${JSON.stringify(params)}`;
  const encoded = Buffer.from(schedulerApiToken, "utf-8").toString("base64");
  try {
    await fetch(schedulerApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`
      },
      body: JSON.stringify({ action, params, delayMs })
    });
    Log.info(`Registering scheduled task with name: ${name}, execute after ${delayMs / 1e3} s`, {
      params
    });
  } catch (error) {
    Log.error(`Failed to register scheduled task with name: ${name}`, {
      params,
      err: error instanceof Error ? error.message : String(error)
    });
  }
};
const scheduleDeletion = (params, delayMs) => {
  void scheduleTask("deleteMessage", params, delayMs);
};
const sendFormattedMessage = async (chatId, standardMarkdownText, replyToMessageId, userId) => {
  if (!standardMarkdownText || standardMarkdownText.trim().length === 0) {
    return { ok: true, messageId: void 0 };
  }
  const modesToTry = ["HTML", "MarkdownV2", "Markdown", null];
  let lastError = null;
  for (const mode of modesToTry) {
    Log.info(`尝试使用 [${mode ?? "纯文本"}] 格式发送全部消息...`);
    const sentMessageIdsInCurrentAttempt = [];
    let lastMessageId;
    let currentReplyTo = replyToMessageId;
    let modeSucceeded = true;
    try {
      const formattedText = formatText(standardMarkdownText, mode);
      const chunks = splitFormattedText(formattedText, mode);
      Log.info(`[${mode ?? "纯文本"}] 格式的文本被分割成 ${chunks.length} 块.`);
      let inheritedOpenTags = [];
      for (let i = 0; i < chunks.length; i++) {
        const rawChunk = chunks[i];
        if (rawChunk.trim().length === 0) {
          Log.info(`跳过发送空消息块 (块 ${i + 1}/${chunks.length})`);
          continue;
        }
        const { balancedChunk, nextInheritedOpenTags } = balanceChunkTags(rawChunk, mode, inheritedOpenTags);
        inheritedOpenTags = nextInheritedOpenTags;
        Log.info(`发送消息 (块 ${i + 1}/${chunks.length}, 长度: ${balancedChunk.length}, 格式: ${mode ?? "纯文本"})...`);
        const replyMarkup = {
          inline_keyboard: makeInlineKeyboard(userId)
        };
        const sendResult = await bot.sendMessage(chatId, balancedChunk, {
          replyToMessageId: currentReplyTo,
          parseMode: mode === null ? void 0 : mode,
          replyMarkup
        });
        if (sendResult.ok) {
          Log.info(`消息块 ${i + 1}/${chunks.length} 发送成功.`);
          sentMessageIdsInCurrentAttempt.push(sendResult.messageId);
          scheduleDeletion({ chat_id: chatId, message_id: sendResult.messageId }, 24 * 60 * 6e4);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
        } else {
          Log.error(`消息块 ${i + 1}/${chunks.length} 发送失败 (格式: ${mode ?? "纯文本"}).`, { err: sendResult.error });
          lastError = sendResult.error;
          modeSucceeded = false;
          if (sentMessageIdsInCurrentAttempt.length > 0) {
            Log.warn(`[${mode ?? "纯文本"}] 模式发送中断，开始清理 ${sentMessageIdsInCurrentAttempt.length} 条已发送的消息...`);
            bot.deleteMessages(chatId, sentMessageIdsInCurrentAttempt);
            Log.info("后台进行清理操作。");
          }
          break;
        }
      }
      if (modeSucceeded) {
        Log.info(`所有消息均已使用 [${mode ?? "纯文本"}] 格式成功发送.`);
        return { ok: true, messageId: lastMessageId };
      }
      Log.warn(`[${mode ?? "纯文本"}] 格式发送失败，将尝试下一个格式...`);
    } catch (formatError) {
      const errorMessage = formatError instanceof Error ? formatError.message : String(formatError);
      Log.error(`在处理 [${mode ?? "纯文本"}] 格式时发生严重错误.`, { err: errorMessage });
      lastError = errorMessage;
    }
  }
  Log.error("所有格式化模式均发送失败。");
  return { ok: false, error: new TelegramError(`所有格式化模式发送失败，${lastError}`, "ALL_FORMAT_MODES_FAILED") };
};
const sendErrorNotification = async (error, context = "") => {
  const { adminId } = config.load();
  try {
    if (adminId) {
      const currentTime = formatTime(Date.now());
      const errorMessage = `*🚨 [错误告警] 🚨*

*发生时间*: \`${currentTime}\`

*错误上下文*: \`${escapers.Html(context)}\`

*错误信息*: \`${escapers.Html(error.message || String(error))}\`

*堆栈追踪*:
\`\`\`javascript
${escapers.Html(error.stack || "N/A")}
\`\`\``;
      await bot.sendMessage(adminId, formatters.Html(errorMessage), { parseMode: "HTML" });
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
class KvNamespace {
  callCloudflareApi = async (action, params) => {
    const { cloudflareToken, cloudflareAccountId } = config.load();
    const { namespaceId, keyName, value, expiration_ttl } = params;
    const client = new Cloudflare({
      apiToken: cloudflareToken
    });
    try {
      if (action === "update") {
        await client.kv.namespaces.values[action](namespaceId, keyName, {
          account_id: cloudflareAccountId,
          value,
          expiration_ttl
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
  write = async (namespaceId, keyName, value, options = {}) => {
    try {
      await this.callCloudflareApi("update", {
        namespaceId,
        keyName,
        value,
        ...options
      });
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
const kv = new KvNamespace();
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
class ChatContexts {
  get = async (chatId, userId) => {
    const { chatContextId } = config.load();
    const keyName = `contexts_${chatId}_${userId}`;
    const contexts2 = await kv.read(chatContextId, keyName, "json");
    return contexts2.success ? contexts2.data : [];
  };
  update = async (chatId, userId, contexts2) => {
    const { chatContextId, maxContextLength, contextsExpirationSecond } = config.load();
    const keyName = `contexts_${chatId}_${userId}`;
    const historyContexts = await this.get(chatId, userId);
    const newContexts = [...historyContexts, ...contexts2];
    if (newContexts.length > maxContextLength) {
      newContexts.splice(0, newContexts.length - maxContextLength);
    }
    await kv.write(chatContextId, keyName, JSON.stringify(newContexts), {
      expiration_ttl: contextsExpirationSecond
    });
    Log.info(`${keyName}: Chat context updated success, current length ${newContexts.length}`);
  };
  clear = async (chatId, userId) => {
    const { chatContextId, contextsExpirationSecond } = config.load();
    const keyName = `contexts_${chatId}_${userId}`;
    await kv.write(chatContextId, keyName, JSON.stringify([]), {
      expiration_ttl: contextsExpirationSecond
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
const storageService = new StorageService();
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
class ExecutionService {
  async executeScript(scriptContent, message, param) {
    const startTime = process.hrtime.bigint();
    const vm = new VM({
      timeout: 6e4,
      allowAsync: true,
      sandbox: {
        Http,
        Body
      }
    });
    try {
      vm.run(scriptContent);
      const scriptArgument = String(param ?? "");
      vm.freeze(scriptArgument, "scriptArgument");
      vm.freeze(message, "message");
      const result = await vm.run("run(scriptArgument, message)");
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
const executionService = new ExecutionService();
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
      throw new ScriptError(`脚本卸载失败：未找到标签为 "${tag}" 的脚本。`);
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
const scriptManager = new ScriptManager();
const BaseCommands = [
  {
    name: "start",
    description: "开始使用",
    action: async (params) => {
      Log.info("Executing start command.");
      const { chatId, userId, messageId, isCallback = false } = params;
      const { modelName, durableResourceId, startReplyTextKeyName } = config.load();
      const startReply = await kv.read(durableResourceId, startReplyTextKeyName, "text");
      if (!startReply.success) {
        throw new KvNamespaceError(`Start 命令回复内容读取失败，${startReply.error}`, "START_REPLY_NOT_FOUND");
      }
      const replaceText = startReply.data.replace("MODEL_NAME", modelName).trim();
      const totalReactionsKeyName = `total_reactions_${chatId}`;
      const totalReactions = await kv.read(durableResourceId, totalReactionsKeyName, "json");
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: `群组 👍 ${totalReactions.success ? totalReactions.data.like || 0 : 0}`,
              callback_data: "PLACEHOLDER"
            },
            {
              text: `群组 👎 ${totalReactions.success ? totalReactions.data.dislike || 0 : 0}`,
              callback_data: "PLACEHOLDER"
            }
          ],
          [
            {
              text: "🖼️ 生成图片",
              switch_inline_query_current_chat: "请生成一幅图像：IMAGE_GENERATION_PROMPT"
            },
            {
              text: "🗣️ 生成语音",
              switch_inline_query_current_chat: "请生成一段语音：SPEECH_GENERATION_PROMPT"
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
        startResult = await bot.editMessageText(chatId, messageId, formatters.Html(replaceText), { parseMode: "HTML", replyMarkup });
      } else {
        startResult = await bot.sendMessage(chatId, formatters.Html(replaceText), {
          replyToMessageId: messageId,
          parseMode: "HTML",
          replyMarkup
        });
      }
      if (startResult.ok) {
        scheduleDeletion({ chat_id: chatId, message_id: startResult.messageId }, 3 * 6e4);
      }
    }
  },
  {
    name: "faq",
    description: "常见问题",
    action: async (params) => {
      Log.info("Executing faq command.");
      const { chatId, userId, messageId, isCallback = false } = params;
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
        faqResult = await bot.editMessageText(chatId, messageId, formatters.Html(faqReply.data.trim()), {
          parseMode: "HTML",
          replyMarkup: backReplyMarkup
        });
      } else {
        faqResult = await bot.sendMessage(chatId, formatters.Html(faqReply.data.trim()), { replyToMessageId: messageId, parseMode: "HTML" });
      }
      if (faqResult.ok) {
        scheduleDeletion({ chat_id: chatId, message_id: faqResult.messageId }, 5 * 6e4);
      }
    }
  },
  {
    name: "clear",
    description: "清理对话历史",
    action: async (params) => {
      Log.info("Executing clear command.");
      const { chatId, userId, messageId, isCallback = false } = params;
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
        clearingResult = await bot.editMessageText(chatId, messageId, clearingText, { replyMarkup: backReplyMarkup });
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
          scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 6e4);
        }
      }
    }
  },
  {
    name: "tools",
    description: "模型可用工具",
    action: async (params) => {
      Log.info("Executing tools command.");
      const { chatId, userId, messageId, isCallback = false } = params;
      const toolFunctions = geminiTools[0]?.functionDeclarations || [];
      const toolList = toolFunctions?.map((tool) => `* **${tool.name}**
    ${tool.description?.slice(0, 40)}...`).join("\n").trim() || "";
      const randomTools = sampleByShuffle(toolFunctions, 4);
      const keyboard1 = randomTools.slice(0, 2).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}_${userId}`
      }));
      const keyboard2 = randomTools.slice(2, 4).map((tool) => ({
        text: `🛠 ${tool.name}`,
        callback_data: `tool_demo_${tool.name}_${userId}`
      }));
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "✋ 工具演示",
              switch_inline_query_current_chat: `请简单演示下 TOOL_NAME 工具`
            }
          ],
          keyboard1,
          keyboard2
        ]
      };
      const toolsText = `🛠 我可以使用以下工具：

${toolList}`;
      let toolsResult;
      if (isCallback) {
        const backReplyMarkup = {
          inline_keyboard: [
            ...replyMarkup.inline_keyboard,
            [
              {
                text: "⬅️ Go Back",
                callback_data: `cmd_start_${userId}`
              }
            ]
          ]
        };
        toolsResult = await bot.editMessageText(chatId, messageId, formatters.Html(toolsText), {
          parseMode: "HTML",
          replyMarkup: backReplyMarkup
        });
      } else {
        toolsResult = await bot.sendMessage(chatId, formatters.Html(toolsText), {
          replyToMessageId: messageId,
          parseMode: "HTML",
          replyMarkup
        });
      }
      if (toolsResult.ok) {
        scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 5 * 6e4);
      }
    }
  }
];
const GenerateCommands = [
  {
    name: "gen_img",
    description: "生成图片",
    action: async (params) => {
      Log.info("Executing gen_img command.");
      const { chatId, userId, messageId, cleanText } = params;
      const { durableResourceId, geminiApiKeysKeyName } = config.load();
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:img [图片生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1e3);
        }
        return;
      }
      const apiKeys = await kv.read(durableResourceId, geminiApiKeysKeyName, "json");
      if (!apiKeys.success) {
        throw new KvNamespaceError(`无法获取 API 密钥，请检查配置，${apiKeys.error}`, "GEMINI_API_KEY_NOT_FOUND");
      }
      const [apiKey, apiKeyId] = apiKeys.data[Math.floor(Math.random() * apiKeys.data.length)];
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      let renderMessageId = void 0;
      const renderResult = await bot.sendMessage(chatId, `🎨 Rendering...`, { replyToMessageId: messageId });
      if (renderResult.ok) {
        renderMessageId = renderResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        currentApiKey: apiKey,
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
    action: async (params) => {
      Log.info("Executing gen_tts command.");
      const { chatId, userId, messageId, cleanText } = params;
      const { durableResourceId, geminiApiKeysKeyName } = config.load();
      if (!cleanText) {
        const notText = await bot.sendMessage(chatId, `:tts [语音生成提示]`, { replyToMessageId: messageId });
        if (notText.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: notText.messageId }, 3 * 60 * 1e3);
        }
        return;
      }
      const apiKeys = await kv.read(durableResourceId, geminiApiKeysKeyName, "json");
      if (!apiKeys.success) {
        throw new KvNamespaceError(`无法获取 API 密钥，请检查配置，${apiKeys.error}`, "GEMINI_API_KEY_NOT_FOUND");
      }
      const [apiKey, apiKeyId] = apiKeys.data[Math.floor(Math.random() * apiKeys.data.length)];
      Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
      let synthMessageId = void 0;
      const synthResult = await bot.sendMessage(chatId, `🎙 Synthesizing...`, { replyToMessageId: messageId });
      if (synthResult.ok) {
        synthMessageId = synthResult.messageId;
      }
      const args = {
        chatId,
        userId,
        userMessageId: messageId,
        currentApiKey: apiKey,
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
    action: async (params) => {
      Log.info("Executing script_add command.");
      const { chatId, userId, messageId, cleanText, message } = params;
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
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
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
<b>标签:</b> <code>${cleanText}</code>`;
        const sentMsg = await bot.sendMessage(chatId, successMessage, {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
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
    action: async (params) => {
      Log.info("Executing script_remove command.");
      const { chatId, userId, messageId, cleanText } = params;
      if (!cleanText) {
        const errorMessage = ":remove [脚本标签]";
        const sentMsg = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId
        });
        if (sentMsg.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
        }
        return;
      }
      const scriptTag = `script_${userId}_${cleanText}`;
      try {
        await scriptManager.uninstallForUser(userId, scriptTag);
        const successMessage = `🗑️ 脚本删除成功！
<b>标签:</b> <code>${cleanText}</code>`;
        const sentMsg = await bot.sendMessage(chatId, successMessage, {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        const errorReply = `脚本删除失败：${errorMessage}`;
        const sentMsg = await bot.sendMessage(chatId, errorReply, {
          replyToMessageId: messageId
        });
        if (sentMsg.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
        }
      }
    }
  },
  {
    name: "script_list",
    description: "列出已安装的所有脚本",
    action: async (params) => {
      Log.info("Executing script_list command.");
      const { chatId, userId, messageId } = params;
      try {
        const scripts = await scriptManager.listForUser(userId);
        let replyText;
        if (scripts.length === 0) {
          replyText = "你还没有安装任何脚本。";
        } else {
          const scriptList = scripts.map((tag) => `  • <code>${tag.replace(`script_${userId}_`, "")}</code>`).join("\n");
          replyText = `你已安装以下脚本：
${scriptList}`;
        }
        const sentMsg = await bot.sendMessage(chatId, replyText, {
          replyToMessageId: messageId,
          parseMode: "HTML"
        });
        if (sentMsg.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 3 * 6e4);
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
    action: async (params) => {
      Log.info("Executing script_run command.");
      const { chatId, userId, messageId, cleanText, message } = params;
      if (!cleanText) {
        const errorMessage = ":run [脚本标签] [参数]";
        const sentMsg2 = await bot.sendMessage(chatId, errorMessage, {
          replyToMessageId: messageId
        });
        if (sentMsg2.ok) {
          scheduleDeletion({ chat_id: chatId, message_id: sentMsg2.messageId }, 3 * 6e4);
        }
        return;
      }
      const [tag, ...args] = cleanText.split(/\s+/);
      const scriptParam = args.join(" ");
      const scriptTag = `script_${userId}_${tag}`;
      const result = await scriptManager.runForUser(userId, scriptTag, message, scriptParam);
      let replyText;
      if (result.success) {
        replyText = `✅ <b>脚本执行成功</b> (耗时: ${result.duration > 1e3 ? (result.duration / 1e3).toFixed(2) + "s" : result.duration.toFixed(2) + "ms"})

<pre><code class="language-markdown">${result.result}</code></pre>`;
      } else {
        replyText = `❌ <b>脚本执行失败</b> (耗时:  ${result.duration > 1e3 ? (result.duration / 1e3).toFixed(2) + "s" : result.duration.toFixed(2) + "ms"})

<pre><code class="language-markdown">${result.error}</code></pre>`;
      }
      const sentMsg = await bot.sendMessage(chatId, replyText, {
        replyToMessageId: messageId,
        parseMode: "HTML"
      });
      if (sentMsg.ok) {
        scheduleDeletion({ chat_id: chatId, message_id: sentMsg.messageId }, 30 * 6e4);
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
          description: '用于搜索文件内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "路由 AND 拦截"。',
          example: "路由 AND 拦截"
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        branch: {
          type: Type.STRING,
          description: "要搜索的仓库分支，默认为仓库默认分支（如 main 或 master）。",
          default: "main",
          example: "main"
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
          description: '用于搜索提交消息内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "fix AND bug"。',
          example: "fix AND bug"
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
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
          description: '用于搜索 Issue 内容和标题的关键词，多个关键词请用 AND 或 OR 分隔，例如 "tun AND error"。',
          example: "tun AND error"
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"（开放）、"closed"（关闭），默认为 "open"。',
          default: "open",
          enum: ["open", "closed"],
          example: "open"
        }
      },
      required: ["keyword", "owner", "repo"]
    }
  }
];
const functionForList = [
  {
    name: "listRepoTree",
    description: "递归列出指定 GitHub 仓库和分支下的所有文件及其完整路径。此工具旨在辅助获取仓库的完整文件结构，用于深度分析。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Repository Tree Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        branch: {
          type: Type.STRING,
          description: "要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。",
          default: "main",
          example: "main"
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "listDirContents",
    description: "列出指定 GitHub 仓库、指定目录内的所有文件和子目录（只包含顶层内容）。此工具旨在辅助探索仓库指定目录的文件结构。",
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: "List GitHub Directory Contents Parameters",
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        path: {
          type: Type.STRING,
          description: '要列出文件和子目录的路径，默认为仓库根目录。例如 "docs/configuration/"。此路径应相对于仓库根目录。',
          default: "",
          example: "docs/configuration/"
        },
        branch: {
          type: Type.STRING,
          description: "要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。",
          default: "main",
          example: "main"
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
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        per_page: {
          type: Type.NUMBER,
          description: "每页返回的提交数量，默认为 20，最大 100。",
          default: 20,
          minimum: 1,
          maximum: 100,
          example: 20
        },
        page: {
          type: Type.NUMBER,
          description: "页码，默认为 1。",
          default: 1,
          minimum: 1,
          example: 1
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
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        per_page: {
          type: Type.NUMBER,
          description: "每页返回的发布版本数量，默认为 10，最大 100。",
          default: 10,
          minimum: 1,
          maximum: 100,
          example: 10
        },
        page: {
          type: Type.NUMBER,
          description: "页码，默认为 1。",
          default: 1,
          minimum: 1,
          example: 1
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
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
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
          description: "需要查询的文件路径列表，每次最少查询 4 个文件 ",
          items: {
            type: Type.STRING,
            title: "File Path Item",
            description: '单个文件的完整路径，格式为 "owner/repo/refs/heads/branch/path/to/file.ext"',
            example: "MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md"
          },
          minItems: "4",
          example: ["MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md", "SagerNet/sing-box/refs/heads/dev-next/src/main.go"]
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
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        commit_sha: {
          type: Type.STRING,
          description: '要查询的提交的 SHA 值，例如 "2464ced48c504eb0dee616c6d474813621779afc"。',
          example: "2464ced48c504eb0dee616c6d474813621779afc"
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
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: "SagerNet"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: "sing-box"
        },
        issue_number: {
          type: Type.NUMBER,
          description: "Issue 的编号，例如 3202。",
          example: 3202
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
          description: 'GitHub 仓库所有者，例如 "GUI-for-Cores"。',
          example: "GUI-for-Cores"
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "GUI.for.SingBox"。',
          example: "GUI.for.SingBox"
        },
        release_id: {
          type: Type.NUMBER,
          description: "发布版本的 ID，例如 227541695。如果提供，将优先使用此 ID。",
          example: 227541695,
          nullable: true
        },
        tag_name: {
          type: Type.STRING,
          description: '发布版本的标签名称，例如 "rolling-release-alpha"。如果未提供 release_id 或其查询失败，将尝试使用此标签名称。',
          example: "rolling-release-alpha",
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
          description: "用于生成图片的文本提示。",
          example: `A photorealistic [shot type] of [subject], [action or expression], set in
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
          description: `用于生成语音的文本提示，可以使用自然语言提示来控制语音的样式、语调、口音和语速。`,
          example: `Say in a helpless tone:
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
class GeminiApi {
  MAX_RETRIES_COMMON = 3;
  BASE_RETRY_DELAY_MS = 1e4;
  SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
  ];
  async _initializeApiCallContext(chatParams, initialContents) {
    const { durableResourceId, systemPromptKeyName, geminiApiKeysKeyName, modelName, modelTemperature } = config.load();
    const { chatId, userId, userMessageId, thinkMessageId } = chatParams;
    const systemPrompt = await kv.read(durableResourceId, systemPromptKeyName, "text");
    if (!systemPrompt.success) {
      throw new KvNamespaceError(`系统提示获取失败，${systemPrompt.error}`, "SYSTEM_PROMPT_NOT_FOUND");
    }
    const apiKeys = await kv.read(durableResourceId, geminiApiKeysKeyName, "json");
    if (!apiKeys.success) {
      throw new GeminiError(`无法获取 API 密钥，请检查配置，${apiKeys.error}`, "GEMINI_API_KEY_NOT_FOUND");
    }
    Log.info(`系统提示 (systemPrompt):`, { systemPrompt: systemPrompt.data.slice(0, 200) });
    const baseConfig = {
      maxOutputTokens: 65536,
      temperature: modelTemperature,
      thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
      tools: geminiTools,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO
        }
      },
      responseMimeType: "text/plain",
      safetySettings: this.SAFETY_SETTINGS,
      systemInstruction: [{ text: systemPrompt.data }]
    };
    return {
      chatId,
      userId,
      userMessageId,
      thinkMessageId,
      systemPrompt: systemPrompt.data,
      apiKeys: apiKeys.data,
      modelName,
      config: baseConfig,
      contents: [...initialContents],
      metrics: {
        apiCallSuccessCount: 0,
        totalUsageToken: 0,
        usageToolCount: 0,
        emptyReplyRetryCount: 0,
        errorRetryCount: 0,
        totalRetryCount: 0,
        startProcessTime: Date.now(),
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
      contents: context.contents.map((content) => ({
        ...content,
        parts: content.parts?.map((part) => {
          if (part.inlineData && part.inlineData.data) {
            return { ...part, inlineData: { ...part.inlineData, data: "BASE64_ENCODED_DATA" } };
          } else if (part.thoughtSignature) {
            return { ...part, thoughtSignature: "THOUGHT_SIGNATURE" };
          } else if (part.thought) {
            return { ...part, text: "THOUGHT_TEXT" };
          } else if (part.functionResponse && part.functionResponse.response?.success) {
            return {
              ...part,
              functionResponse: { ...part.functionResponse, response: { ...part.functionResponse.response, data: "FUNCTION_RESPONSE_DATA" } }
            };
          }
          return part;
        })
      }))
    });
    const newApiKeys = rotateArray(context.apiKeys);
    const [apiKey, apiKeyId] = newApiKeys[0];
    const ai = new GoogleGenAI({ apiKey });
    Log.info(`当前使用的 API 密钥: ${apiKeyId}`);
    context.apiKeys = newApiKeys;
    Log.info("发送 Gemini API 请求...");
    const response = await ai.models.generateContent({
      model: context.modelName,
      config: context.config,
      contents: context.contents
    });
    context.metrics.totalUsageToken = response.usageMetadata?.totalTokenCount && !isNaN(response.usageMetadata.totalTokenCount) ? context.metrics.totalUsageToken + response.usageMetadata.totalTokenCount : context.metrics.totalUsageToken;
    Log.info(`Gemini API 响应: `, {
      response: simpleGeminiApiResponse(response)
    });
    return response;
  }
  async _executeApiCallWithRetries(context) {
    for (let attempt = 0; attempt <= this.MAX_RETRIES_COMMON; attempt++) {
      try {
        const response = await this._callGeminiApi(context);
        return response;
      } catch (error) {
        const err = error instanceof GeminiError ? error : new GeminiError(String(error), "API_CLIENT_ERROR", context.metrics.hasToolThoughts);
        Log.error(`Gemini API 客户端或网络错误 (尝试 ${attempt + 1}/${this.MAX_RETRIES_COMMON}):`, { err });
        if (attempt < this.MAX_RETRIES_COMMON) {
          const delay = Math.floor(this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.errorRetryCount++;
          if (context.thinkMessageId !== void 0) {
            const errorRetryText = `Gemini API 客户端错误，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${attempt + 1} 次重试...`;
            await bot.editMessageText(context.chatId, context.thinkMessageId, errorRetryText);
          }
          await sleep(delay);
          Log.info(`Gemini API 客户端错误，进行第 ${attempt + 1} 次重试...`);
        } else {
          if (context.thinkMessageId) {
            await bot.deleteMessage(context.chatId, context.thinkMessageId);
          }
          const finalError = new GeminiError(
            `Gemini API 客户端错误，已达最大重试次数 (${this.MAX_RETRIES_COMMON})。

${err}`,
            "MAX_API_CLIENT_RETRIES_REACHED",
            context.metrics.hasToolThoughts
          );
          await this._writeApiKeysToKv(context.apiKeys);
          throw finalError;
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
        if (context.thinkMessageId !== void 0) {
          const displayThoughtText = `<b>Thoughts</b>:

<blockquote expandable>${escapers.Html(shortenString(thoughtTexts))}</blockquote>`;
          await bot.editMessageText(context.chatId, context.thinkMessageId, displayThoughtText, { parseMode: "HTML" });
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
        chatId: context.chatId,
        userId: context.userId,
        userMessageId: context.userMessageId,
        ...functionName?.startsWith("generate") ? { currentApiKey: context.apiKeys[0][0] } : {},
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
    const finishedTime = Date.now();
    context.metrics.totalDurationSecond = Math.round((finishedTime - context.metrics.startProcessTime) / 1e3);
    return {
      response: {
        role: "model",
        parts: textParts
      },
      totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
      apiCallSuccessCount: context.metrics.apiCallSuccessCount,
      totalUsageToken: context.metrics.totalUsageToken,
      usageToolCount: context.metrics.usageToolCount,
      totalDurationSecond: context.metrics.totalDurationSecond,
      hasToolThoughts: context.metrics.hasToolThoughts,
      emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
      errorRetryCount: context.metrics.errorRetryCount
    };
  }
  async _writeApiKeysToKv(apiKeys) {
    const { durableResourceId, geminiApiKeysKeyName } = config.load();
    try {
      await kv.write(durableResourceId, geminiApiKeysKeyName, JSON.stringify(apiKeys));
      Log.info("已将最新的 API 密钥组写入 KvNamespace。");
    } catch (error) {
      Log.error("写入 API 密钥到 kv 失败:", { error });
    }
  }
  generateContent = async (initialContents, chatParams) => {
    const { maxApiCallRounds } = config.load();
    let context;
    try {
      context = await this._initializeApiCallContext(chatParams, initialContents);
    } catch (error) {
      const err = error instanceof GeminiError ? error : new GeminiError(String(error), "INITIALIZATION_ERROR", false);
      Log.error("初始化 API 调用上下文失败:", { err });
      throw err;
    }
    let apiCallRoundCounter = 0;
    while (apiCallRoundCounter < maxApiCallRounds) {
      let response;
      try {
        response = await this._executeApiCallWithRetries(context);
      } catch (error) {
        throw error;
      }
      let candidate = response.candidates?.[0];
      let currentEmptyReplyAttempt = 0;
      while (!candidate || !candidate.content || !candidate.content.parts) {
        if (currentEmptyReplyAttempt < this.MAX_RETRIES_COMMON) {
          const delay = Math.floor(this.BASE_RETRY_DELAY_MS * Math.pow(2, currentEmptyReplyAttempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.emptyReplyRetryCount++;
          currentEmptyReplyAttempt++;
          if (context.thinkMessageId !== void 0) {
            const emptyReplyRetryText = `Gemini API 响应为空，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${currentEmptyReplyAttempt} 次重试...`;
            await bot.editMessageText(context.chatId, context.thinkMessageId, emptyReplyRetryText);
          }
          Log.warn(
            `Gemini API 返回结果不包含有效的 candidate 或 content，尝试重试 (无效回复重试 ${currentEmptyReplyAttempt}/${this.MAX_RETRIES_COMMON})。`,
            { response }
          );
          await sleep(delay);
          try {
            response = await this._executeApiCallWithRetries(context);
            candidate = response.candidates?.[0];
          } catch (error) {
            throw error;
          }
        } else {
          if (context.thinkMessageId) {
            await bot.deleteMessage(context.chatId, context.thinkMessageId);
          }
          const errorMsg2 = `Gemini API 未返回有效结果，已达最大无效回复重试次数 (${this.MAX_RETRIES_COMMON})，请稍后再重新提问。`;
          Log.error(errorMsg2);
          await this._writeApiKeysToKv(context.apiKeys);
          throw new GeminiError(errorMsg2, "MAX_EMPTY_REPLY_RETRIES_REACHED", context.metrics.hasToolThoughts);
        }
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
          await this._writeApiKeysToKv(context.apiKeys);
          return {
            response: { role: "model", parts: [{ text: "😥 抱歉，模型尝试使用工具但未能获取结果。" }] },
            ...context.metrics,
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount
          };
        }
      } else {
        const textParts = parts.filter((part) => part.text);
        if (textParts.length > 0) {
          Log.info(`Gemini API 请求成功，返回文本响应。`);
          await this._writeApiKeysToKv(context.apiKeys);
          return this._buildSuccessResponse(context, textParts);
        } else {
          Log.warn("Gemini API 返回非工具调用响应，但没有文本内容或其他可处理的 parts。", { response });
          const finishReason = candidate.finishReason;
          await this._writeApiKeysToKv(context.apiKeys);
          return {
            response: {
              role: "model",
              parts: [{ text: `😥 抱歉，未能获取有效的文本回复。Finish Reason: ${finishReason || "未知"}` }]
            },
            ...context.metrics,
            totalRetryCount: context.metrics.emptyReplyRetryCount + context.metrics.errorRetryCount,
            emptyReplyRetryCount: context.metrics.emptyReplyRetryCount,
            errorRetryCount: context.metrics.errorRetryCount
          };
        }
      }
    }
    const errorMsg = `达到最大 API 调用轮次 (${maxApiCallRounds})，未能获取最终回复。`;
    Log.error(errorMsg);
    await this._writeApiKeysToKv(context.apiKeys);
    throw new GeminiError(errorMsg, "MAX_CALL_ROUNDS_REACHED", context.metrics.hasToolThoughts);
  };
}
const genai = new GeminiApi();
const simpleGeminiApiResponse = (response) => {
  const simpleResponse = {
    ...response,
    candidates: response.candidates?.map((candidate) => ({
      ...candidate,
      content: {
        ...candidate.content,
        parts: candidate.content?.parts?.map((part) => {
          if (part.thought) {
            return { ...part, text: "THOUGHT_TEXT" };
          } else if (part.thoughtSignature) {
            return { ...part, thoughtSignature: "THOUGHT_SIGNATURE" };
          } else if (part.inlineData && part.inlineData.data) {
            return { ...part, inlineData: { ...part.inlineData, data: "BASE64_ENCODED_DATA" } };
          } else if (part.text) {
            return { ...part, text: "TEXT_CONTENT" };
          }
          return part;
        })
      }
    }))
  };
  return simpleResponse;
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
  message: err.message,
  stack: err.stack
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
class TelegramBot {
  async sendRequest(httpMethod, apiMethod, body, isFormData = false) {
    const { botApiUrl } = config.load();
    const url = `${botApiUrl}/${apiMethod}`;
    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        ...isFormData ? {} : {
          headers: {
            "Content-Type": "application/json"
          }
        },
        body: isFormData ? body : JSON.stringify(body)
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
    const shorten = `<blockquote expandable>${escapers.Html(shortenString(String(options?.caption)))}</blockquote>`;
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
  async deleteMessages(chatId, messageIds) {
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
}
const bot = new TelegramBot();
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
const DELETE_ROW = [
  {
    text: "🗑 删除消息",
    callback_data: "delete_message_USER_ID"
  }
];
const BASE_INLINE_KEYBOARD = [REACTiON_ROW, DELETE_ROW];
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
    const { owner, repo, path = "", branch = "main" } = args;
    const cleanedPath = path.startsWith("/") ? path.substring(1) : path;
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
    Log.info("执行工具: sendPhotoMessage，参数:", { args: { ...args, currentApiKey: "***" } });
    const { chatId, userId, userMessageId, currentApiKey, prompt } = args;
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
      const response = await callMultiModalModels(currentApiKey, modelName, modelConfig, contents);
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
      void scheduleDeletion({ chat_id: chatId, message_id: result.messageId }, 24 * 60 * 60 * 1e3);
      return { success: true, data: "Image generate and reply message successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
  generateSpeech: async (args) => {
    Log.info("执行工具: sendVoiceMessage，参数:", { args: { ...args, currentApiKey: "***" } });
    const { chatId, userId, userMessageId, currentApiKey, prompt } = args;
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
      const response = await callMultiModalModels(currentApiKey, modelName, modelConfig, contents);
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
      void scheduleDeletion({ chat_id: chatId, message_id: result.messageId }, 24 * 60 * 60 * 1e3);
      return { success: true, data: "Speech generate and reply message successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }
};
const callMultiModalModels = async (apiKey, model, modelConfig, contents) => {
  const ai = new GoogleGenAI({ apiKey });
  const config2 = {
    ...modelConfig,
    safetySettings: genai.SAFETY_SETTINGS
  };
  Log.info("发送 Gemini API 请求...");
  Log.info("当前发送的 contents:", { contents });
  const response = await ai.models.generateContent({ model, contents, config: config2 });
  Log.info(`Gemini API 响应: `, {
    response: simpleGeminiApiResponse(response)
  });
  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new GeminiError("Gemini API 返回结果不包含有效的内容", "INVALID_RESPONSE");
  }
  return candidate.content;
};
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
    await targetCommand.action({
      chatId: chat.id,
      userId: from?.id,
      messageId,
      cleanText,
      message
    });
  }
};
const downloadFileAsArrayBuffer = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(`Failed to download file: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileSizeInBytes = arrayBuffer.byteLength;
    let displaySize;
    let displayUnit;
    if (fileSizeInBytes >= 1024 * 1024) {
      displaySize = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
      displayUnit = "MB";
    } else {
      displaySize = (fileSizeInBytes / 1024).toFixed(2);
      displayUnit = "KB";
    }
    Log.info(`Successfully downloaded file. Size: ${displaySize} ${displayUnit}`);
    return arrayBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Log.error(`Error downloading file from ${url}:`);
    throw new AppError(errorMessage, "FILE_DOWNLOAD_ERROR");
  }
};
const handleImage = async (image) => {
  const { botToken } = config.load();
  const { file_id } = image[image.length - 1];
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const imageArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64ImageData = Buffer.from(imageArrayBuffer).toString("base64");
    return { data: base64ImageData, mimeType: "image/jpeg" };
  }
};
const SUPPORTED_MIME_TYPES = [
  "text/html",
  "text/css",
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/javascript",
  "text/x-javascript",
  "application/json",
  "application/yaml",
  "application/javascript",
  "application/x-javascript",
  "application/x-shellscript",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/mpeg"
];
const handleDocument = async (document) => {
  const { botToken } = config.load();
  const { file_id, mime_type } = document;
  let universalMimeType = void 0;
  if (!SUPPORTED_MIME_TYPES.includes(String(mime_type))) {
    if (mime_type?.startsWith("text/")) {
      universalMimeType = "text/plain";
    } else if (mime_type?.startsWith("application/") && !isBinaryApplicationMime(mime_type, { defaultToBinary: true })) {
      universalMimeType = "text/plain";
    } else if (mime_type?.startsWith("image/")) {
      universalMimeType = "image/jpeg";
    } else if (mime_type?.startsWith("video/")) {
      universalMimeType = "video/mp4";
    } else {
      throw new AppError(`不支持的文件类型: ${mime_type || "未知"}`, "FILE_TYPE_NOT_SUPPORTED");
    }
  }
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString("base64");
    return { data: base64DocumentData, mimeType: universalMimeType ? universalMimeType : mime_type };
  }
};
const isBinaryApplicationMime = (mime, opts) => {
  const defaultToBinary = opts?.defaultToBinary ?? true;
  if (!mime || typeof mime !== "string") return defaultToBinary;
  const clean = mime.split(";")[0].trim().toLowerCase();
  if (!clean.startsWith("application/")) {
    return defaultToBinary;
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
    const parts = subtype.split("+");
    const suffix = parts[parts.length - 1];
    if (["json", "xml", "javascript", "ecmascript", "xhtml+xml"].includes(suffix)) return false;
    if (["zip", "gzip", "tar", "pdf", "wasm", "octet-stream", "x-xz", "x-bzip2"].includes(suffix)) return true;
  }
  if (subtype.startsWith("vnd.")) return true;
  return defaultToBinary;
};
const handleVideo = async (video) => {
  const { botToken } = config.load();
  const { file_id } = video;
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const videoArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64VideoData = Buffer.from(videoArrayBuffer).toString("base64");
    return { data: base64VideoData, mimeType: "video/mp4" };
  }
};
const handleFile = async (message) => {
  const { document, photo, video } = message;
  if (photo) {
    const imageData = await handleImage(photo);
    if (imageData) return imageData;
  } else if (document) {
    const documentData = await handleDocument(document);
    if (documentData) return documentData;
  } else if (video) {
    const videoData = await handleVideo(video);
    if (videoData) return videoData;
  }
  return;
};
const containsFile = (message) => {
  return message ? message.document || message.photo || message.video ? true : false : false;
};
const extractMessageParts = async (message, botName) => {
  const parts = [];
  let messageText = message.text || message.caption || "";
  messageText = messageText.replace(`@${botName}`, "").trim();
  if (containsFile(message)) {
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
  parts.push({ text: messageText ? messageText : "你好！" });
  return parts;
};
class MentionHandler {
  async handleRateLimiting(message, adminId) {
    const { message_id: userMessageId, from, chat } = message;
    const checkResult = await rateLimiterCheck(chat.id);
    if (!checkResult.canProceed && from?.id !== adminId) {
      Log.info(`Rate limit exceeded for chat ${chat.id}. Retry after ${checkResult.retryAfterSeconds} seconds.`);
      const rateLimitResult = await bot.sendMessage(chat.id, `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`, {
        replyToMessageId: userMessageId
      });
      if (rateLimitResult.ok) {
        void scheduleDeletion({ chat_id: chat.id, message_id: rateLimitResult.messageId }, checkResult.retryAfterSeconds * 1e3);
      }
      return true;
    }
    return false;
  }
  async sendFileUploadMessage(message, replyToMessage, chatId, userMessageId) {
    if (containsFile(message) || containsFile(replyToMessage)) {
      const uploadingResult = await bot.sendMessage(chatId, "📄 File uploading...", {
        replyToMessageId: userMessageId
      });
      return uploadingResult.ok ? uploadingResult.messageId : null;
    }
    return null;
  }
  async buildCompleteContents(chatId, fromUserId, currentMessage, botName) {
    const historyChatContents = await contexts.get(chatId, fromUserId);
    const completeContents = [...historyChatContents];
    let currentMessageCopy = { ...currentMessage };
    if (currentMessage.reply_to_message) {
      if (currentMessage.quote?.text) {
        const quotedContents = `Quoted: "${currentMessage.quote.text}"

${currentMessage.text || currentMessage.caption}`;
        currentMessageCopy = { ...currentMessage, text: quotedContents };
      }
      const replyToParts = await extractMessageParts(currentMessage.reply_to_message, botName);
      if (replyToParts.length > 0) {
        const replyRole = currentMessage.reply_to_message.from?.username === botName ? "model" : "user";
        completeContents.push({
          role: replyRole,
          parts: replyToParts
        });
      }
    }
    const currentParts = await extractMessageParts(currentMessageCopy, botName);
    if (currentParts.length > 0) {
      completeContents.push({
        role: "user",
        parts: currentParts
      });
    }
    if (completeContents.length === 0) {
      throw new TelegramError("未能从消息中提取到有效内容，请检查消息格式。");
    }
    return completeContents;
  }
  async sendThinkingMessage(chatId, userMessageId) {
    const thinkingResult = await bot.sendMessage(chatId, "✨ Thinking...", {
      replyToMessageId: userMessageId
    });
    if (!thinkingResult.ok) {
      Log.error("Failed to send thinking message.");
      throw new TelegramError("Failed to send thinking message.");
    }
    return thinkingResult.messageId;
  }
  async processGeminiResponse(geminiResponse, chatId, userMessageId, thinkMessageId, botName, modelName, fromUserId, completeContentsBeforeCall) {
    let hasDisplayedThoughts = false;
    const {
      response,
      apiCallSuccessCount,
      totalRetryCount,
      totalUsageToken,
      usageToolCount,
      totalDurationSecond,
      hasToolThoughts,
      emptyReplyRetryCount,
      errorRetryCount
    } = geminiResponse;
    const resThoughtParts = response.parts?.filter((part) => part.text && part.thought);
    const resThoughtTexts = resThoughtParts?.map((part) => part.text).join("").trim();
    if (resThoughtTexts) {
      hasDisplayedThoughts = true;
      const displayThoughtText = `<b>Thoughts</b>:

<blockquote expandable>${escapers.Html(shortenString(resThoughtTexts))}</blockquote>`;
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(fromUserId)
      };
      await bot.editMessageText(chatId, thinkMessageId, displayThoughtText, { parseMode: "HTML", replyMarkup });
    }
    if (!hasToolThoughts && !hasDisplayedThoughts) {
      await bot.deleteMessage(chatId, thinkMessageId);
    } else {
      void scheduleDeletion({ chat_id: chatId, message_id: thinkMessageId }, 30 * 6e4);
    }
    const resTextParts = response.parts?.filter((part) => part.text && !part.thought);
    const resTexts = resTextParts?.map((part) => part.text).join("").trim() || "";
    if (!resTexts) {
      const replyText = "Gemini API 未返回有效文本回复：模型可能只生成了工具调用或思考内容。";
      const replyMarkup = {
        inline_keyboard: makeInlineKeyboard(fromUserId)
      };
      const replyResult = await bot.sendMessage(chatId, replyText, {
        replyToMessageId: userMessageId,
        replyMarkup
      });
      if (replyResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: replyResult.messageId }, 3 * 60 * 1e3);
      }
      return hasDisplayedThoughts;
    }
    const fullText = `🤖 模型：\`${modelName}\`

${resTexts}

✨ 本次任务共成功调用 Gemini API ${apiCallSuccessCount} 次，${totalRetryCount} 次重试：无效回复 ${emptyReplyRetryCount} 次，客户端错误 ${errorRetryCount} 次，使用工具数：${usageToolCount}，耗时：${totalDurationSecond} 秒，消耗 Token：${totalUsageToken}

⚠ 本 AI 回答仅供参考，可能存在不准确之处，请您自行判断。`;
    const finalReplyResult = await sendFormattedMessage(chatId, fullText, userMessageId, fromUserId);
    if (!finalReplyResult.ok) {
      throw finalReplyResult.error;
    }
    if (resTexts) {
      const botResponseContent = {
        role: "model",
        parts: response.parts
      };
      await contexts.update(chatId, fromUserId, [
        ...completeContentsBeforeCall,
        botResponseContent
      ]);
    }
    return hasDisplayedThoughts;
  }
  async handleMention(message, isChat = false) {
    const { modelName, botName, adminId } = config.load();
    const { message_id: userMessageId, from, chat, reply_to_message } = message;
    Log.info("Handling mention message.", {
      chatId: chat.id,
      messageId: userMessageId,
      isChatMode: isChat
    });
    if (await this.handleRateLimiting(message, adminId)) {
      return;
    }
    let fileUploadMessageId = null;
    let thinkMessageId = null;
    let completeContents = [];
    let hasResThought = false;
    try {
      fileUploadMessageId = await this.sendFileUploadMessage(message, reply_to_message, chat.id, userMessageId);
      completeContents = await this.buildCompleteContents(chat.id, from?.id, message, botName);
      if (fileUploadMessageId) {
        await sleep(3e3);
        await bot.deleteMessage(chat.id, fileUploadMessageId);
        fileUploadMessageId = null;
      }
      thinkMessageId = await this.sendThinkingMessage(chat.id, userMessageId);
      const geminiResponse = await genai.generateContent(completeContents, {
        chatId: chat.id,
        userId: from?.id,
        userMessageId,
        thinkMessageId
      });
      hasResThought = await this.processGeminiResponse(
        geminiResponse,
        chat.id,
        userMessageId,
        thinkMessageId,
        botName,
        modelName,
        from?.id,
        completeContents
      );
    } catch (apiError) {
      Log.error("Error during Gemini API call or response processing.", {
        err: apiError,
        chatId: chat.id,
        messageId: userMessageId
      });
      if (fileUploadMessageId) {
        await bot.deleteMessage(chat.id, fileUploadMessageId);
      }
      if (thinkMessageId) {
        const err = apiError instanceof GeminiError ? apiError : void 0;
        if (!err?.hasToolThoughts && !hasResThought) {
          await bot.deleteMessage(chat.id, thinkMessageId);
        } else {
          void scheduleDeletion({ chat_id: chat.id, message_id: thinkMessageId }, 30 * 6e4);
        }
      }
      throw apiError;
    }
  }
}
const mention = new MentionHandler();
const handleMention = mention.handleMention;
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
      const replaceText = newMemberWelcome.data.replace("NEW_MEMBER_MENTION", newMemberMention).replace("CHAT_TITLE", chat.title).replace("BOT_NAME", botName).trim();
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
      const welcomeResult = await bot.sendMessage(chat.id, formatters.Html(replaceText), {
        replyToMessageId: message_id,
        parseMode: "HTML",
        replyMarkup
      });
      if (welcomeResult.ok) {
        void scheduleDeletion({ chat_id: chat.id, message_id: welcomeResult.messageId }, 3 * 6e4);
      }
    } else {
      Log.warn(`新成员 ${newMember.first_name}(${newMember.id}) 未通过验证或超时，不发送欢迎消息。`, { chatId: chat.id, newMemberId: newMember.id });
    }
  }
};
const handleNormal = async (message) => {
  const { botName } = config.load();
  if (message.text?.startsWith(":") || message.caption?.startsWith(":")) {
    const { message_id: messageId, text, caption, from, chat: chat2 } = message;
    const messageText = text || caption || "";
    const [commandAlias, ...cleanText] = messageText.replace(":", "").split(" ");
    const commandAction = BotCommands.find(
      (command) => command.name === commandAlias || command.name === `script_${commandAlias}` || command.name === `gen_${commandAlias}`
    );
    if (commandAction) {
      Log.info("Handling commands message...", { chatId: chat2.id, messageId });
      return await commandAction.action({
        chatId: chat2.id,
        userId: from?.id,
        messageId,
        cleanText: cleanText.join(" ").trim(),
        message
      });
    }
  }
  if (!message.reply_to_message) return;
  const { chat, message_id, reply_to_message } = message;
  if (!reply_to_message.from || reply_to_message.from.username !== botName) return;
  Log.info("Handling normal message.", { chatId: chat.id, messageId: message_id });
  let cleanMessage = { ...message };
  if (reply_to_message.text) {
    if (reply_to_message.text.includes("🤖 模型：") || reply_to_message.text.includes("✨ 本次任务")) {
      const cleanMessageTexts = reply_to_message.text.replace(/^🤖 模型：.*?\n+/g, "").replace(/✨ 本次任务[\s\S]*$/m, "");
      cleanMessage = { ...message, reply_to_message: { ...reply_to_message, text: cleanMessageTexts } };
    }
  }
  return await handleMention(cleanMessage, true);
};
const handleCallbackQuery = async (callbackQuery) => {
  if (!callbackQuery.message || !callbackQuery.data) {
    Log.info("Invalid callback query", { queryId: callbackQuery.id });
    return;
  }
  const { durableResourceId, rateLimitId } = config.load();
  const { id: queryId, from, message, data } = callbackQuery;
  const { chat, message_id: messageId, date, reply_to_message, reply_markup } = message;
  Log.info("Handling callback query", { chatId: chat.id, messageId, userId: from.id, data });
  switch (true) {
    case data === "PLACEHOLDER": {
      bot.answerCallbackQuery(queryId);
      break;
    }
    case data.startsWith("mention_"): {
      const [, , allowUserId] = data.split("_");
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: "你没有权限进行此操作" });
        return;
      }
      bot.answerCallbackQuery(queryId, { callbackText: "询问请求..." });
      const newMessageText = "简单说明下你能做什么？";
      const newMessage = { ...message, message_id: reply_to_message?.message_id || messageId, from, text: newMessageText };
      delete newMessage.reply_to_message;
      await handleMention(newMessage);
      break;
    }
    case data.startsWith("tool_"): {
      const [, action, tool, allowUserId] = data.split("_");
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: "你没有权限进行此操作" });
        return;
      }
      if (action === "demo") {
        bot.answerCallbackQuery(queryId, { callbackText: "开始演示工具..." });
        const newText = `请简单演示下 ${tool} 工具`;
        const newMessage = { ...message, message_id: reply_to_message?.message_id || messageId, from, text: newText };
        delete newMessage.reply_to_message;
        await handleMention(newMessage);
      }
      break;
    }
    case data.startsWith("cmd_"): {
      const [, command, allowUserId] = data.split("_");
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: "你没有权限进行此操作" });
        return;
      }
      bot.answerCallbackQuery(queryId, { callbackText: "开始执行..." });
      const targetCommand = BotCommands.find((cmd) => cmd.name === command);
      if (targetCommand) {
        await targetCommand.action({
          chatId: chat.id,
          messageId,
          userId: Number(allowUserId),
          isCallback: true
        });
      }
      break;
    }
    case data.startsWith("reaction_"): {
      const reaction = data.split("_")[1];
      const keyName = `reacted_${chat.id}_${messageId}`;
      const reactedUsers = await kv.read(rateLimitId, keyName, "json");
      if (!reactedUsers.success || reactedUsers.data.includes(from.id)) {
        bot.answerCallbackQuery(queryId, {
          callbackText: "你已做出过反应"
        });
        return;
      }
      bot.answerCallbackQuery(queryId, { callbackText: "反应成功" });
      const newReactedUsers = [...reactedUsers.data, from.id];
      await kv.write(rateLimitId, keyName, JSON.stringify(newReactedUsers), { expiration_ttl: 48 * 60 * 60 });
      const newInlineKeyboard = JSON.parse(JSON.stringify(reply_markup?.inline_keyboard));
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
        await bot.editMessageReplyMarkup(chat.id, messageId, {
          inline_keyboard: newInlineKeyboard
        });
      }
      const totalReactionsKeyName = `total_reactions_${chat.id}`;
      const oldTotalReactions = await kv.read(durableResourceId, totalReactionsKeyName, "json");
      if (!oldTotalReactions.success) return;
      const newTotalReactions = {
        like: reaction === "like" ? oldTotalReactions.data.like + 1 : oldTotalReactions.data.like,
        dislike: reaction === "dislike" ? oldTotalReactions.data.dislike + 1 : oldTotalReactions.data.dislike
      };
      await kv.write(durableResourceId, totalReactionsKeyName, JSON.stringify(newTotalReactions));
      break;
    }
    case data.startsWith("delete_"): {
      const [, content, allowUserId] = data.split("_");
      if (from.id !== Number(allowUserId)) {
        bot.answerCallbackQuery(queryId, { callbackText: "你没有权限进行此操作" });
        return;
      }
      if (content === "message") {
        if (Date.now() - date * 1e3 <= 30 * 60 * 1e3) {
          bot.answerCallbackQuery(queryId, { callbackText: "消息锁定中，无法删除" });
          return;
        }
        bot.answerCallbackQuery(queryId, { callbackText: "删除成功" });
        await bot.deleteMessage(chat.id, messageId);
      }
      break;
    }
  }
};
const handleUpdate = async (update) => {
  Log.info("Handling Telegram update", { update: simpleUpdateLog(update) });
  const { botName, allowGroups } = config.load();
  if (update.callback_query) {
    const { callback_query } = update;
    if (callback_query && callback_query.message && callback_query.data) return await handleCallbackQuery(callback_query);
  }
  if (!update.message) return;
  const { update_id, message } = update;
  if (message.sticker) return;
  const { message_id, chat } = message;
  if (!allowGroups.includes(chat.id) || chat.type === "private") return;
  if (message.new_chat_members && message.new_chat_members.length > 0) return await handleNewMember(message);
  const messageText = message.text || message.caption || null;
  const messageEntities = message.entities || message.caption_entities || null;
  if (!messageEntities || !messageText) return await handleNormal(message);
  try {
    for (const entity of messageEntities) {
      if (entity.type === "mention" || entity.type === "text_mention") {
        const mentionedText = messageText.substring(entity.offset, entity.offset + entity.length);
        if (mentionedText === `@${botName}`) {
          return await handleMention(message);
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
            return await handleCommand(message);
          }
        }
      }
    }
  } catch (error) {
    const err = error;
    Log.error("Error while handling update", { err, updateId: update_id });
    await sendErrorNotification(err, `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const shorten = `<blockquote expandable>${escapers.Html(shortenString(`❌ ${errorMessage}`))}</blockquote>`;
    const replyMarkup = {
      inline_keyboard: [REACTiON_ROW]
    };
    const errorResult = await bot.sendMessage(chat.id, shorten, { replyToMessageId: message_id, parseMode: "HTML", replyMarkup });
    if (errorResult.ok) {
      void scheduleDeletion({ chat_id: chat.id, message_id: errorResult.messageId }, 3 * 6e4);
    }
  }
};
const simplifyMessage = (message) => {
  if (!message) {
    return void 0;
  }
  const truncate = (text) => text ? `${text.slice(0, 20)}...` : void 0;
  const filterEntity = (entities) => entities ? entities?.filter((e) => ["text_mention", "mention", "bot_command"].includes(e.type)) : void 0;
  const simplified = { ...message };
  if (simplified.text) {
    simplified.text = truncate(simplified.text);
  } else if (simplified.caption) {
    simplified.caption = truncate(simplified.caption);
  }
  if (simplified.entities) {
    simplified.entities = filterEntity(simplified.entities);
  } else if (simplified.caption_entities) {
    simplified.caption_entities = filterEntity(simplified.caption_entities);
  }
  if (simplified.reply_to_message) {
    simplified.reply_to_message = simplifyMessage(simplified.reply_to_message);
  }
  if (simplified.reply_markup?.inline_keyboard) {
    simplified.reply_markup = {
      ...simplified.reply_markup,
      inline_keyboard: [simplified.reply_markup.inline_keyboard[0]]
    };
  }
  return simplified;
};
const simpleUpdateLog = (update) => {
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
        handleUpdate(update);
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
