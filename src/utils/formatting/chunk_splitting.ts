// src/utils/formatting/chunk_splitting.ts

import type { ParseMode } from '@/types';
import { MARKDOWN_MARK_REGEX } from './formatters';

export interface CodeBlockRange {
  start: number;
  end: number;
}

/**
 * 将格式化后的文本分割成适合 Telegram 消息长度的块，并尝试避免在代码块内部分割。
 * @param {string} formattedText - 已经格式化为特定 parseMode 的文本。
 * @param {ParseMode | null} parseMode - 当前的解析模式 ('HTML', 'MarkdownV2', 'Markdown', null)。
 * @returns {string[]} 文本块数组 (原始分割块，未添加平衡标签)。
 */
export const splitFormattedText = (formattedText: string, parseMode: ParseMode | null): string[] => {
  const maxLength: number = 4000; // Telegram 消息最大长度约为 4096 字节，4000 字符是安全估计
  const chunks: string[] = [];
  let currentPos: number = 0;

  // 识别代码块的范围，以便在分割时避开
  const codeBlockRanges: CodeBlockRange[] = [];
  if (parseMode === 'HTML') {
    // 匹配 <pre> 或 <pre><code ...> 整个块
    const preRegex = /<pre(?:[^>]*?)?>[\s\S]*?<\/pre>/g;
    let match: RegExpExecArray | null;
    while ((match = preRegex.exec(formattedText)) !== null) {
      codeBlockRanges.push({ start: match.index, end: match.index + match.length });
    }
  } else if (parseMode === 'MarkdownV2' || parseMode === 'Markdown') {
    // 匹配 ```code``` 整个块
    let match: RegExpExecArray | null;
    while ((match = MARKDOWN_MARK_REGEX.CODE_BLOCK.exec(formattedText)) !== null) {
      codeBlockRanges.push({ start: match.index, end: match.index + match.length });
    }
  }

  while (currentPos < formattedText.length) {
    let endPos = Math.min(currentPos + maxLength, formattedText.length);

    // 如果不是最后一个块
    if (endPos < formattedText.length) {
      // 检查 endPos 是否落在代码块内部
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
        // 如果落在代码块内部，尝试调整分割点
        if (currentBlockEnd - currentPos <= maxLength) {
          // 如果从当前位置到代码块结束不超过最大长度，则将分割点移到代码块结束之后
          endPos = currentBlockEnd;
        } else {
          // 代码块太长，必须在内部分割。尝试在代码块内部找换行符。
          // 在当前块的末尾 200 个字符内查找一个安全的分割点
          const searchStart = Math.max(currentPos, endPos - 200);
          let safeSplitPoint = -1;
          for (let i = endPos - 1; i >= searchStart; i--) {
            if (formattedText[i] === '\n') {
              // 代码块内部主要按行分割
              safeSplitPoint = i + 1; // 分割点在换行符之后
              break;
            }
          }
          if (safeSplitPoint !== -1) {
            endPos = safeSplitPoint;
          }
          // 如果在窗口内没有找到换行符，就按 maxLength 硬分割 (可能破坏代码块格式)
          // 这种情况下，`balanceChunkTags` 应该尝试修复。
        }
      } else {
        // 如果没有落在代码块内部，尝试在附近找换行符或空格作为安全分割点
        // 在当前块的末尾 200 个字符内查找一个安全的分割点
        const searchStart = Math.max(currentPos, endPos - 200);
        let safeSplitPoint = -1;
        for (let i = endPos - 1; i >= searchStart; i--) {
          if (formattedText[i] === '\n' || formattedText[i] === ' ') {
            safeSplitPoint = i + 1; // 分割点在换行符或空格之后
            break;
          }
        }
        if (safeSplitPoint !== -1) {
          endPos = safeSplitPoint;
        }
        // 如果在窗口内没有找到安全的分割点，就按 maxLength 硬分割
      }
    }

    const chunk = formattedText.substring(currentPos, endPos);
    chunks.push(chunk);
    currentPos = endPos;
  }

  return chunks;
};
