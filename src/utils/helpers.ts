// src/utils/helpers.ts

import { Log } from '@/services';
import { randomBytes } from 'node:crypto';
import {
  escapeHtml,
  escapeMarkdownV2Text,
  escapeMarkdownV2Code,
  escapeMarkdownV2LinkUrl,
  escapeMarkdownLegacyText,
  escapeMarkdownLegacyLinkUrl,
} from '@/utils/formatting';
import { spawn } from 'node:child_process';

/**
 * [改进] 将标准 Markdown 格式文本转换为 Telegram 支持的 HTML 格式
 * 1. 增加了对 `__underline__` 的支持 -> `<u>underline</u>`
 * 2. 增加了对 `||spoiler||` 的支持 -> `<span class="tg-spoiler">spoiler</span>`
 * 3. 增加了对 `>> 可展开引用块` 的支持 -> `<blockquote expandable>...</blockquote>`
 * 4. 优化了正则表达式的顺序和逻辑，使其更加健壮，并确保所有内容都正确转义。
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 HTML 格式文本
 */
const markdownToHtml = (markdownText: string): string => {
  let htmlText: string = markdownText;

  // 正则表达式的顺序至关重要，从最具体、最长的模式开始匹配，防止错误解析
  const REGEX = {
    // 代码块必须最先匹配，因为其内部内容不应被其他规则解析
    CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g,
    // 行内代码
    INLINE_CODE: /`([^`]+?)`/g,
    // 链接
    LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
    // 粗体: **bold**
    BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g,
    // 下划线: __underline__ (Telegram HTML 对应 <u>)
    UNDERLINE_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g,
    // 斜体: *italic*
    ITALIC_ASTERISK: /\*(?!\s)(.*?)(?<!\s)\*/g,
    // 斜体: _italic_
    ITALIC_UNDERSCORE: /_(?!\s)(.*?)(?<!\s)_/g,
    // 删除线: ~strikethrough~
    STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
    // 剧透: ||spoiler||
    SPOILER: /\|\|(?!\s)(.*?)(?<!\s)\|\|/g,
    // 引用块和可展开引用块 (行前缀，需要特殊处理多行)
    BLOCKQUOTE_LINE: /^(>>|>)\s*(.*)$/gm, // 匹配所有引用行
  };

  try {
    // 1. 代码块 (最高优先级，内部内容不应被其他规则解析)
    htmlText = htmlText.replace(REGEX.CODE_BLOCK, (_, lang: string, code: string) => {
      const languageClass = lang ? `language-${escapeHtml(lang)}` : '';
      return `<pre><code class="${languageClass}">${code}</code></pre>`; // 代码块内容不进行 HTML 转义，交由浏览器处理或Telegram API解析
    });

    // 2. 行内代码 (第二优先级)
    htmlText = htmlText.replace(REGEX.INLINE_CODE, (_, code: string) => `<code>${escapeHtml(code)}</code>`);

    // 3. 链接
    htmlText = htmlText.replace(REGEX.LINK, (_, text: string, url: string) => {
      // 链接文本和URL都需要 HTML 转义
      const escapedText = escapeHtml(text);
      const escapedUrl = escapeHtml(url);
      return `<a href="${escapedUrl}">${escapedText}</a>`;
    });

    // 4. 粗体 (**)
    htmlText = htmlText.replace(REGEX.BOLD_ASTERISK, (_, content: string) => `<b>${escapeHtml(content)}</b>`);

    // 5. 下划线 (__) -> <u> (Telegram HTML 支持)
    htmlText = htmlText.replace(REGEX.UNDERLINE_UNDERSCORE, (_, content: string) => `<u>${escapeHtml(content)}</u>`);

    // 6. 斜体 (* 和 _)
    htmlText = htmlText.replace(REGEX.ITALIC_ASTERISK, (_, content: string) => `<i>${escapeHtml(content)}</i>`);
    htmlText = htmlText.replace(REGEX.ITALIC_UNDERSCORE, (_, content: string) => `<i>${escapeHtml(content)}</i>`);

    // 7. 删除线
    htmlText = htmlText.replace(REGEX.STRIKETHROUGH, (_, content: string) => `<s>${escapeHtml(content)}</s>`);

    // 8. 剧透
    htmlText = htmlText.replace(REGEX.SPOILER, (_, content: string) => `<span class="tg-spoiler">${escapeHtml(content)}</span>`);

    // 9. 引用块 (包括可展开引用块)
    // 需要迭代处理，将连续的引用行合并为一个 <blockquote>
    const lines: string[] = htmlText.split('\n');
    const finalLines: string[] = [];
    let currentBlockquote: string[] = [];
    let isExpandableBlockquote: boolean | null = null; // null: 非引用块, true: 可展开, false: 普通

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(>>|>)\s*(.*)$/);
      if (match) {
        const type = match[1]; // ">>" or ">"
        const content = match[2];

        if (currentBlockquote.length === 0) {
          // 新的引用块开始
          isExpandableBlockquote = type === '>>';
          currentBlockquote.push(content);
        } else if ((type === '>>' && isExpandableBlockquote) || (type === '>' && !isExpandableBlockquote)) {
          // 连续的同类型引用块
          currentBlockquote.push(content);
        } else {
          // 类型发生变化 (普通转可展开，或可展开转普通)，先闭合当前块
          const tag = isExpandableBlockquote ? '<blockquote expandable>' : '<blockquote>';
          finalLines.push(`${tag}${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
          currentBlockquote = [];
          isExpandableBlockquote = type === '>>'; // 开始新的引用块
          currentBlockquote.push(content);
        }
      } else {
        // 非引用块行
        if (currentBlockquote.length > 0) {
          // 闭合之前的引用块
          const tag = isExpandableBlockquote ? '<blockquote expandable>' : '<blockquote>';
          finalLines.push(`${tag}${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
          currentBlockquote = [];
          isExpandableBlockquote = null;
        }
        finalLines.push(line); // 直接添加非引用块行
      }
    }

    // 处理文件末尾可能未闭合的引用块
    if (currentBlockquote.length > 0) {
      const tag = isExpandableBlockquote ? '<blockquote expandable>' : '<blockquote>';
      finalLines.push(`${tag}${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
    }
    htmlText = finalLines.join('\n');

    return htmlText;
  } catch (error) {
    Log.error('格式化文本为 HTML 格式时发生错误:', { err: error });
    return markdownText; // 发生错误时返回原文
  }
};

/**
 * [改进] 将标准 Markdown 格式文本转换为 Telegram 的 MarkdownV2 格式
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 MarkdownV2 格式文本
 */
const markdownToMarkdownV2 = (markdownText: string): string => {
  let mdV2Text = markdownText;

  // 正则表达式的顺序至关重要
  const REGEX = {
    // 代码块和行内代码，其内容需要特殊转义
    CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g,
    INLINE_CODE: /`([^`]+?)`/g,
    // 链接，URL部分需要特殊转义 `)` 和 `\`
    LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
    // 粗体: **bold** (转换为 *bold*)
    BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g,
    // 下划线: __underline__
    UNDERLINE_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g,
    // 斜体: *italic* 或 _italic_ (转换为 _italic_)
    ITALIC_ASTERISK: /\*(?!\s)(.*?)(?<!\s)\*/g,
    ITALIC_UNDERSCORE: /_(?!\s)(.*?)(?<!\s)_/g,
    // 删除线: ~strikethrough~ (转换为 ~strikethrough~, 注意 Telegram MV2 是单 ~)
    STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
    // 剧透: ||spoiler||
    SPOILER: /\|\|(?!\s)(.*?)(?<!\s)\|\|/g,
    // 引用块 (包括可展开引用块，统一转为 > )
    BLOCKQUOTE_LINE: /^(>>|>)\s*(.*)$/gm,
  };

  try {
    // 1. 代码块 (内容转义 ` 和 `\`)
    mdV2Text = mdV2Text.replace(REGEX.CODE_BLOCK, (_, lang: string, code: string) => {
      const escapedCode = escapeMarkdownV2Code(code);
      return `\`\`\`${lang}\n${escapedCode}\`\`\``;
    });
    // 2. 行内代码 (内容转义 ` 和 `\`)
    mdV2Text = mdV2Text.replace(REGEX.INLINE_CODE, (_, code: string) => `\`${escapeMarkdownV2Code(code)}\``);

    // 3. 链接: [text](url) -> [转义后的text](转义后的url)
    mdV2Text = mdV2Text.replace(REGEX.LINK, (match, text: string, url: string) => {
      // 链接文本转义普通MV2字符，URL转义 `)` 和 `\`
      const escapedText = escapeMarkdownV2Text(text);
      const escapedUrl = escapeMarkdownV2LinkUrl(url);
      return `[${escapedText}](${escapedUrl})`;
    });

    // 4. 粗体: **bold** -> *bold*
    mdV2Text = mdV2Text.replace(REGEX.BOLD_ASTERISK, (_, content: string) => `*${escapeMarkdownV2Text(content)}*`);

    // 5. 下划线: __underline__ -> __underline__
    mdV2Text = mdV2Text.replace(REGEX.UNDERLINE_UNDERSCORE, (_, content: string) => `__${escapeMarkdownV2Text(content)}__`);

    // 6. 斜体: *italic* 或 _italic_ -> _italic_
    mdV2Text = mdV2Text.replace(REGEX.ITALIC_ASTERISK, (_, content: string) => `_${escapeMarkdownV2Text(content)}_`);
    mdV2Text = mdV2Text.replace(REGEX.ITALIC_UNDERSCORE, (_, content: string) => `_${escapeMarkdownV2Text(content)}_`);

    // 7. 删除线: ~strike~ -> ~strike~ (注意 Telegram MV2 是单 ~)
    mdV2Text = mdV2Text.replace(REGEX.STRIKETHROUGH, (_, content: string) => `~${escapeMarkdownV2Text(content)}~`);

    // 8. 剧透: ||spoiler|| -> ||spoiler||
    mdV2Text = mdV2Text.replace(REGEX.SPOILER, (_, content: string) => `||${escapeMarkdownV2Text(content)}||`);

    // 9. 引用块 (包括可展开引用块) -> 统一转为 `> ` 前缀
    // 引用块内容不进行 `escapeMarkdownV2Text` 额外转义，因为其内部可能有MV2标记
    mdV2Text = mdV2Text.replace(REGEX.BLOCKQUOTE_LINE, (_, prefix: string, content: string) => {
      // 这里的 content 已经被前面的规则处理过，可能包含 MV2 标记
      // 所以我们只添加前缀，不额外转义内容
      return `> ${content}`;
    });

    return mdV2Text;
  } catch (error) {
    Log.error('格式化文本为 MarkdownV2 格式时发生错误:', { err: error });
    return markdownText;
  }
};

