// src/utils/formatting/formatters.ts

import { TelegramError } from '@/services';
import type { ParseMode } from '@/types';

// --- MarkdownV2 转义函数 ---

/**
 * 转义 MarkdownV2 普通文本中的特殊字符。
 * 字符 '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!', '\' 必须被转义。
 * @param {string} str - 待转义的字符串。
 * @returns {string} 转义后的字符串。
 */
export const escapeMarkdownV2Text = (str: string): string => {
  return str.replace(/([_*[\]()~`>#+-=|{}.!\\])/g, '\\$1');
};

/**
 * 转义 MarkdownV2 代码块和行内代码中的特殊字符。
 * 字符 '`', '\' 必须被转义。
 * @param {string} str - 待转义的字符串。
 * @returns {string} 转义后的字符串。
 */
export const escapeMarkdownV2Code = (str: string): string => {
  return str.replace(/([`\\])/g, '\\$1');
};

/**
 * 转义 MarkdownV2 链接 URL 部分中的特殊字符。
 * 字符 ')', '\' 必须被转义。
 * @param {string} str - 待转义的字符串。
 * @returns {string} 转义后的字符串。
 */
export const escapeMarkdownV2LinkUrl = (str: string): string => {
  return str.replace(/([)\\])/g, '\\$1');
};

// --- HTML 转义函数 ---

/**
 * 转义 HTML 普通文本和属性中的特殊字符。
 * 字符 '<', '>', '&', '"' 必须被转义。
 * @param {string} str - 待转义的字符串。
 * @returns {string} 转义后的字符串。
 */
export const escapeHtml = (str: string): string => {
  return str.replace(/[<>&"]/g, (c) => {
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

// --- Markdown (Legacy) 转义函数 ---

/**
 * 转义 Markdown (Legacy) 普通文本中的特殊字符。
 * 字符 '_', '*', '`', '[', '\' 必须被转义。
 * @param {string} str - 待转义的字符串。
 * @returns {string} 转义后的字符串。
 */
export const escapeMarkdownLegacyText = (str: string): string => {
  return str.replace(/([_*`[\\])/g, '\\$1');
};

/**
 * Markdown (Legacy) 链接 URL 部分无需特殊转义 (除了内部的 `\)` )。
 * @param {string} str - 待处理的字符串。
 * @returns {string} 原始字符串。
 */
export const escapeMarkdownLegacyLinkUrl = (str: string): string => {
  return str; // Legacy Markdown 的 URL 部分不进行额外转义，避免破坏链接
};

/**
 * 将标准 Markdown 文本格式化为 Telegram Bot API 的 MarkdownV2 格式。
 * 遵循用户自定义的输入规范：**粗体**, __下划线__, _斜体_, ~删除线~, ||剧透||, `行内代码`, ```代码块```, [链接文本](URL), > 引用块, >> 可展开引用块。
 *
 * @param {string} markdownText - 标准 Markdown 格式的输入文本。
 * @returns {string} 格式化为 MarkdownV2 的文本。
 */
const formatToMarkdownV2 = (markdownText: string): string => {
  let processedText: string = markdownText;

  // 1. 代码块 (```` ``` ````) - 内容转义 ` 和 `\`
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string) => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`\`\`${lang}\n${escapedCode}\`\`\``;
  });

  // 2. 行内代码 (`` ` ``) - 内容转义 ` 和 `\`
  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeMarkdownV2Code(code);
    return `\`${escapedCode}\``;
  });

  // 3. 链接 ([文本](URL)) - 文本转义普通字符，URL转义 `)` 和 `\`
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const escapedText = escapeMarkdownV2Text(text);
    const escapedUrl = escapeMarkdownV2LinkUrl(url);
    return `[${escapedText}](${escapedUrl})`;
  });

  // 4. 剧透 (||剧透||) - 内容转义普通字符
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `||${escapedContent}||`;
  });

  // 5. 删除线 (~删除线~) - 内容转义普通字符
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `~${escapedContent}~`;
  });

  // 6. 粗体 (**粗体**) -> Telegram MV2 的 *粗体* - 内容转义普通字符
  // 注意：此处是标准 Markdown **粗体** 映射到 Telegram MarkdownV2 的 *粗体*
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `*${escapedContent}*`;
  });

  // 7. 下划线 (__下划线__) -> Telegram MV2 的 __下划线__ - 内容转义普通字符
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    const escapedContent = escapeMarkdownV2Text(content);
    return `__${escapedContent}__`;
  });

  // 8. 斜体 (_斜体_) -> Telegram MV2 的 _斜体_ - 内容转义普通字符
  // 注意：需要确保不匹配到 __下划线__ 的情况。
  // (?<!_)_ 匹配前面不是_的_  (?!_)匹配后面不是_的_
  // (?<!\s)匹配前面不是空格的  (?!\s)匹配后面不是空格的
  // processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content: string): string => {
  //   const escapedContent = escapeMarkdownV2Text(content);
  //   return `_${escapedContent}_`;
  // });

  // 9. 引用块 (> 引用内容) 和 可展开引用块 (>> 可展开引用内容)
  // Telegram MV2 对这两种都使用 "> " 前缀。内容不应被转义，因为转义规则适用于文本，而非块引用本身。
  // 为了避免对引用块内部的文本进行转义，我们先处理其他行内格式。
  // 块引用是行前缀，其内容通常不被转义（除非内容中包含需要转义的 MV2 标记）。
  // 这里的策略是，将引用块的 `>` 或 `>>` 前缀与行内容分开处理。
  // 由于 `escapeMarkdownV2Text` 已经对大部分文本进行了转义，此处仅处理前缀。
  // 保持引用块内容不进行额外转义，但其内部可能已通过前面步骤格式化。

  // 处理可展开引用块 (>>)，将其转换为普通引用块的 "> " 前缀。
  // Telegram MV2 的可展开引用块的标记与普通引用块相同，区别在于 API 参数或内容组织。
  // 在格式化阶段，我们只处理前缀。
  processedText = processedText.replace(/^>>\s*(.*)$/gm, (match, content: string) => {
    // 这里的 content 可能已经包含了转义和格式化，所以我们不再对其进行 escapeMarkdownV2Text
    return `> ${content}`;
  });

  // 处理普通引用块 (>)
  // 同理，这里的 content 可能已经包含了转义和格式化。
  processedText = processedText.replace(/^>\s*(.*)$/gm, (match, content: string) => {
    return `> ${content}`;
  });

  // 最后，对所有未被以上规则匹配的普通文本（包括可能存在的行首字符）进行通用转义。
  // 此处应谨慎，避免对已格式化的标记或其内部内容再次转义。
  // 最佳实践是在每个替换函数中对 'content' 进行转义，而不是在最后进行全局转义。
  // 因此，此处不再进行全局字符遍历转义，因为大部分内容在各自的捕获组中已完成转义。
  // 如果有未被任何 Markdown 标记捕获的裸字符需要转义，则需要一个更复杂的解析器。
  // 考虑到性能和复杂度，我们依赖于前面每个格式化替换函数中对内容的精确转义。
  // 如果用户输入中存在未被标记包裹的 MV2 特殊字符，且这些字符需要转义，
  // 那么在 `balanceChunkTags` 之前，可以考虑对整个 `processedText` 再次进行 `escapeMarkdownV2Text`，
  // 但这可能会导致已经作为标记的字符被转义。目前设计是依赖 `balanceChunkTags` 来处理跨块的转义。
  return processedText;
};

