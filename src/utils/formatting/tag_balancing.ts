// src/utils/formatting/tag_balancing.ts

import { Log } from '@/services';
import type { ParseMode } from '@/types';

/**
 * 获取指定格式模式下，给定标记类型的开放标记字符串。
 * @param {string} type - 标记类型 (例如 'b', 'i', 'code', 'mv2_bold', 'mv2_italic', 'legacy_bold', 'legacy_italic', 'link_text', 'link_url', 'spoiler', 'strikethrough', 'pre', 'blockquote', 'blockquote_expandable')。
 * @param {ParseMode | null} parseMode - 解析模式。
 * @returns {string} 开放标记字符串。
 */
const getOpeningTagString = (type: string, parseMode: ParseMode | null): string => {
  if (parseMode === 'HTML') {
    switch (type) {
      case 'b':
      case 'strong':
        return '<b>';
      case 'i':
      case 'em':
        return '<i>';
      case 'u':
      case 'ins':
        return '<u>';
      case 's':
      case 'strike':
      case 'del':
        return '<s>';
      case 'span': // Used for spoiler
      case 'tg-spoiler':
        return '<span class="tg-spoiler">';
      case 'a':
        // 链接需要特殊处理，这里只返回 <a> 的开始，href 在 balanceChunkTags 中处理
        return '<a href="">'; // 占位符，实际 href 在 balanceChunkTags 中处理
      case 'code':
        return '<code>';
      case 'pre':
        // <pre> 可能包含 <code> 标签，这里只返回 <pre> 的开始
        return '<pre>';
      case 'pre_code_lang': // <pre><code class="language-xyz">
        return `<pre><code class="language-">`; // 占位符
      case 'blockquote':
        return '<blockquote>';
      case 'blockquote_expandable':
        return '<blockquote expandable>';
      case 'tg-emoji':
        return '<tg-emoji emoji-id="">'; // 占位符
      default:
        return '';
    }
  } else if (parseMode === 'MarkdownV2') {
    switch (type) {
      case 'mv2_bold':
        return '*';
      case 'mv2_italic':
        return '_';
      case 'mv2_underline':
        return '__';
      case 'mv2_strikethrough':
        return '~'; // MV2 删除线是 ~text~
      case 'mv2_spoiler':
        return '||';
      case 'mv2_code_inline':
        return '`';
      case 'mv2_code_block':
        // 代码块需要语言信息，这里只返回开始标记，语言在 balanceChunkTags 中处理
        return '```'; // 占位符
      case 'mv2_link':
        // 链接需要文本和 URL，这里只返回 [ ，文本和 URL 在 balanceChunkTags 中处理
        return '['; // 占位符
      case 'mv2_blockquote':
      case 'mv2_blockquote_expandable':
        return '> '; // 块引用是行前缀，跨行处理复杂，这里作为标记类型
      default:
        return '';
    }
  } else if (parseMode === 'Markdown') {
    // Legacy
    switch (type) {
      case 'legacy_bold':
        return '*';
      case 'legacy_italic':
        return '_';
      case 'legacy_code_inline':
        return '`';
      case 'legacy_code_block':
        return '```';
      case 'legacy_link':
        return '['; // 占位符
      default:
        return ''; // Legacy 不支持其他格式
    }
  }
  return '';
};

/**
 * 获取指定格式模式下，给定标记类型的闭合标记字符串。
 * @param {string} type - 标记类型。
 * @param {ParseMode | null} parseMode - 解析模式。
 * @returns {string} 闭合标记字符串。
 */