/**
 * [改进] 将标准 Markdown 格式文本转换为 Telegram 的 Legacy Markdown 格式
 * 此格式限制很多，不支持嵌套，不支持删除线、下划线、剧透、引用块等。
 * 函数会尽力转换支持的格式，并移除不支持的格式，同时对输出进行正确的转义。
 * @param {string} markdownText - 标准 Markdown 格式文本
 * @returns {string} 转换后的 Legacy Markdown 格式文本
 */
const markdownToLegacyMarkdown = (markdownText: string): string => {
  let legacyMdText = markdownText;

  // 定义 Legacy Markdown 支持的标记的正则表达式
  const REGEX = {
    // 代码块和行内代码 (内容需要特殊转义)
    CODE_BLOCK: /```(\w*)\n([\s\S]+?)```/g,
    INLINE_CODE: /`([^`]+?)`/g,
    // 链接 (文本部分需要转义)
    LINK: /\[([^\]]+?)\]\(([^)]+?)\)/g,
    // 粗体: **bold** (转换为 *bold*)
    BOLD_ASTERISK: /\*\*(?!\s)(.*?)(?<!\s)\*\*/g,
    // 斜体: *italic* 或 _italic_ (转换为 _italic_)
    ITALIC_ASTERISK: /\*(?!\s)(.*?)(?<!\s)\*/g,
    ITALIC_UNDERSCORE: /_(?!\s)(.*?)(?<!\s)_/g,
    // 其他不支持的格式，将被移除标记，仅保留内容
    UNDERLINE_UNDERSCORE: /__(?!\s)(.*?)(?<!\s)__/g,
    STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
    SPOILER: /\|\|(?!\s)(.*?)(?<!\s)\|\|/g,
    BLOCKQUOTE_LINE: /^(>>|>)\s*(.*)$/gm,
  };

  try {
    // 1. 代码块 (内容转义 ` 和 `\`)
    legacyMdText = legacyMdText.replace(REGEX.CODE_BLOCK, (_, lang: string, code: string) => {
      const escapedCode = escapeMarkdownLegacyText(code); // Legacy 代码块内部只转义 ` 和 `\`
      return `\`\`\`${lang}\n${escapedCode}\`\`\``;
    });
    // 2. 行内代码 (内容转义 ` 和 `\`)
    legacyMdText = legacyMdText.replace(REGEX.INLINE_CODE, (_, code: string) => `\`${escapeMarkdownLegacyText(code)}\``);

    // 3. 链接: [text](url) -> [转义后的text](url)
    legacyMdText = legacyMdText.replace(REGEX.LINK, (match, text: string, url: string) => {
      const linkText = escapeMarkdownLegacyText(text); // 链接文本需要转义
      const linkUrl = escapeMarkdownLegacyLinkUrl(url); // URL不需额外转义
      return `[${linkText}](${linkUrl})`;
    });

    // 4. 粗体: **bold** -> *bold*
    legacyMdText = legacyMdText.replace(REGEX.BOLD_ASTERISK, (_, content: string) => `*${escapeMarkdownLegacyText(content)}*`);

    // 5. 斜体: *italic* 或 _italic_ -> _italic_
    legacyMdText = legacyMdText.replace(REGEX.ITALIC_ASTERISK, (_, content: string) => `_${escapeMarkdownLegacyText(content)}_`);
    legacyMdText = legacyMdText.replace(REGEX.ITALIC_UNDERSCORE, (_, content: string) => `_${escapeMarkdownLegacyText(content)}_`);

    // 6. 移除所有不支持的格式，并对其内容进行转义
    legacyMdText = legacyMdText.replace(REGEX.UNDERLINE_UNDERSCORE, (_, content: string) => escapeMarkdownLegacyText(content));
    legacyMdText = legacyMdText.replace(REGEX.STRIKETHROUGH, (_, content: string) => escapeMarkdownLegacyText(content));
    legacyMdText = legacyMdText.replace(REGEX.SPOILER, (_, content: string) => escapeMarkdownLegacyText(content));
    legacyMdText = legacyMdText.replace(REGEX.BLOCKQUOTE_LINE, (_, prefix: string, content: string) => escapeMarkdownLegacyText(content)); // 移除前缀

    // 7. 最后对所有未被标记捕获的普通文本中的 Legacy 特殊字符进行转义。
    // 这个步骤是必要的，因为前面的 regex 替换只处理了被标记包裹的内容。
    // 如果有裸露的特殊字符，例如 `_` `*` `[` `\` 等，它们需要被转义。
    let finalResult: string = '';
    let k: number = 0;
    const legacySpecialCharsToEscape: string = '_*`['; // Telegram Legacy 需要转义的字符
    const markersToSkipLength: Record<string, number> = {
      '```': 3, // 代码块开始
      '[': 1, // 链接开始
      '`': 1, // 行内代码开始
      '*': 1, // 粗体开始
      _: 1, // 斜体开始
    };

    while (k < legacyMdText.length) {
      let isMarkerStart = false;
      for (const marker in markersToSkipLength) {
        if (legacyMdText.substring(k, k + markersToSkipLength[marker]) === marker) {
          // 如果是标记的开始，则不转义这个字符
          // 并且是多字符标记，我们直接跳过整个标记长度。
          // 单字符标记 (如`*`, `_`, `` ` ``, `[`) 的平衡由前面的 regex 负责，
          // 这里的循环主要是为了转义 **未被任何标记捕获的** 特殊字符。
          // 实际上，如果之前的 regex 已经正确匹配并替换，那么这些字符应该不再以裸露形式存在。
          // 但 Legacy Markdown 的转义规则是针对 *不在实体内* 的字符。
          // 故此处的遍历是为了处理那些未被任何格式化规则捕获，但作为普通文本出现的特殊字符。
          isMarkerStart = true;
          break; // 跳出内部循环，继续外部循环
        }
      }

      if (isMarkerStart) {
        // 如果它被识别为标记的一部分，我们不应该在这里处理转义
        // 而应该由外部的正则替换处理，这里将其原样添加并移动指针
        finalResult += legacyMdText[k];
        k++;
        continue;
      }

      // 检查是否是转义字符本身
      if (legacyMdText[k] === '\\') {
        finalResult += '\\\\'; // 转义反斜杠自身
        k++;
        continue;
      }

      // 检查是否是需要转义的普通特殊字符
      if (legacySpecialCharsToEscape.includes(legacyMdText[k])) {
        finalResult += '\\' + legacyMdText[k];
        k++;
      } else {
        finalResult += legacyMdText[k];
        k++;
      }
    }

    return finalResult;
  } catch (error) {
    Log.error('格式化文本为 Legacy Markdown 格式时发生错误:', { err: error });
    return markdownText;
  }
};

