// src/utils/formatting/formatters.ts

import { TelegramError } from '@/services';
import type { ParseMode } from '@/types';

/**
 * 将标准 Markdown 文本格式化为 Telegram Bot API 的 MarkdownV2 格式。
 * @param {string} markdownText - 标准 Markdown 格式的输入文本。
 * @returns {string} 格式化为 MarkdownV2 的文本。
 */
const formatToMarkdownV2 = (markdownText: string): string => {
  const escapeMarkdownV2General = (str: string): string => {
    return str.replace(/([_*[\]()~`>#+-=|{}.!\\])/g, '\\$1');
  };
  const escapeMarkdownV2Code = (str: string): string => {
    return str.replace(/([`\\])/g, '\\$1');
  };
  const escapeMarkdownV2LinkUrl = (str: string): string => {
    return str.replace(/([)\\])/g, '\\$1');
  };

  let processedText: string = markdownText;

  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string) => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`\`\`${lang}\n${escapedCode}\`\`\``;
  });

  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`${escapedCode}\``; // 修正语法
  });

  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const escapedText = escapeMarkdownV2General(text);
    const escapedUrl = escapeMarkdownV2LinkUrl(url);
    return `[${escapedText}](${escapedUrl})`;
  });

  processedText = processedText.replace(/~~(.*?)~~/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2General(content);
    return `~~${escapedContent}~~`;
  });

  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2General(content);
    return `*${escapedContent}*`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2General(content);
    return `*${escapedContent}*`;
  });

  processedText = processedText.replace(/(?<!\*)\*(?!\*)(?!\s)(.*?)(?<!\s)\*(?!\*)/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2General(content);
    return `\\*${escapedContent}\\*`;
  });
  processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2General(content);
    return `_${escapedContent}_`;
  });

  const lines: string[] = processedText.split('\n');
  const processedLines = lines.map((line) => {
    if (line.startsWith('> ')) {
      return '> ' + escapeMarkdownV2General(line.substring(2));
    }
    return line;
  });
  processedText = processedLines.join('\n');

  let finalResult: string = '';
  let k: number = 0;
  const mv2SpecialChars: string = '_*[]()~`>#+-=|{}.!\\';
  const markersToSkip: string[] = ['```', '~~', '||', '[', '(', '> '];

  while (k < processedText.length) {
    let isMarker: boolean = false;
    for (const marker of markersToSkip) {
      if (processedText.substring(k, k + marker.length) === marker) {
        finalResult += marker;
        k += marker.length;
        isMarker = true;
        break;
      }
    }
    if (isMarker) continue;

    if (processedText[k] === ']' || processedText[k] === ')') {
      finalResult += processedText[k];
      k++;
      continue;
    }

    const char = processedText[k];
    if (mv2SpecialChars.includes(char)) {
      finalResult += '\\' + char;
      k++;
    } else {
      finalResult += char;
      k++;
    }
  }

  return finalResult;
};

/**
 * 将标准 Markdown 文本格式化为 Telegram Bot API 的 HTML 格式。
 * @param {string} markdownText - 标准 Markdown 格式的输入文本。
 * @returns {string} 格式化为 HTML 的文本。
 */
const formatToHTML = (markdownText: string): string => {
  const escapeHTML = (str: string): string => {
    return str.replace(/[<>&]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        default:
          return c;
      }
    });
  };

  let processedText: string = markdownText;

  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string): string => {
    // const escapedCode = escapeHTML(code);
    if (lang) {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    }
    return `<pre>${code}</pre>`;
  });

  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeHTML(code);
    return `<code>${escapedCode}</code>`;
  });

  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const escapedText = escapeHTML(text);
    const escapedUrl = escapeHTML(url);
    return `<a href="${escapedUrl}">${escapedText}</a>`;
  });

  processedText = processedText.replace(/~~(.*?)~~/g, (match, content: string): string => {
    const escapedContent = escapeHTML(content);
    return `<s>${escapedContent}</s>`;
  });

  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const escapedContent = escapeHTML(content);
    return `<b>${escapedContent}</b>`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    const escapedContent = escapeHTML(content);
    return `<b>${escapedContent}</b>`;
  });

  processedText = processedText.replace(/(?<!\*)\*(?!\*)(?!\s)(.*?)(?<!\s)\*(?!\*)/g, (match, content: string): string => {
    const escapedContent = escapeHTML(content);
    return `<i>${escapedContent}</i>`;
  });
  // processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content) => {
  // 	const escapedContent = escapeHTML(content);
  // 	return `<i>${escapedContent}</i>`;
  // });

  const lines: string[] = processedText.split('\n');
  const finalLines: string[] = [];
  let currentBlockquote: string[] = [];

  for (const line of lines) {
    if (line.startsWith('> ')) {
      currentBlockquote.push(line.substring(2));
    } else {
      if (currentBlockquote.length > 0) {
        finalLines.push(`<blockquote>${escapeHTML(currentBlockquote.join('\n'))}</blockquote>`);
        currentBlockquote = [];
      }
      finalLines.push(line);
    }
  }
  if (currentBlockquote.length > 0) {
    finalLines.push(`<blockquote>${escapeHTML(currentBlockquote.join('\n'))}</blockquote>`);
  }
  processedText = finalLines.join('\n');

  let finalResult: string = '';
  let k: number = 0;
  let inTag: boolean = false;

  while (k < processedText.length) {
    const char = processedText[k];

    if (char === '<') {
      inTag = true;
      finalResult += char;
    } else if (char === '>') {
      inTag = false;
      finalResult += char;
    } else if (inTag) {
      finalResult += char;
    } else {
      finalResult += escapeHTML(char);
    }
    k++;
  }

  return finalResult;
};

