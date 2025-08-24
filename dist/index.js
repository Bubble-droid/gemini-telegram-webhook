import Fastify from "fastify";
import { isIP } from "node:net";
import process$1 from "node:process";
import { randomBytes } from "node:crypto";
import { Type, Behavior, HarmBlockThreshold, HarmCategory, FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import { Logger } from "tslog";
import Cloudflare from "cloudflare";
const LOGGER_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];
class BotConfig {
  static DEFAULT_LISTEN_HOST = "127.0.0.1";
  static DEFAULT_LISTEN_PORT = 39001;
  static DEFAULT_LOGGER_LEVEL = "info";
  static DEFAULT_MODEL_NAME = "gemini-2.5-flash";
  static DEFAULT_CONTEXT_EXPIRATION_DAY = 7;
  static DEFAULT_MAX_CONTEXT_LENGTH = 8;
  static DEFAULT_REQUEST_INTERVAL_SECOND = 30;
  static DEFAULT_MAX_API_CALL_ROUNDS = 12;
  static DEFAULT_SYSTEM_PROMPT_KEY_NAME = "system_prompt";
  static DEFAULT_GEMINI_API_KEYS_KEY_NAME = "gemini_api_keys";
  static DEFAULT_START_REPLY_TEXT_KEY_NAME = "start_reply_text";
  static DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME = "new_member_welcome_text";
  static REQUIRED_ENV_VARS = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "SCHEDULER_API_URL",
    "SCHEDULER_API_TOKEN",
    "DURABLE_RESOURCE_NAMESPACE_ID",
    "SYSTEM_PROMPT_KEY_NAME",
    "GEMINI_API_KEYS_KEY_NAME",
    "RATE_LIMIT_NAMESPACE_ID",
    "CHAT_CONTEXT_NAMESPACE_ID",
    "GITHUB_ACCESS_TOKEN",
    "WEBHOOK_SECRET_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_USERNAME",
    "TELEGRAM_BOT_ADMIN_ID",
    "ALLOWED_USAGE_GROUPS"
  ];
  static parseListenHost = (val, fallback = BotConfig.DEFAULT_LISTEN_HOST) => {
    if (!val || val.trim() === "") {
      return fallback;
    }
    const host = val.trim();
    if (isIP(host) === 0) {
      throw new ConfigError(`环境变量 SERVER_LISTEN_HOST 无效："${host}" 不是有效的 IPv4 或 IPv6 地址`);
    }
    return host;
  };
  static parsePort = (val, fallback = BotConfig.DEFAULT_LISTEN_PORT) => {
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
  static parseLoggerLevel = (val, fallback = BotConfig.DEFAULT_LOGGER_LEVEL) => {
    if (!val || val.trim() === "") {
      return fallback;
    }
    const trimmedVal = val.trim().toLowerCase();
    if (LOGGER_LEVELS.includes(trimmedVal)) {
      return trimmedVal;
    }
    throw new ConfigError(`环境变量 SERVER_LOGGER_LEVEL 非法："${val.trim()}"。可选值为 ${LOGGER_LEVELS.join(", ")}`);
  };
  static load = () => {
    const ENV = process$1.env;
    const missing = BotConfig.REQUIRED_ENV_VARS.filter(
      (k) => !ENV[k] || ENV[k].trim() === ""
    );
    if (missing.length > 0) {
      throw new ConfigError(`缺少必要环境变量：${missing.join(", ")}`);
    }
    const listenHost = BotConfig.parseListenHost(ENV.SERVER_LISTEN_HOST);
    const listenPort = BotConfig.parsePort(ENV.SERVER_LISTEN_PORT);
    const loggerLevel = BotConfig.parseLoggerLevel(ENV.SERVER_LOGGER_LEVEL);
    const modelName = ENV.GEMINI_MODEL_NAME || BotConfig.DEFAULT_MODEL_NAME;
    const maxApiCallRounds = Number(ENV.MAX_API_CALL_ROUNDS) || BotConfig.DEFAULT_MAX_API_CALL_ROUNDS;
    const cloudflareToken = ENV.CLOUDFLARE_API_TOKEN;
    const cloudflareAccountId = ENV.CLOUDFLARE_ACCOUNT_ID;
    const schedulerApiUrl = ENV.SCHEDULER_API_URL;
    const schedulerApiToken = ENV.SCHEDULER_API_TOKEN;
    const durableResourceId = ENV.DURABLE_RESOURCE_NAMESPACE_ID;
    const systemPromptKeyName = ENV.SYSTEM_PROMPT_KEY_NAME || BotConfig.DEFAULT_SYSTEM_PROMPT_KEY_NAME;
    const geminiApiKeysKeyName = ENV.GEMINI_API_KEYS_KEY_NAME || BotConfig.DEFAULT_GEMINI_API_KEYS_KEY_NAME;
    const startReplyTextKeyName = ENV.START_REPLY_TEXT_KEY_NAME || BotConfig.DEFAULT_START_REPLY_TEXT_KEY_NAME;
    const newMemberWelcomeTextKeyName = ENV.NEW_MEMBER_WELCOME_TEXT_KEY_NAME || BotConfig.DEFAULT_NEW_MEMBER_WELCOME_TEXT_KEY_NAME;
    const rateLimitId = ENV.RATE_LIMIT_NAMESPACE_ID;
    const chatContextId = ENV.CHAT_CONTEXT_NAMESPACE_ID;
    const contextsExpirationSecond = (Number(ENV.CONTEXT_EXPIRATION_DAY) || BotConfig.DEFAULT_CONTEXT_EXPIRATION_DAY) * 24 * 60 * 60;
    const maxContextLength = Number(ENV.MAX_CONTEXT_LENGTH) || BotConfig.DEFAULT_MAX_CONTEXT_LENGTH;
    const requestIntervalSecond = Number(ENV.REQUEST_INTERVAL_SECOND) || BotConfig.DEFAULT_REQUEST_INTERVAL_SECOND;
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
const escapeMarkdownV2Text = (str) => {
  return str.replace(/([_*[\]()~`>#+-=|{}.!\\])/g, "\\$1");
};
const escapeMarkdownV2Code = (str) => {
  return str.replace(/([`\\])/g, "\\$1");
};
const escapeMarkdownV2LinkUrl = (str) => {
  return str.replace(/([)\\])/g, "\\$1");
};
const escapeHtml = (str) => {
  return str.replace(/[<>&"]/g, (c) => {
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
const escapeMarkdownLegacyText = (str) => {
  return str.replace(/([_*`[\\])/g, "\\$1");
};
const escapeMarkdownLegacyLinkUrl = (str) => {
  return str;
};
const formatToMarkdownV2 = (markdownText) => {
  let processedText = markdownText;
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`\`\`${lang}
${escapedCode}\`\`\``;
  });
  processedText = processedText.replace(/`(.*?)`/g, (match, code) => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`${escapedCode}\``;
  });
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
    const escapedText = escapeMarkdownV2Text(text);
    const escapedUrl = escapeMarkdownV2LinkUrl(url);
    return `[${escapedText}](${escapedUrl})`;
  });
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content) => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `||${escapedContent}||`;
  });
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content) => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `~${escapedContent}~`;
  });
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `*${escapedContent}*`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content) => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `__${escapedContent}__`;
  });
  processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content) => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `_${escapedContent}_`;
  });
  processedText = processedText.replace(/^>>\s*(.*)$/gm, (match, content) => {
    return `> ${content}`;
  });
  processedText = processedText.replace(/^>\s*(.*)$/gm, (match, content) => {
    return `> ${content}`;
  });
  return processedText;
};
const formatToHtml = (markdownText) => {
  let processedText = markdownText;
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    if (lang) {
      return `<pre><code class="language-${escapeHtml(lang)}">${code}</code></pre>`;
    }
    return `<pre>${code}</pre>`;
  });
  processedText = processedText.replace(/`(.*?)`/g, (match, code) => {
    const escapedCode = escapeHtml(code);
    return `<code>${escapedCode}</code>`;
  });
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
    const escapedText = escapeHtml(text);
    const escapedUrl = escapeHtml(url);
    return `<a href="${escapedUrl}">${escapedText}</a>`;
  });
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content) => {
    const escapedContent = escapeHtml(content);
    return `<span class="tg-spoiler">${escapedContent}</span>`;
  });
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content) => {
    const escapedContent = escapeHtml(content);
    return `<s>${escapedContent}</s>`;
  });
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    const escapedContent = escapeHtml(content);
    return `<b>${escapedContent}</b>`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content) => {
    const escapedContent = escapeHtml(content);
    return `<u>${escapedContent}</u>`;
  });
  processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content) => {
    const escapedContent = escapeHtml(content);
    return `<i>${escapedContent}</i>`;
  });
  const lines = processedText.split("\n");
  const finalLines = [];
  let currentBlockquote = [];
  let isExpandableBlockquote = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(">> ")) {
      if (currentBlockquote.length === 0) {
        isExpandableBlockquote = true;
      } else if (!isExpandableBlockquote) {
        finalLines.push(`<blockquote>${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = true;
      }
      currentBlockquote.push(line.substring(3));
    } else if (line.startsWith("> ")) {
      if (currentBlockquote.length === 0) {
        isExpandableBlockquote = false;
      } else if (isExpandableBlockquote) {
        finalLines.push(`<blockquote expandable>${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = false;
      }
      currentBlockquote.push(line.substring(2));
    } else {
      if (currentBlockquote.length > 0) {
        const tag = isExpandableBlockquote ? "<blockquote expandable>" : "<blockquote>";
        finalLines.push(`${tag}${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = false;
      }
      finalLines.push(line);
    }
  }
  if (currentBlockquote.length > 0) {
    const tag = isExpandableBlockquote ? "<blockquote expandable>" : "<blockquote>";
    finalLines.push(`${tag}${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
  }
  processedText = finalLines.join("\n");
  return processedText;
};
const formatToMarkdownLegacy = (markdownText) => {
  let processedText = markdownText;
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = escapeMarkdownLegacyText(code);
    return `\`\`\`${lang}
${escapedCode}\`\`\``;
  });
  processedText = processedText.replace(/`(.*?)`/g, (match, code) => {
    const escapedCode = escapeMarkdownLegacyText(code);
    return `\`${escapedCode}\``;
  });
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
    const linkText = escapeMarkdownLegacyText(text);
    const linkUrl = escapeMarkdownLegacyLinkUrl(url);
    return `[${linkText}](${linkUrl})`;
  });
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    const innerContent = escapeMarkdownLegacyText(content);
    return `*${innerContent}*`;
  });
  processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content) => {
    const innerContent = escapeMarkdownLegacyText(content);
    return `_${innerContent}_`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content) => {
    return escapeMarkdownLegacyText(content);
  });
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content) => {
    return escapeMarkdownLegacyText(content);
  });
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content) => {
    return escapeMarkdownLegacyText(content);
  });
  processedText = processedText.replace(/^>>\s*(.*)$/gm, (match, content) => {
    return escapeMarkdownLegacyText(content);
  });
  processedText = processedText.replace(/^>\s*(.*)$/gm, (match, content) => {
    return escapeMarkdownLegacyText(content);
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
function formatText(text, parseMode) {
  if (parseMode === null) {
    return escapeHtml(text);
  }
  switch (parseMode) {
    case "HTML":
      return formatToHtml(text);
    case "MarkdownV2":
      return formatToMarkdownV2(text);
    case "Markdown":
      return formatToMarkdownLegacy(text);
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
      case "i":
      case "em":
        return "<i>";
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
      case "mv2_italic":
        return "_";
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
      case "legacy_italic":
        return "_";
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
      case "i":
      case "em":
        return "</i>";
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
      case "mv2_italic":
        return "_";
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
      case "legacy_italic":
        return "_";
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
          "i",
          "em",
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
          _: "mv2_italic",
          "~": "mv2_strikethrough",
          "`": "mv2_code_inline",
          "[": "mv2_link",
          ")": "mv2_link_end",
          "> ": "mv2_blockquote"
        };
        const legacyMarkersMap = {
          "```": "legacy_code_block",
          "*": "legacy_bold",
          _: "legacy_italic",
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
            } else if (marker === "`" || marker === "*" || marker === "_" || parseMode === "MarkdownV2" && marker === "~") {
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
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    while ((match = codeBlockRegex.exec(formattedText)) !== null) {
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
  const { schedulerApiUrl, schedulerApiToken } = BotConfig.load();
  const name = `${action}-${secureHex(8)}`;
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
const sendFormattedMessage = async (chatId, standardMarkdownText, replyToMessageId) => {
  const modesToTry = ["HTML", "MarkdownV2", "Markdown", null];
  let lastMessageId = void 0;
  let lastError = null;
  let currentReplyTo = replyToMessageId;
  let originalTextSentLength = 0;
  try {
    for (const mode of modesToTry) {
      Log.info(`尝试使用 ${mode === null ? "纯文本" : mode} 格式处理剩余文本...`);
      const remainingOriginalText = standardMarkdownText.substring(originalTextSentLength);
      if (remainingOriginalText.length === 0) {
        Log.info(`剩余原始文本已发送完毕.`);
        if (lastMessageId) {
          return { ok: true, messageId: lastMessageId };
        } else {
          return { ok: true, messageId: void 0 };
        }
      }
      let formattedText;
      try {
        formattedText = formatText(remainingOriginalText, mode);
      } catch (e) {
        Log.error(`格式化剩余文本为 ${mode === null ? "纯文本" : mode} 失败:`, { err: e });
        lastError = e;
        continue;
      }
      const rawChunks = splitFormattedText(formattedText, mode);
      Log.info(`格式化后的剩余文本被分割成 ${rawChunks.length} 块.`);
      let modeSuccessForRemaining = true;
      let chunkIndex = 0;
      let inheritedOpenTags = [];
      while (chunkIndex < rawChunks.length) {
        const rawChunk = rawChunks[chunkIndex];
        const { balancedChunk, nextInheritedOpenTags } = balanceChunkTags(rawChunk, mode, inheritedOpenTags);
        inheritedOpenTags = nextInheritedOpenTags;
        Log.info(
          `发送第 ${originalTextSentLength + chunkIndex + 1} 条消息 (当前块 ${chunkIndex + 1}/${rawChunks.length}, 长度: ${balancedChunk.length})...`
        );
        if (balancedChunk.trim().length === 0) {
          Log.info(`跳过发送空消息块 (格式: ${mode === null ? "纯文本" : mode}).`);
          originalTextSentLength += rawChunk.length;
          chunkIndex++;
          lastError = null;
          continue;
        }
        const sendResult = await TelegramBot.sendMessage(chatId, balancedChunk, mode === null ? void 0 : mode, currentReplyTo, false);
        if (sendResult.ok) {
          Log.info(`消息块发送成功 (格式: ${mode === null ? "纯文本" : mode}).`);
          void scheduleDeletion({ chat_id: chatId, message_id: sendResult.messageId }, 24 * 60 * 6e4);
          lastMessageId = sendResult.messageId;
          currentReplyTo = sendResult.messageId;
          originalTextSentLength += rawChunk.length;
          chunkIndex++;
          lastError = null;
        } else {
          Log.error(`消息块发送失败 (格式: ${mode === null ? "纯文本" : mode}).`);
          lastError = sendResult.error;
          modeSuccessForRemaining = false;
          break;
        }
      }
      if (modeSuccessForRemaining) {
        Log.info(`${mode === null ? "纯文本" : mode} 格式成功发送了所有剩余文本.`);
        return { ok: true, messageId: lastMessageId };
      }
      inheritedOpenTags = [];
    }
  } catch (error) {
    lastError = error;
  }
  Log.error("所有格式化模式发送均失败.");
  return { ok: false, error: lastError || new TelegramError("所有格式化模式发送失败") };
};
const markdownToHtml = (markdownText) => {
  let htmlText = markdownText;
  const REGEX = {
    CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g,
    INLINE_CODE: /`([^`]+?)`/g,
    LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
    BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g,
    UNDERLINE_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g,
    ITALIC_ASTERISK: /\*(?!\s)(.*?)(?<!\s)\*/g,
    ITALIC_UNDERSCORE: /_(?!\s)(.*?)(?<!\s)_/g,
    STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
    SPOILER: /\|\|(?!\s)(.*?)(?<!\s)\|\|/g,
    BLOCKQUOTE_LINE: /^(>>|>)\s*(.*)$/gm
  };
  try {
    htmlText = htmlText.replace(REGEX.CODE_BLOCK, (_, lang, code) => {
      const languageClass = lang ? `language-${escapeHtml(lang)}` : "";
      return `<pre><code class="${languageClass}">${code}</code></pre>`;
    });
    htmlText = htmlText.replace(REGEX.INLINE_CODE, (_, code) => `<code>${escapeHtml(code)}</code>`);
    htmlText = htmlText.replace(REGEX.LINK, (_, text, url) => {
      const escapedText = escapeHtml(text);
      const escapedUrl = escapeHtml(url);
      return `<a href="${escapedUrl}">${escapedText}</a>`;
    });
    htmlText = htmlText.replace(REGEX.BOLD_ASTERISK, (_, content) => `<b>${escapeHtml(content)}</b>`);
    htmlText = htmlText.replace(REGEX.UNDERLINE_UNDERSCORE, (_, content) => `<u>${escapeHtml(content)}</u>`);
    htmlText = htmlText.replace(REGEX.ITALIC_ASTERISK, (_, content) => `<i>${escapeHtml(content)}</i>`);
    htmlText = htmlText.replace(REGEX.ITALIC_UNDERSCORE, (_, content) => `<i>${escapeHtml(content)}</i>`);
    htmlText = htmlText.replace(REGEX.STRIKETHROUGH, (_, content) => `<s>${escapeHtml(content)}</s>`);
    htmlText = htmlText.replace(REGEX.SPOILER, (_, content) => `<span class="tg-spoiler">${escapeHtml(content)}</span>`);
    const lines = htmlText.split("\n");
    const finalLines = [];
    let currentBlockquote = [];
    let isExpandableBlockquote = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(>>|>)\s*(.*)$/);
      if (match) {
        const type = match[1];
        const content = match[2];
        if (currentBlockquote.length === 0) {
          isExpandableBlockquote = type === ">>";
          currentBlockquote.push(content);
        } else if (type === ">>" && isExpandableBlockquote || type === ">" && !isExpandableBlockquote) {
          currentBlockquote.push(content);
        } else {
          const tag = isExpandableBlockquote ? "<blockquote expandable>" : "<blockquote>";
          finalLines.push(`${tag}${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
          currentBlockquote = [];
          isExpandableBlockquote = type === ">>";
          currentBlockquote.push(content);
        }
      } else {
        if (currentBlockquote.length > 0) {
          const tag = isExpandableBlockquote ? "<blockquote expandable>" : "<blockquote>";
          finalLines.push(`${tag}${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
          currentBlockquote = [];
          isExpandableBlockquote = null;
        }
        finalLines.push(line);
      }
    }
    if (currentBlockquote.length > 0) {
      const tag = isExpandableBlockquote ? "<blockquote expandable>" : "<blockquote>";
      finalLines.push(`${tag}${escapeHtml(currentBlockquote.join("\n"))}</blockquote>`);
    }
    htmlText = finalLines.join("\n");
    return htmlText;
  } catch (error) {
    Log.error("格式化文本为 HTML 格式时发生错误:", { err: error });
    return markdownText;
  }
};
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
const secureHex = (length = 16) => {
  if (length < 0) {
    throw new Error("secureHex: length 必须是非负数。");
  }
  const byteLength = Math.ceil(length / 2);
  return randomBytes(byteLength).toString("hex").slice(0, length);
};
const sleep = async (delayMs) => {
  if (delayMs < 0) {
    throw new Error("sleep: delayMs 必须是非负数。");
  }
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
const sendErrorNotification = async (error, context = "") => {
  const { adminId } = BotConfig.load();
  try {
    if (adminId) {
      const currentTime = formatTime(Date.now());
      const errorMessage = `*🚨 [错误告警] 🚨*

*发生时间*: \`${currentTime}\`

*错误上下文*: \`${context}\`

*错误信息*: \`${error.message || String(error)}\`

*堆栈追踪*:
\`\`\`javascript
${error.stack || "N/A"}
\`\`\``;
      await TelegramBot.sendMessage(adminId, errorMessage, "HTML");
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
  const { githubToken } = BotConfig.load();
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
  const { githubToken } = BotConfig.load();
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
  static callCloudflareApi = async (action, params) => {
    const { cloudflareToken, cloudflareAccountId } = BotConfig.load();
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
      Log.error("Error calling Cloudflare API:", {
        err: error instanceof Error ? error.message : String(error)
      });
      throw new KvNamespaceError(`Error calling Cloudflare API: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  static read = async (namespaceId, keyName, resData) => {
    try {
      const data = await KvNamespace.callCloudflareApi("get", {
        namespaceId,
        keyName
      });
      return resData === "json" ? await data.json() : await data.text();
    } catch (error) {
      Log.error(`Error reading from KV for ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  };
  static write = async (namespaceId, keyName, value, options = {}) => {
    try {
      await KvNamespace.callCloudflareApi("update", {
        namespaceId,
        keyName,
        value,
        ...options
      });
    } catch (error) {
      Log.error(`Error writing to KV for keyName ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error)
      });
    }
  };
  static delete = async (namespaceId, keyName) => {
    try {
      await KvNamespace.callCloudflareApi("delete", {
        namespaceId,
        keyName
      });
      Log.info(`Deleted from ${namespaceId} - keyName: ${keyName}`);
    } catch (error) {
      Log.error(`Error deleting from KV for keyName ${keyName}:`, {
        err: error instanceof Error ? error.message : String(error)
      });
    }
  };
}
const DEFAULT_RETRY_SECONDS = 60;
const recordTimestamp = async (namespaceId, keyName, timestamp) => {
  await KvNamespace.write(namespaceId, keyName, timestamp.toString());
};
const getTimestamp = async (namespaceId, keyName) => {
  const timestampStr = await KvNamespace.read(namespaceId, keyName, "text");
  if (timestampStr) {
    const timestamp = parseInt(timestampStr, 10);
    if (!isNaN(timestamp)) {
      return timestamp;
    } else {
      console.warn(`KV 中键 ${keyName} 存储了无效的时间戳: ${timestampStr}`);
      return null;
    }
  }
  return null;
};
const rateLimiterCheck = async (chatId) => {
  const { rateLimitId: namespaceId, requestIntervalSecond: intervalSecond } = BotConfig.load();
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
    console.error(`限流器错误 (键: ${keyName}):`, error);
    return { canProceed: false, retryAfterSeconds: DEFAULT_RETRY_SECONDS };
  }
};
class ChatContexts {
  static get = async (chatId, userId) => {
    const { chatContextId } = BotConfig.load();
    const keyName = `contexts_${chatId}_${userId}`;
    const contexts = await KvNamespace.read(chatContextId, keyName, "json") || [];
    return contexts;
  };
  static update = async (chatId, userId, contexts) => {
    const { chatContextId, maxContextLength, contextsExpirationSecond } = BotConfig.load();
    const keyName = `contexts_${chatId}_${userId}`;
    const historyContexts = await ChatContexts.get(chatId, userId);
    const newContexts = [...historyContexts, ...contexts];
    if (newContexts.length > maxContextLength) {
      newContexts.splice(0, newContexts.length - maxContextLength);
    }
    await KvNamespace.write(chatContextId, keyName, JSON.stringify(newContexts), {
      expiration_ttl: contextsExpirationSecond
    });
    Log.info(`${keyName}: Chat context updated success, current length ${newContexts.length}`);
  };
  static clear = async (chatId, userId) => {
    const { chatContextId } = BotConfig.load();
    const keyName = `contexts_${chatId}_${userId}`;
    await KvNamespace.delete(chatContextId, keyName);
    Log.info(`${keyName}: Chat contexts cleared success.`);
  };
}
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
const botCommands = [
  {
    name: "start",
    description: "开始使用",
    action: async (chatId, messageId) => {
      Log.info("Executing /start command.");
      const { modelName, durableResourceId, startReplyTextKeyName } = BotConfig.load();
      const startReplyText = await KvNamespace.read(durableResourceId, startReplyTextKeyName, "text");
      const replaceText = startReplyText?.replace("MODEL_NAME", modelName);
      const startResult = await TelegramBot.sendMessage(chatId, replaceText, "HTML", messageId);
      if (startResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: startResult.messageId }, 3 * 6e4);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 6e4);
    }
  },
  {
    name: "clear",
    description: "清理对话上下文",
    action: async (chatId, messageId, userId) => {
      Log.info("Executing /clear command.");
      const clearingResult = await TelegramBot.sendMessage(chatId, "🗑 Clearing...", "HTML", messageId);
      await ChatContexts.clear(chatId, userId);
      if (clearingResult.ok) {
        await sleep(3e3);
        await TelegramBot.deleteMessage(chatId, clearingResult.messageId);
      }
      const clearedText = "✅ 已成功清除你和我的历史对话";
      const clearedResult = await TelegramBot.sendMessage(chatId, clearedText, "HTML", messageId);
      if (clearedResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: clearedResult.messageId }, 3 * 6e4);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 3 * 6e4);
    }
  },
  {
    name: "tools",
    description: "模型可用工具",
    action: async (chatId, messageId) => {
      Log.info("Executing /tools command.");
      const toolList = geminiTools[0].functionDeclarations?.map((tool) => `  * **${tool.name}**: ${tool.description}
`).join("\n").trim();
      const toolsText = `🛠 我可以使用以下工具：

${toolList}`;
      const toolsResult = await TelegramBot.sendMessage(chatId, toolsText, "HTML", messageId);
      if (toolsResult.ok) {
        void scheduleDeletion({ chat_id: chatId, message_id: toolsResult.messageId }, 10 * 6e4);
      }
      void scheduleDeletion({ chat_id: chatId, message_id: messageId }, 10 * 6e4);
    }
  }
];
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
          description: '需要查询的文件路径列表，例如 ["MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md", "SagerNet/sing-box/refs/heads/dev-next/src/main.go", ...]',
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
const geminiTools = [
  {
    functionDeclarations: [...functionForSearch, ...functionForList, ...functionForGet]
  }
];
class GeminiApi {
  static MAX_RETRIES_COMMON = 3;
  static BASE_RETRY_DELAY_MS = 1e4;
  static async _initializeApiCallContext(chatParams, initialContents) {
    const { durableResourceId, systemPromptKeyName, geminiApiKeysKeyName, modelName } = BotConfig.load();
    const { chatId, thinkMessageId } = chatParams;
    const systemPrompt = await KvNamespace.read(durableResourceId, systemPromptKeyName, "text") || "You are a helpful assistant.";
    const apiKeys = await KvNamespace.read(durableResourceId, geminiApiKeysKeyName, "json");
    if (!apiKeys || apiKeys.length === 0) {
      Log.error("未找到有效的 Gemini API 密钥。", { durableResourceId, geminiApiKeysKeyName });
      throw new GeminiError("未找到有效的 API 密钥，请检查配置。", "GEMINI_API_KEY_NOT_FOUND", false);
    }
    Log.info(`系统提示 (systemPrompt):`, { systemPrompt: systemPrompt.slice(0, 200) });
    const config = {
      maxOutputTokens: 65536,
      temperature: 0,
      thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
      tools: geminiTools,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO
        }
      },
      responseMimeType: "text/plain",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
      ],
      systemInstruction: [{ text: systemPrompt }]
    };
    return {
      chatId,
      thinkMessageId,
      systemPrompt,
      apiKeys,
      modelName,
      config,
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
  static async _callGeminiApi(context) {
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
      response: {
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
              }
              return part;
            })
          }
        }))
      }
    });
    return response;
  }
  static async _executeApiCallWithRetries(context) {
    for (let attempt = 0; attempt <= GeminiApi.MAX_RETRIES_COMMON; attempt++) {
      try {
        const response = await GeminiApi._callGeminiApi(context);
        return response;
      } catch (error) {
        const err = error instanceof GeminiError ? error : new GeminiError(String(error), "API_CLIENT_ERROR", context.metrics.hasToolThoughts);
        Log.error(`Gemini API 客户端或网络错误 (尝试 ${attempt + 1}/${GeminiApi.MAX_RETRIES_COMMON}):`, { err });
        if (attempt < GeminiApi.MAX_RETRIES_COMMON) {
          const delay = Math.floor(GeminiApi.BASE_RETRY_DELAY_MS * Math.pow(2, attempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.errorRetryCount++;
          if (context.thinkMessageId !== void 0) {
            await TelegramBot.editMessageText(
              context.chatId,
              context.thinkMessageId,
              `Gemini API 客户端错误，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${attempt + 1} 次重试...`
            );
          }
          await sleep(delay);
          Log.info(`Gemini API 客户端错误，进行第 ${attempt + 1} 次重试...`);
        } else {
          const finalError = new GeminiError(
            `Gemini API 客户端错误，已达最大重试次数 (${GeminiApi.MAX_RETRIES_COMMON})。

${err}`,
            "MAX_API_CLIENT_RETRIES_REACHED",
            context.metrics.hasToolThoughts
          );
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
          throw finalError;
        }
      }
    }
    throw new GeminiError("未知错误：客户端重试循环异常退出。", "UNKNOWN_RETRY_LOOP_EXIT", context.metrics.hasToolThoughts);
  }
  static async _handleToolCalls(context, modelParts) {
    const functionCalls = modelParts.filter((part) => part.functionCall);
    const functionTexts = modelParts.filter((part) => part.text);
    if (functionTexts.length > 0) {
      const thoughtTexts = functionTexts.map((part) => part.text).join("").trim();
      if (thoughtTexts) {
        context.metrics.hasToolThoughts = true;
        const displayThoughtText = (() => {
          const strArr = Array.from(thoughtTexts);
          if (strArr.length > 4096) {
            return `${strArr.slice(0, 2e3).join("")}

......

${strArr.slice(strArr.length - 2e3).join("")}`.trim();
          }
          return thoughtTexts;
        })();
        if (context.thinkMessageId !== void 0) {
          await TelegramBot.editMessageText(
            context.chatId,
            context.thinkMessageId,
            `<b>Thoughts</b>:

<blockquote expandable>${escapeHtml(displayThoughtText)}</blockquote>`,
            "HTML",
            false
          );
        }
      }
    }
    Log.info(`检测到工具调用 (${functionCalls.length} 个)`);
    context.metrics.usageToolCount += functionCalls.length;
    const toolResponseParts = [];
    for (const functionCall of functionCalls) {
      const functionName = functionCall.functionCall?.name;
      const functionArgs = functionCall.functionCall?.args;
      if (typeof functionName === "string" && functionName in ToolExecutors) {
        try {
          const executor = ToolExecutors[functionName];
          const toolResult = await executor(functionArgs);
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
  static _buildSuccessResponse(context, textParts) {
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
  static async _writeApiKeysToKv(apiKeys) {
    const { durableResourceId, geminiApiKeysKeyName } = BotConfig.load();
    try {
      await KvNamespace.write(durableResourceId, geminiApiKeysKeyName, JSON.stringify(apiKeys));
      Log.info("已将最新的 API 密钥组写入 KvNamespace。");
    } catch (error) {
      Log.error("写入 API 密钥到 KvNamespace 失败:", { error });
    }
  }
  static generateContent = async (initialContents, chatParams) => {
    const { maxApiCallRounds } = BotConfig.load();
    let context;
    try {
      context = await GeminiApi._initializeApiCallContext(chatParams, initialContents);
    } catch (error) {
      const err = error instanceof GeminiError ? error : new GeminiError(String(error), "INITIALIZATION_ERROR", false);
      Log.error("初始化 API 调用上下文失败:", { err });
      throw err;
    }
    let apiCallRoundCounter = 0;
    while (apiCallRoundCounter < maxApiCallRounds) {
      let response;
      try {
        response = await GeminiApi._executeApiCallWithRetries(context);
      } catch (error) {
        throw error;
      }
      let candidate = response.candidates?.[0];
      let currentEmptyReplyAttempt = 0;
      while (!candidate || !candidate.content || !candidate.content.parts) {
        if (currentEmptyReplyAttempt < GeminiApi.MAX_RETRIES_COMMON) {
          const delay = Math.floor(GeminiApi.BASE_RETRY_DELAY_MS * Math.pow(2, currentEmptyReplyAttempt + 1) * (0.8 + Math.random() * 0.4));
          context.metrics.emptyReplyRetryCount++;
          currentEmptyReplyAttempt++;
          if (context.thinkMessageId !== void 0) {
            await TelegramBot.editMessageText(
              context.chatId,
              context.thinkMessageId,
              `Gemini API 响应为空，将在 ${Math.floor(delay / 1e3)} 秒后，进行第 ${currentEmptyReplyAttempt} 次重试...`
            );
          }
          Log.warn(
            `Gemini API 返回结果不包含有效的 candidate 或 content，尝试重试 (无效回复重试 ${currentEmptyReplyAttempt}/${GeminiApi.MAX_RETRIES_COMMON})。`,
            { response }
          );
          await sleep(delay);
          try {
            response = await GeminiApi._executeApiCallWithRetries(context);
            candidate = response.candidates?.[0];
          } catch (error) {
            throw error;
          }
        } else {
          const errorMsg2 = `Gemini API 未返回有效结果，已达最大无效回复重试次数 (${GeminiApi.MAX_RETRIES_COMMON})，请稍后再重新提问。`;
          Log.error(errorMsg2);
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
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
        const toolResponseParts = await GeminiApi._handleToolCalls(context, parts);
        if (toolResponseParts.length > 0) {
          context.contents.push({
            role: "user",
            parts: toolResponseParts
          });
          Log.info("工具执行结果已添加到消息历史，准备下一轮 API 调用");
        } else {
          Log.warn("模型调用了工具，但没有工具执行结果被记录，可能出现逻辑问题。");
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
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
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
          return GeminiApi._buildSuccessResponse(context, textParts);
        } else {
          Log.warn("Gemini API 返回非工具调用响应，但没有文本内容或其他可处理的 parts。", { response });
          const finishReason = candidate.finishReason;
          await GeminiApi._writeApiKeysToKv(context.apiKeys);
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
    await GeminiApi._writeApiKeysToKv(context.apiKeys);
    throw new GeminiError(errorMsg, "MAX_CALL_ROUNDS_REACHED", context.metrics.hasToolThoughts);
  };
}
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
  static async sendRequest(httpMethod, apiMethod, body) {
    const { botApiUrl } = BotConfig.load();
    const url = `${botApiUrl}/${apiMethod}`;
    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const parsed = await response.json();
      if (!parsed.ok) {
        const desc = parsed.description;
        const errCode = `API_FAILED_${String(apiMethod).toUpperCase()}_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          requestBody: body,
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
          requestBody: body,
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
        requestBody: body,
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
  static async sendMessage(chatId, text, parseMode, replyToMessageId, isFormat = true) {
    const payload = {
      chat_id: chatId,
      text: isFormat ? markdownToHtml(text) : text,
      parse_mode: parseMode,
      link_preview_options: {
        is_disabled: true
      },
      reply_parameters: replyToMessageId ? {
        message_id: replyToMessageId,
        allow_sending_without_reply: true
      } : void 0
    };
    try {
      const result = await TelegramBot.sendRequest("POST", "sendMessage", payload);
      Log.info("Telegram message sent successfully.", {
        chatId,
        messageId: result.message_id
      });
      return {
        ok: true,
        messageId: result.message_id
      };
    } catch (error) {
      Log.error("Error sending Telegram message", {
        err: error,
        chatId,
        text: text.substring(0, 100) + "..."
      });
      return {
        ok: false,
        error
      };
    }
  }
  static async editMessageText(chatId, messageId, text, parseMode, isFormat = true) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: isFormat ? markdownToHtml(text) : text,
      parse_mode: parseMode,
      link_preview_options: {
        is_disabled: true
      }
    };
    try {
      const result = await TelegramBot.sendRequest("POST", "editMessageText", payload);
      Log.info("Telegram message edited successfully.", {
        chatId,
        messageId: result.message_id
      });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      Log.error("Error editing Telegram message", {
        err: error,
        chatId,
        messageId,
        text: text.substring(0, 100) + "..."
      });
      return { ok: false, error };
    }
  }
  static async deleteMessage(chatId, messageId) {
    const payload = {
      chat_id: chatId,
      message_id: messageId
    };
    try {
      await TelegramBot.sendRequest("POST", "deleteMessage", payload);
      Log.info("Telegram message deleted successfully.", { chatId, messageId });
      return { ok: true };
    } catch (error) {
      Log.error("Error deleting Telegram message", {
        err: error,
        chatId,
        messageId
      });
      return { ok: false, error };
    }
  }
  static async setBotCommands(chatId, userId) {
    const payload = {
      commands: botCommands.map((command) => ({
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
      await TelegramBot.sendRequest("POST", "setMyCommands", payload);
      Log.info("Bot commands set successfully.", { chatId });
      return { ok: true };
    } catch (error) {
      Log.error("Error setting bot commands", { err: error, chatId });
      return { ok: false, error };
    }
  }
  static async getFile(fileId) {
    Log.info(`Getting file info for file_id: ${fileId}`);
    try {
      const result = await TelegramBot.sendRequest("POST", "getFile", {
        file_id: fileId
      });
      return { ok: true, data: result };
    } catch (error) {
      Log.error(`Error in getFile for file_id ${fileId}`, {
        err: error,
        fileId
      });
      return { ok: false, error };
    }
  }
}
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
          const MAX_CHUNK_LENGTH = 1024;
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
  }
};
const handleCommand = async (message) => {
  const { message_id: messageId, from, chat } = message;
  Log.info("Handling commands message...", { chatId: chat.id, messageId });
  const messageText = message.text || message.caption;
  const messageEntities = message.entities || message.caption_entities;
  const commandEntity = messageEntities.find((entity) => entity.type === "bot_command");
  const fullCommandText = messageText.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);
  void TelegramBot.setBotCommands(chat.id, from?.id);
  const commandName = fullCommandText.slice(1).split("@")[0].trim();
  const targetCommand = botCommands.find((cmd) => cmd.name === commandName);
  if (targetCommand) {
    await targetCommand.action(chat.id, messageId, from?.id);
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
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = image;
  const result = await TelegramBot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const imageArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64ImageData = Buffer.from(imageArrayBuffer).toString("base64");
    return { data: base64ImageData, mimeType: mime_type ? mime_type : "image/jpeg" };
  }
};
const SUPPORTED_MIME_TYPES = [
  "application/json",
  "application/yaml",
  "text/javascript",
  "text/plain",
  "text/markdown",
  "application/x-shellscript",
  "application/pdf"
];
const handleDocument = async (document) => {
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = document;
  let universalTextType;
  if (!SUPPORTED_MIME_TYPES.includes(String(mime_type))) universalTextType = "text/plain";
  const result = await TelegramBot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString("base64");
    return { data: base64DocumentData, mimeType: universalTextType ? universalTextType : mime_type ? mime_type : "text/plain" };
  }
};
const handleFile = async (message) => {
  const { document, photo } = message;
  if (photo || document?.mime_type === "image/png" || document?.mime_type === "image/jpeg") {
    const image = photo ? photo[photo.length - 1] : document;
    if (image) {
      const imageData = await handleImage(image);
      if (imageData) return imageData;
    }
  } else if (document) {
    const documentData = await handleDocument(document);
    if (documentData) return documentData;
  }
};
const containsFile = (message) => {
  return message ? message.document || message.photo ? true : false : false;
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
    }
  }
  parts.push({ text: messageText ? messageText : "你好！" });
  return parts;
};
class MentionHandler {
  static async _handleRateLimiting(message, adminId) {
    const { message_id: userMessageId, from, chat } = message;
    const checkResult = await rateLimiterCheck(chat.id);
    if (!checkResult.canProceed && from?.id !== adminId) {
      Log.info(`Rate limit exceeded for chat ${chat.id}. Retry after ${checkResult.retryAfterSeconds} seconds.`);
      const rateLimitResult = await TelegramBot.sendMessage(
        chat.id,
        `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`,
        "HTML",
        userMessageId
      );
      if (rateLimitResult.ok) {
        void scheduleDeletion({ chat_id: chat.id, message_id: rateLimitResult.messageId }, checkResult.retryAfterSeconds * 1e3);
      }
      return true;
    }
    return false;
  }
  static async _sendFileUploadMessage(message, replyToMessage, chatId, userMessageId) {
    if (containsFile(message) || containsFile(replyToMessage)) {
      const uploadingResult = await TelegramBot.sendMessage(chatId, "📄 File uploading...", "HTML", userMessageId);
      return uploadingResult.ok ? uploadingResult.messageId : null;
    }
    return null;
  }
  static async _buildCompleteContents(chatId, fromUserId, currentMessage, botName) {
    const historyChatContents = await ChatContexts.get(chatId, fromUserId);
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
  static async _sendThinkingMessage(chatId, userMessageId) {
    const thinkingResult = await TelegramBot.sendMessage(chatId, "✨ Thinking...", "HTML", userMessageId);
    if (!thinkingResult.ok) {
      Log.error("Failed to send thinking message.");
      throw new TelegramError("Failed to send thinking message.");
    }
    return thinkingResult.messageId;
  }
  static async _processGeminiResponse(geminiResponse, chatId, userMessageId, thinkMessageId, modelName, fromUserId, completeContentsBeforeCall) {
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
      const displayThoughtText = (() => {
        const strArr = Array.from(resThoughtTexts);
        if (strArr.length > 4096) {
          return `${strArr.slice(0, 2e3).join("")}

......

${strArr.slice(strArr.length - 2e3).join("")}`.trim();
        }
        return resThoughtTexts;
      })();
      await TelegramBot.editMessageText(
        chatId,
        thinkMessageId,
        `<b>Thoughts</b>:

<blockquote expandable>${escapeHtml(displayThoughtText)}</blockquote>`,
        "HTML",
        false
      );
    }
    if (!hasToolThoughts && !hasDisplayedThoughts) {
      await TelegramBot.deleteMessage(chatId, thinkMessageId);
    } else {
      void scheduleDeletion({ chat_id: chatId, message_id: thinkMessageId }, 30 * 6e4);
    }
    const resTextParts = response.parts?.filter((part) => part.text && !part.thought);
    const resTexts = resTextParts?.map((part) => part.text).join("").trim();
    if (!resTexts) {
      throw new GeminiError("Gemini API 未返回有效文本回复：模型可能只生成了工具调用或思考内容。");
    }
    const fullText = `🤖 模型：\`${modelName}\`

${resTexts}

*✨ 本次任务共成功调用 Gemini API ${apiCallSuccessCount} 次，${totalRetryCount} 次重试：无效回复 ${emptyReplyRetryCount} 次，客户端错误 ${errorRetryCount} 次，使用工具数：${usageToolCount}，耗时：${totalDurationSecond} 秒，消耗 Token：${totalUsageToken}*

*⚠ 本 AI 回答仅供参考，可能存在不准确之处，请您自行判断。*`;
    const { ok: sendOk, error: sendError } = await sendFormattedMessage(chatId, fullText, userMessageId);
    if (!sendOk) {
      const error = sendError ? sendError : new TelegramError("发送消息时发生未知错误");
      throw error;
    }
    const botResponseContent = {
      role: "model",
      parts: response.parts
    };
    await ChatContexts.update(chatId, fromUserId, [
      ...completeContentsBeforeCall,
      botResponseContent
    ]);
    return hasDisplayedThoughts;
  }
  static async handleMention(message, isChat = false) {
    const { modelName, botName, adminId } = BotConfig.load();
    const { message_id: userMessageId, from, chat, reply_to_message } = message;
    Log.info("Handling mention message.", {
      chatId: chat.id,
      messageId: userMessageId,
      isChatMode: isChat
    });
    if (await MentionHandler._handleRateLimiting(message, adminId)) {
      return;
    }
    let fileUploadMessageId = null;
    let thinkMessageId = null;
    let completeContents = [];
    let hasResThought = false;
    try {
      fileUploadMessageId = await MentionHandler._sendFileUploadMessage(message, reply_to_message, chat.id, userMessageId);
      completeContents = await MentionHandler._buildCompleteContents(chat.id, from?.id, message, botName);
      if (fileUploadMessageId) {
        await sleep(3e3);
        await TelegramBot.deleteMessage(chat.id, fileUploadMessageId);
        fileUploadMessageId = null;
      }
      thinkMessageId = await MentionHandler._sendThinkingMessage(chat.id, userMessageId);
      const geminiResponse = await GeminiApi.generateContent(completeContents, {
        chatId: chat.id,
        thinkMessageId
      });
      hasResThought = await MentionHandler._processGeminiResponse(
        geminiResponse,
        chat.id,
        userMessageId,
        thinkMessageId,
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
        await TelegramBot.deleteMessage(chat.id, fileUploadMessageId);
      }
      if (thinkMessageId) {
        const err = apiError instanceof GeminiError ? apiError : void 0;
        if (!err?.hasToolThoughts && !hasResThought) {
          await TelegramBot.deleteMessage(chat.id, thinkMessageId);
        } else {
          void scheduleDeletion({ chat_id: chat.id, message_id: thinkMessageId }, 30 * 6e4);
        }
      }
      throw apiError;
    }
  }
}
const handleMention = MentionHandler.handleMention;
const handleNewMember = async (message) => {
  const { botName, durableResourceId, newMemberWelcomeTextKeyName } = BotConfig.load();
  const { chat, new_chat_members } = message;
  const newMemberIds = new_chat_members?.map((member) => member.id);
  Log.info("Handling new chat member message", { chatId: chat.id, newMemberIds: newMemberIds.join(", ") });
  for (const newMember of new_chat_members) {
    const { id: newMemberId, first_name, last_name = "" } = newMember;
    const newMemberFullName = `${first_name} ${last_name}`;
    const newMemberMention = `[${newMemberFullName}](tg://user?id=${newMemberId})`;
    const newMemberWelcomeText = await KvNamespace.read(durableResourceId, newMemberWelcomeTextKeyName, "text");
    const replaceText = newMemberWelcomeText?.replace("NEW_MEMBER_MENTION", newMemberMention).replace("CHAT_TITLE", chat.title).replace("BOT_NAME", botName);
    const welcomeResult = await TelegramBot.sendMessage(chat.id, replaceText, "HTML");
    if (welcomeResult.ok) {
      void scheduleDeletion({ chat_id: chat.id, message_id: welcomeResult.messageId }, 10 * 6e4);
    }
  }
};
const handleNormal = async (message) => {
  const { botName } = BotConfig.load();
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
const handleUpdate = async (update) => {
  Log.info("Handling Telegram update", { update });
  const { botName, allowGroups } = BotConfig.load();
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
    const errorResult = await TelegramBot.sendMessage(message.chat.id, `❌ ${errorMessage}`, "HTML", message_id);
    if (errorResult.ok) {
      void scheduleDeletion({ chat_id: chat.id, message_id: errorResult.messageId }, 5 * 6e4);
    }
  }
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
      const { secretToken } = BotConfig.load();
      const safeHeaders = { ...request.headers, "x-telegram-bot-api-secret-token": "***" };
      Log.info("Webhook Request Headers", { headers: safeHeaders });
      const secretTokenFromHeader = request.headers["x-telegram-bot-api-secret-token"] || "";
      if (!constantTimeEqual(secretTokenFromHeader, secretToken)) {
        Log.warn("Unauthorized webhook access attempt", { clientIp: request.ip, userAgent: request.headers["user-agent"] });
        return reply.code(401).type("application/json").send({ code: 401, message: "Bad Credentials" });
      }
    },
    handler: async (request, reply) => {
      Log.info("Webhook Verification successful");
      const update = request.body;
      setImmediate(() => {
        void handleUpdate(update);
      });
      return reply.code(202).type("application/json").send({ code: 202, message: `OK` });
    }
  });
  route.setNotFoundHandler((request, reply) => {
    return reply.code(404).type("application/json").send({ code: 404, message: "Not Found" });
  });
};
const buildApp = async () => {
  const { loggerLevel } = BotConfig.load();
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
  const { listenHost: host, listenPort: port } = BotConfig.load();
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