/**
 * 将时间格式化为 UTC+8 时间
 * @param {Date|number} time 时间对象或时间戳（毫秒），默认为当前时间
 * @returns {string} 格式化后的时间字符串 (YYYY-MM-DD HH:mm:ss UTC+8)
 */
const formatTime = (time: Date | number = Date.now()): string => {
  // 确保 time 是 Date 对象
  const timeDate: Date = typeof time === 'number' ? new Date(time) : time;

  // 使用 Intl.DateTimeFormat 进行格式化，指定时区为 'Asia/Shanghai' (UTC+8)
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 使用24小时制
    timeZone: 'Asia/Shanghai',
  });

  // 使用 reduce 更简洁地从 formatToParts 中提取日期时间部分
  const parts = formatter.formatToParts(timeDate).reduce(
    (acc, { type, value }) => {
      if (type !== 'literal') {
        acc[type] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  ); // 使用类型断言确保 acc 的类型

  // 拼接成目标格式字符串
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} UTC+8`;
};

/**
 * 生成指定长度的16进制字符串 (加密安全)。
 * 此函数依赖 Node.js 的 `crypto` 模块。
 * @param {number} [length=16] 需要生成的字符串长度。必须是非负数。
 * @returns {string} 生成的16进制字符串。
 * @throws {Error} 如果 length 为负数。
 */
const secureHex = (length: number = 16): string => {
  if (length < 0) {
    throw new Error('secureHex: length 必须是非负数。');
  }
  // 计算所需的字节长度，向上取整以确保能生成足够长的16进制字符
  const byteLength: number = Math.ceil(length / 2);
  // 生成随机字节，转换为16进制字符串，然后截取到指定长度
  return randomBytes(byteLength).toString('hex').slice(0, length);
};

/**
 * 异步暂停指定毫秒数。
 * 此函数返回一个 Promise，该 Promise 在指定延迟后解析。
 * 它可以用于在异步函数中引入延迟，避免阻塞主线程。
 *
 * @param {number} delayMs - 延迟的毫秒数。必须是非负数。
 * @returns {Promise<void>} 一个 Promise，该 Promise 在 `delayMs` 毫秒后解析。
 * @throws {Error} 如果 delayMs 为负数。
 */
const sleep = async (delayMs: number): Promise<void> => {
  if (delayMs < 0) {
    throw new Error('sleep: delayMs 必须是非负数。');
  }
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

/**
 * 通用数组轮换器（不改变原数组，返回新数组）
 * @param arr 源数组（支持任意元素）
 * @param steps 轮换步数（默认 1）。若为负数，等价于相反方向的正数。
 * @param direction 'left' | 'right'（默认 'left'）。指定轮换方向。
 * @returns 轮换后的新数组
 */
const rotateArray = <T>(arr: readonly T[], steps: number = 1, direction: 'left' | 'right' = 'left'): T[] => {
  const len = arr.length;
  if (len === 0) return []; // 空数组直接返回空数组

  // 计算实际的轮换步数，取绝对值并模数组长度，确保步数在 [0, len-1] 范围内
  let actualSteps = Math.abs(steps) % len;

  // 根据方向和原始 steps 的正负，统一转换为“向左轮换”的等效步数
  // 如果是向右轮换，或者原始 steps 为负数（表示反方向），则将步数调整为向左轮换的等效步数
  if (direction === 'right' || steps < 0) {
    actualSteps = (len - actualSteps) % len; // N 步右旋等价于 (len - N) 步左旋
  }

  // 执行左轮换：将数组从 actualSteps 位置分割，然后拼接
  return arr.slice(actualSteps).concat(arr.slice(0, actualSteps));
};

/**
 * @param input 要简化的字符串
 * @returns 简化后的字符串或原字符串
 */
export const shortenString = (input: string): string => {
  const MAX = 4096;
  const HEAD = 2000;
  const TAIL = 2000;

  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }

  // 使用 Array.from 保持对 Unicode 代码点（包括 emoji）的正确处理
  const chars = Array.from(input);

  if (chars.length <= MAX) return input;

  const headPart = chars.slice(0, HEAD).join('');
  const tailPart = chars.slice(chars.length - TAIL).join('');
  return `${headPart}\n\n......\n\n${tailPart}`;
};

export const pcmBufferToOggOpus = async (pcmBuf: Buffer, opts: { rate?: number; channels?: number; bitrate?: string } = {}): Promise<Buffer> => {
  const rate = opts.rate ?? 24000;
  const channels = opts.channels ?? 1;
  const bitrate = opts.bitrate ?? '64k';

  return await new Promise<Buffer>((resolve, reject) => {
    const args = [
      '-f',
      's16le', // input format: signed 16-bit little endian
      '-ar',
      String(rate), // input sample rate
      '-ac',
      String(channels),
      '-i',
      'pipe:0', // read PCM from stdin
      '-c:a',
      'libopus',
      '-b:a',
      bitrate,
      '-vbr',
      'on',
      '-f',
      'ogg',
      'pipe:1', // write ogg to stdout
    ];

    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    ff.stdout.on('data', (c: Buffer) => outChunks.push(Buffer.from(c)));
    ff.stderr.on('data', (c: Buffer) => errChunks.push(Buffer.from(c)));

    ff.on('error', (err) => reject(new Error(`ffmpeg spawn error: ${String(err)}`)));

    ff.on('close', (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString() || `ffmpeg exited ${code}`;
        return reject(new Error(`ffmpeg failed: ${errMsg}`));
      }
      resolve(Buffer.concat(outChunks));
    });

    // 写入 PCM 并结束 stdin
    ff.stdin.write(pcmBuf);
    ff.stdin.end();
  });
};

export { markdownToHtml, markdownToMarkdownV2, markdownToLegacyMarkdown, formatTime, secureHex, sleep, rotateArray };
