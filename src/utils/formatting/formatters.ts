// src/utils/formatting/formatters.ts

import { TelegramError } from '@/services';
import type { ParseMode } from '@/types';

export interface MarkdownMarkRegex {
  // 代码块必须最先匹配，因为其内部内容不应被其他规则解析
  CODE_BLOCK: RegExp;
  // 行内代码
  INLINE_CODE: RegExp;
  // 链接
  LINK: RegExp;
  // 粗体: **bold**
  BOLD_ASTERISK: RegExp;
  // 下划线: __underline__ (Telegram HTML 对应 <u>)
  UNDERLINE_UNDERSCORE: RegExp;
  // 删除线: ~strikethrough~
  STRIKETHROUGH: RegExp;
  // 剧透: ||spoiler||
  SPOILER: RegExp;
  // 引用块和可展开引用块 (行前缀，需要特殊处理多行)
  BLOCKQUOTE_LINE: RegExp;
}

export const MARKDOWN_MARK_REGEX: MarkdownMarkRegex = {
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
  // 删除线: ~strikethrough~
  STRIKETHROUGH: /~(?!\s)(.*?)(?<!\s)~/g,
  // 剧透: ||spoiler||
  SPOILER: /\|\|(?!\s)([\s\S]*?)(?<!\s)\|\|/g,
  // 引用块和可展开引用块 (行前缀，需要特殊处理多行)
  BLOCKQUOTE_LINE: /^(>>? .+(?:\n>>? .+)*)/gm, // 匹配所有引用行
};

class Escapers {
  public markdownV2Text = (str: string): string => {
    return str.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
  };

  public markdownV2Code = (str: string): string => {
    return str.replace(/([`\\])/g, '\\$1');
  };

  public markdownV2Url = (str: string): string => {
    return str.replace(/([)\\])/g, '\\$1');
  };

  public Html = (str: string): string => {
    return str.replace(/[<>&]/g, (c) => {
      switch (c) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        default:
          return c;
      }
    });
  };

  public markdown = (str: string): string => {
    return str.replace(/([_*[`])/g, '\\$1');
  };
}

export const escapers: Escapers = new Escapers();