/**
 * 将标准 Markdown 文本格式化为 Telegram Bot API 的 HTML 格式。
 * 遵循用户自定义的输入规范：**粗体**, __下划线__, _斜体_, ~删除线~, ||剧透||, `行内代码`, ```代码块```, [链接文本](URL), > 引用块, >> 可展开引用块。
 *
 * @param {string} markdownText - 标准 Markdown 格式的输入文本。
 * @returns {string} 格式化为 HTML 的文本。
 */
const formatToHtml = (markdownText: string): string => {
  let processedText: string = markdownText;

  // 1. 代码块 (```` ``` ````) - HTML中内容不转义，但包裹在 <pre><code> 标签中
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string): string => {
    // HTML模式下，<pre><code> 内部的原始内容不进行HTML实体转义。
    // 但是，Telegram API文档指出：Use nested pre and code tags, to define programming language for pre entity.
    // 编程语言通过 <code class="language-python"> 实现。
    if (lang) {
      return `<pre><code class="language-${escapeHtml(lang)}">${code}</code></pre>`;
    }
    return `<pre>${code}</pre>`;
  });

  // 2. 行内代码 (`` ` ``) - HTML中内容转义，包裹在 <code> 标签中
  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeHtml(code);
    return `<code>${escapedCode}</code>`;
  });

  // 3. 链接 ([文本](URL)) - 文本和URL都转义，包裹在 <a> 标签中
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const escapedText = escapeHtml(text);
    const escapedUrl = escapeHtml(url); // URL中的特殊字符也需转义
    return `<a href="${escapedUrl}">${escapedText}</a>`;
  });

  // 4. 剧透 (||剧透||) - 内容转义，包裹在 <span class="tg-spoiler"> 标签中
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content: string): string => {
    const escapedContent = escapeHtml(content);
    return `<span class="tg-spoiler">${escapedContent}</span>`;
  });

  // 5. 删除线 (~删除线~) - 内容转义，包裹在 <s> 标签中
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content: string): string => {
    const escapedContent = escapeHtml(content);
    return `<s>${escapedContent}</s>`;
  });

  // 6. 粗体 (**粗体**) - 内容转义，包裹在 <b> 标签中
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const escapedContent = escapeHtml(content);
    return `<b>${escapedContent}</b>`;
  });

  // 7. 下划线 (__下划线__) - 内容转义，包裹在 <u> 标签中
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    const escapedContent = escapeHtml(content);
    return `<u>${escapedContent}</u>`;
  });

  // 8. 斜体 (_斜体_) - 内容转义，包裹在 <i> 标签中
  // 同MV2，确保不匹配到 __下划线__ 的情况。
  // processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content: string): string => {
  //   const escapedContent = escapeHtml(content);
  //   return `<i>${escapedContent}</i>`;
  // });

  // 9. 引用块 (> 引用内容) 和 可展开引用块 (>> 可展开引用块)
  // HTML 引用块需要将连续的引用行合并到一个 <blockquote> 标签中。
  const lines: string[] = processedText.split('\n');
  const finalLines: string[] = [];
  let currentBlockquote: string[] = [];
  let isExpandableBlockquote: boolean = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('>> ')) {
      // 可展开引用块
      if (currentBlockquote.length === 0) {
        // 新的可展开引用块开始
        isExpandableBlockquote = true;
      } else if (!isExpandableBlockquote) {
        // 如果前面是普通引用块，先闭合
        finalLines.push(`<blockquote>${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = true; // 开始新的可展开引用块
      }
      currentBlockquote.push(line.substring(3)); // 移除 ">> " 前缀
    } else if (line.startsWith('> ')) {
      // 普通引用块
      if (currentBlockquote.length === 0) {
        // 新的普通引用块开始
        isExpandableBlockquote = false;
      } else if (isExpandableBlockquote) {
        // 如果前面是可展开引用块，先闭合
        finalLines.push(`<blockquote expandable>${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = false; // 开始新的普通引用块
      }
      currentBlockquote.push(line.substring(2)); // 移除 "> " 前缀
    } else {
      // 非引用块行
      if (currentBlockquote.length > 0) {
        // 闭合之前的引用块
        const tag = isExpandableBlockquote ? '<blockquote expandable>' : '<blockquote>';
        finalLines.push(`${tag}${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
        currentBlockquote = [];
        isExpandableBlockquote = false;
      }
      finalLines.push(line); // 直接添加非引用块行
    }
  }

  // 处理文件末尾可能未闭合的引用块
  if (currentBlockquote.length > 0) {
    const tag = isExpandableBlockquote ? '<blockquote expandable>' : '<blockquote>';
    finalLines.push(`${tag}${escapeHtml(currentBlockquote.join('\n'))}</blockquote>`);
  }
  processedText = finalLines.join('\n');

  // 最后，对所有未被以上规则匹配的普通文本进行通用 HTML 转义。
  // 注意：此处不再进行字符遍历，因为每个替换函数都已对其内容进行了转义。
  // 如果有未被 Markdown 标记捕获的裸字符需要转义，则通过一次全局替换来完成。
  // 但是，这样会导致已经通过其他规则转义过的字符被重复转义。
  // 最好的方法是在所有 Markdown 转换完成后，对整个文本进行一次最终的 HTML 转义，
  // 但要小心不要转义标签本身。
  // 考虑到在 `balanceChunkTags` 中已经有一个 `escapeHtml` 的逻辑来处理标签外的字符，
  // 并且每个匹配规则的 `content` 已经 `escapeHtml`。
  // 此处可信任前面规则的正确性，不再做额外的全局转义。
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
const formatToMarkdownLegacy = (markdownText: string): string => {
  let processedText: string = markdownText;

  // 1. 代码块 (```` ``` ````) - 内容转义 ` 和 `\`
  processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang: string, code: string) => {
    const escapedCode = escapeMarkdownLegacyText(code); // Legacy 代码块内部只转义 ` 和 `\`
    return `\`\`\`${lang}\n${escapedCode}\`\`\``;
  });

  // 2. 行内代码 (`` ` ``) - 内容转义 ` 和 `\`
  processedText = processedText.replace(/`(.*?)`/g, (match, code: string): string => {
    const escapedCode = escapeMarkdownLegacyText(code); // Legacy 行内代码内部只转义 ` 和 `\`
    return `\`${escapedCode}\``;
  });

  // 3. 链接 ([文本](URL)) - 文本转义普通字符，URL不转义
  // Legacy Markdown 链接不支持嵌套和URL特殊字符转义。
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text: string, url: string): string => {
    const linkText = escapeMarkdownLegacyText(text); // 链接文本需要转义
    const linkUrl = escapeMarkdownLegacyLinkUrl(url); // URL不需转义，保持原样
    return `[${linkText}](${linkUrl})`;
  });

  // 4. 粗体 (**粗体**) -> Telegram Legacy 的 *粗体* - 内容转义普通字符
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, content: string): string => {
    const innerContent = escapeMarkdownLegacyText(content);
    return `*${innerContent}*`;
  });

  // 5. 斜体 (_斜体_) -> Telegram Legacy 的 _斜体_ - 内容转义普通字符
  // processedText = processedText.replace(/(?<!_)_(?!_)(?!\s)(.*?)(?<!\s)_(?!_)/g, (match, content: string): string => {
  //   const innerContent = escapeMarkdownLegacyText(content);
  //   return `_${innerContent}_`;
  // });

  // 6. 下划线 (__下划线__) - Legacy 不支持，移除标记，内容转义
  processedText = processedText.replace(/__(.*?)__/g, (match, content: string): string => {
    return escapeMarkdownLegacyText(content);
  });

  // 7. 删除线 (~删除线~) - Legacy 不支持，移除标记，内容转义
  processedText = processedText.replace(/~~(.*?)~~/g, (match, content: string): string => {
    return escapeMarkdownLegacyText(content);
  });

  // 8. 剧透 (||剧透||) - Legacy 不支持，移除标记，内容转义
  processedText = processedText.replace(/\|\|(.*?)\|\|/g, (match, content: string): string => {
    return escapeMarkdownLegacyText(content);
  });

  // 9. 引用块 (> 引用内容) 和 可展开引用块 (>> 可展开引用块) - Legacy 不支持，移除前缀，内容转义
  processedText = processedText.replace(/^>>\s*(.*)$/gm, (match, content: string) => {
    return escapeMarkdownLegacyText(content);
  });
  processedText = processedText.replace(/^>\s*(.*)$/gm, (match, content: string) => {
    return escapeMarkdownLegacyText(content);
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

/**
 * 根据 parseMode 格式化文本。
 * @param {string} text - 原始或部分原始文本。
 * @param {ParseMode | null} parseMode - 目标格式 ('HTML', 'MarkdownV2', 'Markdown', null)。
 * @returns {string} 格式化后的文本。
 * @throws {TelegramError} 如果 parseMode 无效 (除了 null)。
 */
function formatText(text: string, parseMode: ParseMode | null): string {
  if (parseMode === null) {
    // 纯文本模式，对HTML/Markdown特殊字符进行安全转义，避免它们被客户端误解析
    return escapeHtml(text);
  }
  switch (parseMode) {
    case 'HTML':
      return formatToHtml(text);
    case 'MarkdownV2':
      return formatToMarkdownV2(text);
    case 'Markdown':
      return formatToMarkdownLegacy(text);
    default:
      throw new TelegramError(`不支持的 parseMode: ${parseMode}`);
  }
}

export { formatToMarkdownV2, formatToHtml, formatToMarkdownLegacy, formatText };