/**
 * 将标准 Markdown 文本格式化为 Telegram Bot API 的 Markdown (Legacy) 格式。
 * @param {string} markdownText - 标准 Markdown 格式的输入文本。
 * @returns {string} 格式化为 Markdown (Legacy) 的文本。
 */
const formatToMarkdownLegacy = (markdownText: string): string => {
  const escapeMarkdownLegacyCode = (str: string): string => {
    return str.replace(/([`\\])/g, '\\$1');
  };

  let processedText: string = markdownText;

  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string) => {
    const escapedCode = escapeMarkdownLegacyCode(code);
    return `\`\`\`${lang}\n${escapedCode}\`\`\``;
  });

  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeMarkdownLegacyCode(code);
    return `\`${escapedCode}\``; // 修正语法
  });

  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const linkText = text;
    const linkUrl = url;
    return `[${linkText}](${linkUrl})`;
  });

  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const innerContent = content;
    return `*${innerContent}*`;
  });
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    const innerContent = content;
    return `*${innerContent}*`;
  });

  processedText = processedText.replace(/(?<!\*)\*(?!\*)(?!\s)(.*?)(?<!\s)\*(?!\*)/g, (match, content: string): string => {
    const innerContent = content;
    return `\\*${innerContent}\\*`;
  });
  processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content: string): string => {
    const innerContent = content;
    return `_${innerContent}_`;
  });

  let finalResult: string = '';
  let k: number = 0;
  const legacySpecialChars: string = '_*`[';
  const markersToSkip: string[] = ['```', '[', '('];

  while (k < processedText.length) {
    let isMarker: boolean = false;
    for (const marker of markersToSkip) {
      if (processedText.substring(k, k + marker.length) === marker) {
        finalResult += marker;
        k += marker.length;
        isMarker = true;
        break;
      }
    }
    if (isMarker) continue;

    if (processedText[k] === ']' || processedText[k] === ')') {
      finalResult += processedText[k];
      k++;
      continue;
    }

    const char: string = processedText[k];
    if (legacySpecialChars.includes(char)) {
      finalResult += '\\' + char;
      k++;
    } else if (char === '\\') {
      finalResult += '\\' + char;
      k++;
    } else {
      finalResult += char;
      k++;
    }
  }

  return finalResult;
};

/**
 * 根据 parseMode 格式化文本。
 * @param {string} text - 原始或部分原始文本。
 * @param {ParseMode | null} parseMode - 目标格式 ('HTML', 'MarkdownV2', 'Markdown', null)。
 * @returns {string} 格式化后的文本。
 * @throws {TelegramError} 如果 parseMode 无效 (除了 null)。
 */
function formatText(text: string, parseMode: ParseMode | null): string {
  if (parseMode === null) {
    return text;
  }
  switch (parseMode) {
    case 'HTML':
      return formatToHTML(text);
    case 'MarkdownV2':
      return formatToMarkdownV2(text);
    case 'Markdown':
      return formatToMarkdownLegacy(text);
    default:
      throw new TelegramError(`不支持的 parseMode: ${parseMode}`);
  }
}

export { formatToMarkdownV2, formatToHTML, formatToMarkdownLegacy, formatText };
