// src/utils/formatting/tag_balancing.ts

import { Log } from '@/services';
import type { ParseMode } from '@/types';

/**
 * 获取指定格式模式下，给定标记类型的开放标记字符串。
 * @param {string} type - 标记类型 (例如 'b', 'i', 'code', 'mv2_bold', 'mv2_italic', 'legacy_bold', 'legacy_italic', 'link_text', 'link_url', 'spoiler', 'strikethrough', 'pre', 'blockquote')。
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
      case 'blockquote':
        return '<blockquote>';
      case 'blockquote_expandable':
        return '<blockquote expandable>';
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
        return '~~';
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
        return '> '; // 块引用是行前缀，跨行处理复杂，这里作为标记类型
      case 'mv2_blockquote_expandable':
        return '> '; // 可展开块引用也是行前缀
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
      case 'blockquote':
      case 'blockquote_expandable':
        return '</blockquote>';
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
        return '~~';
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
    // 对于链接和代码块，继承时需要特殊处理其内容（如链接URL，代码语言）
    // 这里的简化处理是只添加标记本身，这可能导致跨块的链接或代码块格式不完整。
    // 完美处理需要更复杂的逻辑来存储和恢复这些信息。
    const openStr = getOpeningTagString(tagType, parseMode);
    // 避免为块引用添加开始标记，因为它是行前缀
    if (openStr && !['> '].includes(openStr)) {
      openingTagsString += openStr;
    }
  }

  // 迭代文本块，跟踪标记状态
  while (i < chunk.length) {
    let matched = false;

    if (parseMode === 'HTML') {
      // 尝试匹配 HTML 标签
      const htmlTagMatch = chunk.substring(i).match(/^<(\/?\w+)(?:\s+[^>]*)?>/);
      if (htmlTagMatch) {
        const fullMatch = htmlTagMatch[0]; // 整个匹配的字符串，例如 "<b>" 或 "</a>"
        const tagName = htmlTagMatch[1].toLowerCase(); // <-- 修正点：访问捕获组 [1]
        const isClosing = tagName.startsWith('/');
        const cleanTagName = isClosing ? tagName.substring(1) : tagName;

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
        ];
        if (supportedTags.includes(cleanTagName)) {
          if (isClosing) {
            // 闭合标签
            const stackIndex = currentStack.lastIndexOf(cleanTagName);
            if (stackIndex !== -1) {
              // 找到匹配的开放标签，弹出栈及之上的所有标签 (处理嵌套)
              // 注意：HTML 嵌套规则复杂，这里简化处理，只弹出匹配的标签
              // 更严格应弹出匹配标签及之上的所有标签，然后重新压入之上的标签
              // 简化：只弹出匹配的最后一个
              currentStack.splice(stackIndex, 1);
            } else {
              // 未匹配的闭合标签，忽略或记录错误
              Log.warn(`HTML 格式中发现未匹配的闭合标签: </${cleanTagName}>`);
            }
          } else {
            // 开放标签
            // 对于链接 <a> 和预格式化 <pre>，它们的内容处理特殊，不应被其他行内标签打断
            // 但这里只跟踪标签本身，不处理内容规则
            if (
              cleanTagName === 'a' ||
              cleanTagName === 'pre' ||
              cleanTagName === 'code' ||
              cleanTagName === 'blockquote' ||
              cleanTagName === 'blockquote_expandable'
            ) {
              // 这些标签通常不应被其他行内标签嵌套或打断，但栈仍然需要跟踪它们
              // 压入栈
              currentStack.push(cleanTagName);
            } else {
              // 其他行内标签，直接压入栈
              currentStack.push(cleanTagName);
            }
          }
          processedChunk += fullMatch;
          i += fullMatch.length;
          matched = true;
        }
      }
      // 检查 HTML 实体，并确保 match 不为 null
      const entityRegexMatch = chunk.substring(i).match(/^&(\w+|#\d+|#x[0-9a-fA-F]+);/);
      if (entityRegexMatch) {
        const entityMatch = entityRegexMatch[0]; // 获取整个匹配的实体字符串
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
        // 尝试匹配 Markdown 标记 (优先匹配长的)
        const mv2Markers: Record<string, string> = {
          '~~': 'mv2_strikethrough',
          '||': 'mv2_spoiler', // MV2 only
          '**': 'mv2_bold',
          __: 'mv2_underline', // MV2 only
          '`': 'mv2_code_inline',
          '*': 'mv2_bold_italic_star', // MV2 * 可以是粗体或斜体，复杂
          _: 'mv2_bold_italic_underscore', // MV2 _ 可以是粗体或斜体，复杂
          '```': 'mv2_code_block', // 代码块
          '[': 'mv2_link', // 链接开始
          ')': 'mv2_link_end', // 链接结束
          '> ': 'mv2_blockquote', // 块引用 (行前缀)
        };
        const legacyMarkers: Record<string, string> = {
          '*': 'legacy_bold',
          _: 'legacy_italic',
          '`': 'legacy_code_inline',
          '```': 'legacy_code_block',
          '[': 'legacy_link',
          ')': 'legacy_link_end',
        };
        const currentMarkers = parseMode === 'MarkdownV2' ? mv2Markers : legacyMarkers;

        let markerFound = false;
        // 检查多字符标记
        for (const marker of ['```', '~~', '||', '**', '__']) {
          // 优先检查长标记
          if (parseMode === 'MarkdownV2' && mv2Markers[marker] && chunk.substring(i, i + marker.length) === marker) {
            const type = mv2Markers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;

            if (top === type) {
              // 闭合标记
              currentStack.pop();
            } else {
              // 开放标记
              currentStack.push(type);
            }
            processedChunk += marker;
            i += marker.length;
            matched = true;
            markerFound = true;
            break;
          }
          if (parseMode === 'Markdown' && legacyMarkers[marker] && chunk.substring(i, i + marker.length) === marker) {
            const type = legacyMarkers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;

            if (top === type) {
              // 闭合标记
              currentStack.pop();
            } else {
              // 开放标记
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

        // 检查单字符标记 (确保不是多字符标记的一部分)
        for (const marker of ['`', '*', '_', '[', ')']) {
          if (currentMarkers[marker] && chunk[i] === marker) {
            // 排除多字符标记的开头
            if (
              (marker === '*' && chunk.substring(i, i + 2) === '**') ||
              (marker === '_' && chunk.substring(i, i + 2) === '__') ||
              (marker === '`' && chunk.substring(i, i + 3) === '```')
            ) {
              // 这是多字符标记的一部分，跳过，将在上面的循环中处理
              continue;
            }

            const type = currentMarkers[marker];
            const top = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;

            if (marker === ')') {
              // 链接闭合标记
              if (top === 'mv2_link' || top === 'legacy_link') {
                currentStack.pop(); // 弹出匹配的链接开放标记
              } else {
                // Log.warn(`${parseMode} 格式中发现未匹配的链接闭合标记: )`);
              }
            } else if (marker === '[') {
              // 链接开放标记
              currentStack.push(type);
            } else if (marker === '`') {
              // 行内代码
              if (top === type) {
                currentStack.pop();
              } else {
                currentStack.push(type);
              }
            } else if (marker === '*' || marker === '_') {
              // 粗体/斜体
              // Markdown 的 * 和 _ 比较复杂，取决于上下文和嵌套。
              // 这里的栈逻辑是简化的，可能无法完美处理所有嵌套情况。
              // 对于 MV2，* 和 _ 可以互相嵌套，但不能嵌套 pre/code。
              // 对于 Legacy，不允许嵌套。
              // 简化处理：如果栈顶是同类型标记，则弹出（闭合）；否则压入（开放）。
              // 这对于 Legacy 的“不允许嵌套”规则是不准确的，但提供了一种基本的平衡尝试。
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
        if (!matched && chunk.substring(i).startsWith('> ') && (i === 0 || chunk[i - 1] === '\n')) {
          // 块引用是行前缀，不压栈，但需要识别并保留
          // 这里的栈逻辑不适合块引用，块引用是按行处理的。
          // 我们在 splitFormattedText 中处理块引用行的连续性。
          // 在 balanceChunkTags 中，如果遇到行首的 '> '，直接跳过标记部分，处理内容。
          // 但是，为了在栈中体现块引用状态（尽管它不是行内标记），我们可以压入一个特殊类型。
          // 这样，如果一个块以 '> ' 开头，栈顶会有块引用标记。
          // 在构建 openingTagsString 时，需要避免为块引用类型生成实际的开始标记字符串。
          // 在构建 closingTagsString 时，需要避免为块引用类型生成实际的闭合标记字符串。
          // 这种处理方式是为了让栈能反映块引用状态，以便在分割点判断是否在块引用内部。
          // 实际的 '> ' 标记本身会直接添加到 processedChunk。
          if (
            currentStack.length === 0 ||
            (currentStack[currentStack.length - 1] !== 'mv2_blockquote' && currentStack[currentStack.length - 1] !== 'mv2_blockquote_expandable')
          ) {
            // 如果栈顶不是块引用，说明这是一个新的块引用开始
            currentStack.push('mv2_blockquote'); // 压入块引用标记类型
          }
          processedChunk += '> ';
          i += 2;
          matched = true;
        } else if (
          !matched &&
          currentStack.length > 0 &&
          (currentStack[currentStack.length - 1] === 'mv2_blockquote' || currentStack[currentStack.length - 1] === 'mv2_blockquote_expandable') &&
          (i === 0 || chunk[i - 1] === '\n')
        ) {
          // 如果栈顶是块引用，且当前是新行，但没有 '> ' 前缀，说明块引用结束了
          // 从栈中弹出块引用标记
          currentStack.pop();
          // 继续处理当前行
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
  // 注意：块引用类型不生成闭合标记字符串
  for (let j = currentStack.length - 1; j >= 0; j--) {
    const tagType = currentStack[j];
    const closeStr = getClosingTagString(tagType, parseMode);
    closingTagsString += closeStr;
  }

  // 最终返回的下一个块继承的开放标记栈就是当前处理完后栈的状态
  const nextInheritedOpenTags = [...currentStack];

  // 返回平衡后的文本块 (开头添加继承的开放标记，末尾添加闭合标记) 和下一个块继承的开放标记栈
  return {
    balancedChunk: openingTagsString + chunk + closingTagsString,
    nextInheritedOpenTags: nextInheritedOpenTags,
  };
};

export { getOpeningTagString, getClosingTagString, balanceChunkTags };