const getClosingTagString = (type: string, parseMode: ParseMode | null): string => {
  if (parseMode === 'HTML') {
    switch (type) {
      case 'b':
      case 'strong':
        return '</b>';
      case 'i':
      case 'em':
        return '</i>';
      case 'u':
      case 'ins':
        return '</u>';
      case 's':
      case 'strike':
      case 'del':
        return '</s>';
      case 'span': // Used for spoiler
      case 'tg-spoiler':
        return '</span>';
      case 'a':
        return '</a>';
      case 'code':
        return '</code>';
      case 'pre':
        return '</pre>';
      case 'pre_code_lang':
        return '</code></pre>';
      case 'blockquote':
      case 'blockquote_expandable':
        return '</blockquote>';
      case 'tg-emoji':
        return '</tg-emoji>';
      default:
        return '';
    }
  } else if (parseMode === 'MarkdownV2') {
    switch (type) {
      case 'mv2_bold':
        return '*';
      case 'mv2_italic':
        return '_';
      case 'mv2_underline':
        return '__';
      case 'mv2_strikethrough':
        return '~'; // MV2 删除线是 ~text~
      case 'mv2_spoiler':
        return '||';
      case 'mv2_code_inline':
        return '`';
      case 'mv2_code_block':
        return '```';
      case 'mv2_link':
        return ')'; // 链接的闭合是 )
      case 'mv2_blockquote':
      case 'mv2_blockquote_expandable':
        return ''; // 块引用是行前缀，没有闭合标记
      default:
        return '';
    }
  } else if (parseMode === 'Markdown') {
    // Legacy
    switch (type) {
      case 'legacy_bold':
        return '*';
      case 'legacy_italic':
        return '_';
      case 'legacy_code_inline':
        return '`';
      case 'legacy_code_block':
        return '```';
      case 'legacy_link':
        return ')'; // 链接的闭合是 )
      default:
        return ''; // Legacy 不支持其他格式
    }
  }
  return '';
};

/**
 * 识别并跟踪格式标记/标签的开放和闭合状态。
 * 这是一个启发式方法，特别是对于 Markdown 的复杂嵌套和转义，可能无法完美处理所有情况。
 * @param {string} chunk - 需要分析的文本块。
 * @param {ParseMode | null} parseMode - 解析模式。
 * @param {string[]} inheritedOpenTags - 从前一个块继承的开放标记类型栈。
 * @returns {{balancedChunk: string, nextInheritedOpenTags: string[]}} 包含平衡后文本和下一个块继承的开放标记栈。
 */