class Formatters {
  /**
   * 将标准 Markdown 文本格式化为 Telegram Bot API 的 MarkdownV2 格式。
   * 遵循用户自定义的输入规范：**粗体**, __下划线__, _斜体_, ~删除线~, ||剧透||, `行内代码`, ```代码块```, [链接文本](URL), > 引用块, >> 可展开引用块。
   *
   * @param {string} markdownText - 标准 Markdown 格式的输入文本。
   * @returns {string} 格式化为 MarkdownV2 的文本。
   */
  public markdownV2 = (markdownText: string): string => {
    let processedText: string = markdownText;

    // 1. 代码块 (```` ``` ````) - 内容转义 ` 和 `\`
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang: string, code: string) => {
      const escapedCode = escapers.markdownV2Code(code);
      return `\`\`\`${lang}\n${escapedCode}\n\`\`\``;
    });

    // 2. 行内代码 (`` ` ``) - 内容转义 ` 和 `\`
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code: string): string => {
      const escapedCode = escapers.markdownV2Code(code);
      return `\`${escapedCode}\``;
    });

    // 3. 链接 ([文本](URL)) - 文本转义普通字符，URL转义 `)` 和 `\`
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text: string, url: string): string => {
      const escapedText = escapers.markdownV2Text(text);
      const escapedUrl = escapers.markdownV2Url(url);
      return `[${escapedText}](${escapedUrl})`;
    });

    // 4. 剧透 (||剧透||) - 内容转义普通字符
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content: string): string => {
      const escapedContent = escapers.markdownV2Text(content);
      return `||${escapedContent}||`;
    });

    // 5. 删除线 (~删除线~) - 内容转义普通字符
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content: string): string => {
      const escapedContent = escapers.markdownV2Text(content);
      return `~${escapedContent}~`;
    });

    // 6. 粗体 (**粗体**) -> Telegram MV2 的 *粗体* - 内容转义普通字符
    // 注意：此处是标准 Markdown **粗体** 映射到 Telegram MarkdownV2 的 *粗体*
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content: string): string => {
      const escapedContent = escapers.markdownV2Text(content);
      return `*${escapedContent}*`;
    });

    // 7. 下划线 (__下划线__) -> Telegram MV2 的 __下划线__ - 内容转义普通字符
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content: string): string => {
      const escapedContent = escapers.markdownV2Text(content);
      return `__${escapedContent}__`;
    });

    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BLOCKQUOTE_LINE, (match, content: string) => {
      // 这里的 content 可能已经包含了转义和格式化，所以我们不再对其进行 escapers.markdownV2Text
      return `> ${content}`;
    });

    return processedText;
  };

  /**
   * 将标准 Markdown 文本格式化为 Telegram Bot API 的 HTML 格式。
   * 遵循用户自定义的输入规范：**粗体**, __下划线__, _斜体_, ~删除线~, ||剧透||, `行内代码`, ```代码块```, [链接文本](URL), > 引用块, >> 可展开引用块。
   *
   * @param {string} markdownText - 标准 Markdown 格式的输入文本。
   * @returns {string} 格式化为 HTML 的文本。
   */
  public Html = (markdownText: string): string => {
    let processedText: string = markdownText;

    // 1. 代码块 (```` ``` ````) - HTML中内容不转义，但包裹在 <pre><code> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang: string, code: string): string => {
      // HTML模式下，<pre><code> 内部的原始内容不进行HTML实体转义。
      // 但是，Telegram API文档指出：Use nested pre and code tags, to define programming language for pre entity.
      // 编程语言通过 <code class="language-python"> 实现。
      if (lang) {
        return `<pre><code class="language-${escapers.Html(lang)}">${code}</code></pre>`;
      }
      return `<pre>${code}</pre>`;
    });

    // 2. 行内代码 (`` ` ``) - HTML中内容转义，包裹在 <code> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code: string): string => {
      const escapedCode = escapers.Html(code);
      return `<code>${escapedCode}</code>`;
    });

    // 3. 链接 ([文本](URL)) - 文本和URL都转义，包裹在 <a> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text: string, url: string): string => {
      const escapedText = escapers.Html(text);
      const escapedUrl = escapers.Html(url); // URL中的特殊字符也需转义
      return `<a href="${escapedUrl}">${escapedText}</a>`;
    });

    // 4. 剧透 (||剧透||) - 内容转义，包裹在 <span class="tg-spoiler"> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content: string): string => {
      const escapedContent = escapers.Html(content);
      return `<span class="tg-spoiler">${escapedContent}</span>`;
    });

    // 5. 删除线 (~删除线~) - 内容转义，包裹在 <s> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content: string): string => {
      const escapedContent = escapers.Html(content);
      return `<s>${escapedContent}</s>`;
    });

    // 6. 粗体 (**粗体**) - 内容转义，包裹在 <b> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content: string): string => {
      const escapedContent = escapers.Html(content);
      return `<b>${escapedContent}</b>`;
    });

    // 7. 下划线 (__下划线__) - 内容转义，包裹在 <u> 标签中
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content: string): string => {
      const escapedContent = escapers.Html(content);
      return `<u>${escapedContent}</u>`;
    });

    processedText = processedText.replace(/^(>>? .+(?:\n>>? .+)*)/gm, (match) => {
      const isExpandable = match.startsWith('>>');
      // 移除每行行首的 '>' 或 '>>' 及随后的空格
      const content = match.replace(/^(>>?)\s/gm, '');
      const escapedContent = escapers.Html(content);

      if (isExpandable) {
        return `<blockquote expandable>${escapedContent}</blockquote>`;
      }
      return `<blockquote>${escapedContent}</blockquote>`;
    });

    return processedText;
  };

  /**
   * 将标准 Markdown 文本格式化为 Telegram Bot API 的 Markdown (Legacy) 格式。
   * 遵循用户自定义的输入规范：**粗体**, __下划线__, _斜体_, ~删除线~, ||剧透||, `行内代码`, ```代码块```, [链接文本](URL)。
   * Legacy Markdown 不支持下划线、删除线、剧透、引用块和嵌套。
   *
   * @param {string} markdownText - 标准 Markdown 格式的输入文本。
   * @returns {string} 格式化为 Markdown (Legacy) 的文本。
   */
  public markdown = (markdownText: string): string => {
    let processedText: string = markdownText;

    // 1. 代码块 (```` ``` ````) - 内容转义 ` 和 `\`
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.CODE_BLOCK, (match, lang: string, code: string) => {
      const escapedCode = escapers.markdown(code); // Legacy 代码块内部只转义 ` 和 `\`
      return `\`\`\`${lang}\n${escapedCode}\n\`\`\``;
    });

    // 2. 行内代码 (`` ` ``) - 内容转义 ` 和 `\`
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.INLINE_CODE, (match, code: string): string => {
      const escapedCode = escapers.markdown(code); // Legacy 行内代码内部只转义 ` 和 `\`
      return `\`${escapedCode}\``;
    });

    // 3. 链接 ([文本](URL)) - 文本转义普通字符，URL不转义
    // Legacy Markdown 链接不支持嵌套和URL特殊字符转义。
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.LINK, (match, text: string, url: string): string => {
      const linkText = escapers.markdown(text); // 链接文本需要转义
      return `[${linkText}](${url})`;
    });

    // 4. 粗体 (**粗体**) -> Telegram Legacy 的 *粗体* - 内容转义普通字符
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BOLD_ASTERISK, (match, content: string): string => {
      const innerContent = escapers.markdown(content);
      return `*${innerContent}*`;
    });

    // 6. 下划线 (__下划线__) - Legacy 不支持，移除标记，内容转义
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.UNDERLINE_UNDERSCORE, (match, content: string): string => {
      return escapers.markdown(content);
    });

    // 7. 删除线 (~删除线~) - Legacy 不支持，移除标记，内容转义
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.STRIKETHROUGH, (match, content: string): string => {
      return escapers.markdown(content);
    });

    // 8. 剧透 (||剧透||) - Legacy 不支持，移除标记，内容转义
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.SPOILER, (match, content: string): string => {
      return escapers.markdown(content);
    });

    // 9. 引用块 (> 引用内容) 和 可展开引用块 (>> 可展开引用块) - Legacy 不支持，移除前缀，内容转义
    processedText = processedText.replace(MARKDOWN_MARK_REGEX.BLOCKQUOTE_LINE, (match, content: string) => {
      return escapers.markdown(content);
    });

    // 最后的通用转义，处理所有未被标记捕获的普通文本中的 Legacy 特殊字符。
    // 确保已经作为标记或其内容一部分的字符不再被重复转义。
    // 此处遍历是必需的，因为之前的 regex 仅处理特定模式，无法保证所有裸露的特殊字符都被转义。
    let finalResult: string = '';
    let k: number = 0;
    const legacySpecialChars: string = '_*`['; // Telegram Legacy 需要转义的字符，不包括 `\` 因为 `\` 自身要转义
    const markersToSkip: string[] = ['```', '[', '`', '*', '_']; // 这些标记的开头不应被转义

    while (k < processedText.length) {
      let isMarkerStart: boolean = false;
      // 检查是否是多字符标记的开始
      for (const marker of markersToSkip) {
        if (processedText.substring(k, k + marker.length) === marker) {
          // 如果是标记的开始，则不转义这个字符
          finalResult += processedText[k];
          k++;
          isMarkerStart = true;
          break;
        }
      }
      if (isMarkerStart) {
        continue;
      }

      // 检查是否是转义字符本身
      if (processedText[k] === '\\') {
        finalResult += '\\\\'; // 转义反斜杠自身
        k++;
        continue;
      }

      // 检查是否是需要转义的普通特殊字符
      if (legacySpecialChars.includes(processedText[k])) {
        finalResult += '\\' + processedText[k];
        k++;
      } else {
        finalResult += processedText[k];
        k++;
      }
    }

    return finalResult;
  };
}

export const formatters: Formatters = new Formatters();

/**
 * 根据 parseMode 格式化文本。
 * @param {string} text - 原始或部分原始文本。
 * @param {ParseMode | null} parseMode - 目标格式 ('HTML', 'MarkdownV2', 'Markdown', null)。
 * @returns {string} 格式化后的文本。
 * @throws {TelegramError} 如果 parseMode 无效 (除了 null)。
 */
export function formatText(text: string, parseMode: ParseMode | null): string {
  if (parseMode === null) {
    // 纯文本模式，对HTML/Markdown特殊字符进行安全转义，避免它们被客户端误解析
    return escapers.Html(text);
  }
  switch (parseMode) {
    case 'HTML':
      return formatters.Html(text);
    case 'MarkdownV2':
      return formatters.markdownV2(text);
    case 'Markdown':
      return formatters.markdown(text);
    default:
      throw new TelegramError(`不支持的 parseMode: ${parseMode}`);
  }
}
