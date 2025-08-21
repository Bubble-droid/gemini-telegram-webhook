// src/utils/helpers.ts

import { Log } from '@/services';
import { randomBytes } from 'node:crypto';

/**
 * HTML 字符转义 - 精简版本，仅转义 Telegram HTML 必需字符
 * @param {string} text 要转义的文本
 * @returns {string} 转义后的 HTML 文本
 */
export const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/**
 * [改进] 将标准 Markdown 格式文本转换为 Telegram 支持的 HTML 格式
 * 1. 增加了对 __underline__ 的支持 -> <u>underline</u>
 * 2. 优化了正则表达式的顺序和逻辑，使其更加健壮
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 HTML 格式文本
 */
const markdownToHtml = (markdownText: string): string => {
  let htmlText: string = markdownText;

  // 正则表达式的顺序至关重要，从最具体、最长的模式开始匹配，防止错误解析
  const REGEX: Record<string, RegExp> = {
    CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g, // 匹配代码块
    INLINE_CODE: /`([^`]+?)`/g, // 匹配行内代码
    LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g, // 匹配链接
    BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g, // 匹配 **bold** (前后不能是空格)
    BOLD_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g, // 匹配 __bold__ (作为下划线处理)
    ITALIC_ASTERISK: /\*(?!\s)(.*?)(?<!\s)\*/g, // 匹配 *italic*
    ITALIC_UNDERSCORE: /_(?!\s)(.*?)(?<!\s)_/g, // 匹配 _italic_
    STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g, // 匹配 ~strike~
    SPOILER: /\|\|(?!\s)(.*?)(?<!\s)\|\|/g, // 匹配 ||spoiler||
    BLOCKQUOTE: /^> (.*(?:\n> .*)*)/gm, // 匹配块引用
    EXPANDABLE_BLOCKQUOTE: /^>> (.*(?:\n>> .*)*)/gm, // 匹配可展开块引用
  };
  try {
    // 1. 代码块 (最高优先级，内部内容不应被其他规则解析)
    htmlText = htmlText.replace(REGEX.CODE_BLOCK, (_, lang: string, code: string) => {
      const languageClass = lang ? `language-${lang}` : '';
      return `<pre><code class="${languageClass}">${escapeHtml(code.trim())}</code></pre>`;
    });
    // 2. 行内代码 (第二优先级)
    htmlText = htmlText.replace(REGEX.INLINE_CODE, (_, code: string) => `<code>${escapeHtml(code)}</code>`);
    // 3. 链接
    htmlText = htmlText.replace(REGEX.LINK, '<a href="$2">$1</a>');
    // 4. 粗体 (**)
    htmlText = htmlText.replace(REGEX.BOLD_ASTERISK, '<b>$1</b>');
    // 5. 下划线 (__) -> <u> (Telegram HTML 支持)
    htmlText = htmlText.replace(REGEX.BOLD_UNDERSCORE, '<u>$1</u>');
    // 6. 斜体 (* 和 _)
    htmlText = htmlText.replace(REGEX.ITALIC_ASTERISK, '<i>$1</i>');
    htmlText = htmlText.replace(REGEX.ITALIC_UNDERSCORE, '<i>$1</i>');
    // 7. 删除线
    htmlText = htmlText.replace(REGEX.STRIKETHROUGH, '<s>$1</s>');
    // 8. 剧透
    htmlText = htmlText.replace(REGEX.SPOILER, '<tg-spoiler>$1</tg-spoiler>');
    // 9. 可展开引用块 (必须在普通引用块之前处理)
    htmlText = htmlText.replace(REGEX.EXPANDABLE_BLOCKQUOTE, (match: string) => {
      const content = match.replace(/^>> /gm, '').trim();
      return `<blockquote expandable>${content}</blockquote>`;
    });
    // 10. 引用块
    htmlText = htmlText.replace(REGEX.BLOCKQUOTE, (match: string) => {
      const content = match.replace(/^> /gm, '').trim();
      return `<blockquote>${content}</blockquote>`;
    });
    return htmlText;
  } catch (error) {
    Log.error('格式化文本为 HTML 格式时发生错误:', { err: error });
    return markdownText; // 发生错误时返回原文
  }
};

/**
 * 辅助函数：转义 Telegram MarkdownV2 的特殊字符
 * @param {string} text 要转义的文本
 * @returns {string} 转义后的文本
 */
const escapeMarkdownV2 = (text: string): string => {
  // 根据官方文档，这些字符在特定情况下需要转义
  // 我们在这里进行全局转义以确保安全
  const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
  return text.replace(charsToEscape, '\\$&');
};

/**
 * [新增] 将标准 Markdown 格式文本转换为 Telegram 的 MarkdownV2 格式
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 MarkdownV2 格式文本
 */
const markdownToMarkdownV2 = (markdownText: string): string => {
  let mdV2Text = markdownText;
  try {
    // 1. 代码块 (```...```) - 内部不需要转义
    // 保持原样，因为 Telegram MarkdownV2 语法相同
    // 2. 行内代码 (`...`) - 内部不需要转义
    // 保持原样，因为 Telegram MarkdownV2 语法相同
    // 3. 链接: [text](url) -> [转义后的text](url)
    mdV2Text = mdV2Text.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (match, text, url) => {
      return `[${escapeMarkdownV2(text)}](${url})`;
    });
    // 4. 粗体: **bold** -> *bold* (注意语法的变化)
    // 我们需要处理 ** 和 __ 两种源格式
    mdV2Text = mdV2Text.replace(/\*\*(?!\s)(.*?)(?<!\s)\*\*/g, (match, content) => `*${escapeMarkdownV2(content)}*`);
    // 5. 下划线: __underline__ -> __underline__ (语法相同)
    mdV2Text = mdV2Text.replace(/__(?!\s)(.*?)(?<!\s)__/g, (match, content) => `__${escapeMarkdownV2(content)}__`);
    // 6. 斜体: *italic* 或 _italic_ -> _italic_ (注意语法的变化)
    mdV2Text = mdV2Text.replace(/\*(?!\s)(.*?)(?<!\s)\*/g, (match, content) => `_${escapeMarkdownV2(content)}_`);
    mdV2Text = mdV2Text.replace(/_(?!\s)(.*?)(?<!\s)_/g, (match, content) => `_${escapeMarkdownV2(content)}_`);
    // 7. 删除线: ~strike~ -> ~strike~ (语法相同)
    mdV2Text = mdV2Text.replace(/~(?!\s)(.*?)(?<!\s)~/g, (match, content) => `~${escapeMarkdownV2(content)}~`);
    // 8. 剧透: ||spoiler|| -> ||spoiler|| (语法相同)
    mdV2Text = mdV2Text.replace(/\|\|(?!\s)(.*?)(?<!\s)\|\|/g, (match, content) => `||${escapeMarkdownV2(content)}||`);
    // 9. 引用块: > quote -> >quote (语法相似，但内容需要转义)
    // 可展开引用块 (>>) 在标准 MD 中不常见，这里统一转为普通引用块
    mdV2Text = mdV2Text.replace(/^>> (.*)/gm, (match, content) => `>${escapeMarkdownV2(content)}`);
    mdV2Text = mdV2Text.replace(/^> (.*)/gm, (match, content) => `>${escapeMarkdownV2(content)}`);
    return mdV2Text;
  } catch (error) {
    Log.error('格式化文本为 MarkdownV2 格式时发生错误:', { err: error });
    return markdownText;
  }
};

/**
 * [新增] 将标准 Markdown 格式文本转换为 Telegram 的 Legacy Markdown 格式
 * 此格式限制很多，不支持嵌套，不支持删除线、下划线、剧透、引用块等
 * 函数会尽力转换支持的格式，并移除不支持的格式
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 Legacy Markdown 格式文本
 */
const markdownToLegacyMarkdown = (markdownText: string): string => {
  let legacyMdText = markdownText;

  try {
    // 1. 移除所有不支持的格式，防止解析错误
    legacyMdText = legacyMdText.replace(/__(.*?)__/g, '$1'); // 移除下划线
    legacyMdText = legacyMdText.replace(/~(.*?)~/g, '$1'); // 移除删除线
    legacyMdText = legacyMdText.replace(/\|\|(.*?)\|\|/g, '$1'); // 移除剧透
    legacyMdText = legacyMdText.replace(/^>> (.*)/gm, '$1'); // 移除可展开引用
    legacyMdText = legacyMdText.replace(/^> (.*)/gm, '$1'); // 移除引用
    // 2. 转换支持的格式
    // 注意：Legacy Markdown 的粗体是 *bold*，斜体是 _italic_
    // 源格式 **bold** -> *bold*
    legacyMdText = legacyMdText.replace(/\*\*(.*?)\*\*/g, '*$1*');
    // 源格式 *italic* 或 _italic_ -> _italic_
    legacyMdText = legacyMdText.replace(/(?<!\*)\*(?!\*|_)(.*?)(?<!\*)\*(?!\*|_)/g, '_$1_');
    legacyMdText = legacyMdText.replace(/_(.*?)_/g, '_$1_');
    // 3. 链接、代码块和行内代码语法与标准 MD 相同，无需转换
    return legacyMdText;
  } catch (error) {
    Log.error('格式化文本为 Legacy Markdown 格式时发生错误:', { err: error });
    return markdownText;
  }
};

/**
 * 将时间格式化为 UTC+8 时间
 * @param {Date|number} time 时间对象或时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串 (YYYY-MM-DD HH:mm:ss UTC+8)
 */
const formatTime = (time: Date | number = Date.now()): string => {
  const timeDate: Date = typeof time === 'number' ? new Date(time) : time;
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
  const parts = formatter.formatToParts(timeDate);
  const tf: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') tf[type] = value;
  });
  return `${tf.year}-${tf.month}-${tf.day} ${tf.hour}:${tf.minute}:${tf.second} UTC+8`;
};

/**
 * 生成指定长度的16进制字符串 (加密安全)
 * @param {number} [length=16]  需要生成的字符串长度
 * @returns {string} 生成的16进制字符串
 */
const secureHex = (length: number = 16): string => {
  const byteLength: number = Math.ceil(length / 2);
  return randomBytes(byteLength).toString('hex').slice(0, length);
};

/**
 * 异步暂停指定毫秒数。
 * 此函数返回一个 Promise，该 Promise 在指定延迟后解析。
 * 它可以用于在异步函数中引入延迟，避免阻塞主线程。
 *
 * @param {number} delayMs - 延迟的毫秒数。必须是非负数。
 * @returns {Promise<void>} 一个 Promise，该 Promise 在 `delayMs` 毫秒后解析。
 */
const sleep = async (delayMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

/**
 * 通用数组轮换器（不改变原数组，返回新数组）
 * @param arr 源数组（支持任意元素）
 * @param steps 轮换步数（默认 1）。若为负数，等价于相反方向的正数。
 * @param direction 'left' | 'right'（默认 'left'）
 * @returns 轮换后的新数组
 */
const rotateArray = <T>(arr: readonly T[], steps = 1, direction: 'left' | 'right' = 'left'): T[] => {
  const len = arr.length;
  if (len === 0) return [];

  // 规范化 steps：取绝对值并模长
  const k = Math.abs(steps) % len;
  if (k === 0) return Array.from(arr);

  // 如果 steps 为负数，则翻转方向
  if (steps < 0) {
    direction = direction === 'left' ? 'right' : 'left';
  }

  // 将方向统一为“向左移动 effectiveLeft 个位置”
  const effectiveLeft = direction === 'left' ? k : len - k;

  // 左轮换实现：arr.slice(effectiveLeft) + arr.slice(0, effectiveLeft)
  return arr.slice(effectiveLeft).concat(arr.slice(0, effectiveLeft));
};

export { markdownToHtml, markdownToMarkdownV2, markdownToLegacyMarkdown, formatTime, secureHex, sleep, rotateArray };