const balanceChunkTags = (
  chunk: string,
  parseMode: ParseMode | null,
  inheritedOpenTags: string[],
): { balancedChunk: string; nextInheritedOpenTags: string[] } => {
  if (parseMode === null) {
    return { balancedChunk: chunk, nextInheritedOpenTags: [] }; // 纯文本无需处理
  }

  const currentStack = [...inheritedOpenTags];
  let processedChunk = '';
  let i = 0;

  // 构建需要添加到块开头的开放标记字符串
  let openingTagsString = '';
  for (const tagType of inheritedOpenTags) {
    const openStr = getOpeningTagString(tagType, parseMode);
    // 避免为块引用添加开始标记，因为它是行前缀且在 chunk 中已处理
    if (openStr && !['> '].includes(openStr)) {
      openingTagsString += openStr;
    }
  }

  // 迭代文本块，跟踪标记状态
  while (i < chunk.length) {
    let matched = false;

    if (parseMode === 'HTML') {
      // 尝试匹配 HTML 标签
      // 改进正则匹配属性，但只提取标签名进行平衡
      const htmlTagMatch = chunk.substring(i).match(/^<(\/?[\w-]+)(?:\s+[^>]*)?>/);
      if (htmlTagMatch) {
        const fullMatch = htmlTagMatch[0]; // 修正：获取整个匹配的字符串
        const tagNameWithSlash = htmlTagMatch[1].toLowerCase(); // 修正：访问捕获组
        const isClosing = tagNameWithSlash.startsWith('/');
        const cleanTagName = isClosing ? tagNameWithSlash.substring(1) : tagNameWithSlash;

        // 检查是否是支持的标签
        const supportedTags = [
          'b',
          'strong',
          'i',
          'em',
          'u',
          'ins',
          's',
          'strike',
          'del',
          'span',
          'tg-spoiler',
          'a',
          'code',
          'pre',
          'blockquote',
          'blockquote_expandable',
          'tg-emoji',
        ];

        if (supportedTags.includes(cleanTagName) || (cleanTagName === 'code' && currentStack.includes('pre'))) {
          if (isClosing) {
            // 闭合标签
            const stackIndex = currentStack.lastIndexOf(cleanTagName);
            if (stackIndex !== -1) {
              // 弹出匹配的标签
              currentStack.splice(stackIndex, 1);
            } else {
              Log.warn(`HTML 格式中发现未匹配的闭合标签: </${cleanTagName}>`);
            }
          } else {
            // 开放标签
            // 对于 <pre><code> 这种嵌套，需要特殊处理
            if (cleanTagName === 'code' && currentStack[currentStack.length - 1] === 'pre') {
              // 如果是 <pre> 内部的 <code>
              currentStack.push('pre_code_lang'); // 标记为 <pre><code class="language-xyz">
            } else {
              currentStack.push(cleanTagName);
            }
          }
          processedChunk += fullMatch;
          i += fullMatch.length;
          matched = true;
        }
      }
      // 检查 HTML 实体
      const entityRegexMatch = chunk.substring(i).match(/^&(\w+|#\d+|#x[0-9a-fA-F]+);/);
      if (entityRegexMatch) {
        const entityMatch = entityRegexMatch; // 修正：获取整个匹配的实体字符串
        processedChunk += entityMatch;
        i += entityMatch.length;
        matched = true;
      }
    } else if (parseMode === 'MarkdownV2' || parseMode === 'Markdown') {
      // 检查转义字符
      if (chunk[i] === '\\' && i + 1 < chunk.length) {
        // 转义字符后面的字符不应被视为标记
        processedChunk += chunk.substring(i, i + 2);
        i += 2;
        matched = true;
      } else {
        // 尝试匹配 Markdown 标记 (优先匹配长的，MV2和Legacy有区别)
        const mv2MarkersMap: Record<string, string> = {
          '```': 'mv2_code_block',
          '||': 'mv2_spoiler',
          __: 'mv2_underline',
          // formatToMarkdownV2 会将 `**` 转换为 `*`，将 `~~` 转换为 `~`。
          // 所以这里平衡时应查找单字符 `*` 和 `~`。
          '*': 'mv2_bold',
          _: 'mv2_italic',
          '~': 'mv2_strikethrough', // MV2 删除线在格式化后是单字符 `~`
          '`': 'mv2_code_inline',
          '[': 'mv2_link',
          ')': 'mv2_link_end',
          '> ': 'mv2_blockquote', // 块引用
        };
        const legacyMarkersMap: Record<string, string> = {
          '```': 'legacy_code_block',
          '*': 'legacy_bold',
          _: 'legacy_italic',
          '`': 'legacy_code_inline',
          '[': 'legacy_link',
          ')': 'legacy_link_end',
        };
        const currentMarkers = parseMode === 'MarkdownV2' ? mv2MarkersMap : legacyMarkersMap;

        let markerFound = false;
        // 优先检查多字符标记
        const multiCharMarkers = parseMode === 'MarkdownV2' ? ['```', '||', '__'] : ['```']; // MV2: ```, ||, __. Legacy: ```

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

        // 检查单字符标记
        // 确保不会与多字符标记的开头混淆，但由于 `formatters.ts` 已转换 `**` -> `*` 和 `~~` -> `~`
        // 这里的单字符 `*` 和 `~` 应被视为独立标记。
        const singleCharMarkers = parseMode === 'MarkdownV2' ? ['`', '*', '_', '[', ')', '~'] : ['`', '*', '_', '[', ')']; // MV2 包含 `~`
        for (const marker of singleCharMarkers) {
          if (currentMarkers[marker] && chunk[i] === marker) {
            // 在格式化后的文本中，`*` 和 `~` 都是单字符标记，不应被排除。
            // 只有 `_` 需要检查是否是 `__` 的一部分 (因为 `__` 在 MV2 中是下划线，并未转换为单字符)。
            if (marker === '_' && chunk.substring(i, i + 2) === '__') {
              continue; // `_` 是 `__` 的一部分，由多字符标记处理。
            }

            const type = currentMarkers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;

            if (marker === ')') {
              // 链接闭合标记
              if (top === 'mv2_link' || top === 'legacy_link') {
                currentStack.pop(); // 弹出匹配的链接开放标记
              } else {
                Log.warn(`${parseMode} 格式中发现未匹配的链接闭合标记: )`);
              }
            } else if (marker === '[') {
              // 链接开放标记
              currentStack.push(type);
            } else if (marker === '`' || marker === '*' || marker === '_' || (parseMode === 'MarkdownV2' && marker === '~')) {
              // 行内代码、粗体、斜体、删除线 (MV2)
              // 简化处理：如果栈顶是同类型标记，则弹出（闭合）；否则压入（开放）。
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

        // 检查块引用 (行前缀，只在行首有效)
        // MV2/HTML 引用块是行前缀，在 `formatters.ts` 中已转换。
        // 这里只是为了在 `balanceChunkTags` 中识别块引用状态。
        if (!matched && chunk.substring(i).startsWith('> ')) {
          const isNewlineBefore = i === 0 || chunk[i - 1] === '\n';
          // 如果当前行以 `> ` 开始，并且它前面是新行或在块的开始处
          if (isNewlineBefore) {
            const topTag = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;
            if (topTag !== 'mv2_blockquote' && topTag !== 'mv2_blockquote_expandable') {
              // 如果栈顶不是块引用，说明这是一个新的引用块开始
              // 在 formatToMarkdownV2 中，`>>` 已经转换为 `> `。
              // 所以这里只推入 `mv2_blockquote`。
              currentStack.push('mv2_blockquote');
            }
            // 块引用前缀本身直接添加到 processedChunk
            processedChunk += '> ';
            i += 2;
            matched = true;
          }
        } else if (
          !matched &&
          currentStack.length > 0 &&
          (currentStack[currentStack.length - 1] === 'mv2_blockquote' || currentStack[currentStack.length - 1] === 'mv2_blockquote_expandable') &&
          (i === 0 || chunk[i - 1] === '\n') // 是新行
        ) {
          // 如果栈顶是块引用，且当前是新行，但没有 '> ' 前缀，说明块引用结束了
          currentStack.pop(); // 从栈中弹出块引用标记
          // 继续处理当前行 (不设置 matched = true, 让它进入下面的非匹配处理)
        }
      }
    }

    if (!matched) {
      processedChunk += chunk[i];
      i++;
    }
  }

  // 构建需要添加到块末尾的闭合标记字符串
  let closingTagsString = '';
  // 从栈顶开始，为所有未闭合的标记添加闭合符
  for (let j = currentStack.length - 1; j >= 0; j--) {
    const tagType = currentStack[j];
    // 块引用类型不生成闭合标记字符串，因为它是行前缀
    if (tagType !== 'mv2_blockquote' && tagType !== 'mv2_blockquote_expandable') {
      const closeStr = getClosingTagString(tagType, parseMode);
      closingTagsString += closeStr;
    }
  }

  // 最终返回的下一个块继承的开放标记栈就是当前处理完后栈的状态
  const nextInheritedOpenTags = [...currentStack];

  // 返回平衡后的文本块 (开头添加继承的开放标记，末尾添加闭合标记) 和下一个块继承的开放标记栈
  return {
    balancedChunk: openingTagsString + processedChunk + closingTagsString,
    nextInheritedOpenTags: nextInheritedOpenTags,
  };
};

export { getOpeningTagString, getClosingTagString, balanceChunkTags };
