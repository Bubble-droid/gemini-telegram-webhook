// src/utils/formatters/chunk_splitting.ts

import type { AstNode, Generator } from '@/utils/formatters';

const MAX_CONTENT_LENGTH = 4096;

/**
 * 递归计算一个 AST 节点及其所有子节点包含的“可见内容”的总长度。
 * 这符合 Telegram Bot API 对实体解析后文本长度的计算方式。
 * 关键更新：此函数现在计算 Unicode 码点 (Code Points) 的数量，
 * 这与 Telegram Bot API 对 "characters" 的定义完全一致。
 * @param node - 要计算长度的 AST 节点。
 * @returns {number} 节点的可见内容总长度（以 Unicode 码点计）。
 */
const getAstContentLength = (node: AstNode): number => {
  switch (node.type) {
    case 'text':
    case 'inline_code':
    case 'code_block':
      return [...(node.content ?? '')].length;
    case 'newline':
      return 1; // 换行符计为一个字符
    case 'root':
    case 'bold':
    case 'underline':
    case 'strikethrough':
    case 'spoiler':
    case 'link':
    case 'blockquote':
      // 容器节点自身无长度，其长度为其所有子节点的长度之和
      return node.children?.reduce((sum, child) => sum + getAstContentLength(child), 0) ?? 0;
    default:
      return 0;
  }
};

/**
 * 基于 AST 进行文本分割，并生成可以直接发送的、格式平衡的消息块。
 * 此版本根据 Telegram 的实体解析后字符数（4096）进行精确分割，并能正确处理超长代码块。
 * @param rootNode - AST 的根节点。
 * @param generator - 用于生成目标格式文本的生成器实例。
 * @returns {string[]} 已平衡格式的消息块数组。
 */
export const splitAstAndGenerateChunks = (rootNode: AstNode, generator: Generator): string[] => {
  const chunks: string[] = [];
  let currentChunkString = '';
  let currentContentLength = 0;
  const openNodesStack: AstNode[] = []; // 跟踪当前开放的节点（格式）

  const startNewChunk = () => {
    currentChunkString = openNodesStack.map((node) => generator.getOpeningTag(node.type, node)).join('');
    currentContentLength = 0;
  };

  const finalizeCurrentChunk = () => {
    if (currentContentLength === 0 && currentChunkString === '') return;
    currentChunkString += [...openNodesStack]
      .reverse()
      .map((node) => generator.getClosingTag(node.type, node))
      .join('');
    if (currentChunkString.trim().length > 0) {
      chunks.push(currentChunkString);
    }
  };

  const traverse = (node: AstNode) => {
    // --- 1. 预处理 & 原子节点检查 ---
    const nodeContentLength = getAstContentLength(node);

    // --- 核心升级：特殊处理 code_block ---
    if (node.type === 'code_block') {
      if (nodeContentLength > MAX_CONTENT_LENGTH) {
        // --- 场景A: 代码块自身超长，必须分割 ---
        // 1. 先将代码块之前的内容打包发送
        if (currentContentLength > 0) {
          finalizeCurrentChunk();
        }
        startNewChunk(); // 重置状态

        // 2. 进入专用代码分割循环
        let remainingContent = node.content ?? '';
        while (remainingContent.length > 0) {
          // 关键修复：移除未使用的变量 tagCharLength

          // 计算格式化标签自身占用的字符长度（虽然Telegram不计入，但它们存在于我们的字符串中）
          // 正确的方式是计算纯内容可用空间。
          const contentNodeForGeneration: AstNode = { ...node, content: '' };
          const emptyNodeStr = generator.generate(contentNodeForGeneration);
          const formattingCharsLength = emptyNodeStr.length;

          const availableContentSpace = MAX_CONTENT_LENGTH - formattingCharsLength;

          let splitIndex = Math.min(remainingContent.length, availableContentSpace);
          if (splitIndex < remainingContent.length) {
            const preferredSplitIndex = remainingContent.lastIndexOf('\n', splitIndex);
            if (preferredSplitIndex > 0) {
              splitIndex = preferredSplitIndex; // 在换行符处分割
            }
          }

          const part = remainingContent.substring(0, splitIndex);
          const contentPartNode: AstNode = { ...node, content: part };
          const codeChunk = generator.generate(contentPartNode);
          chunks.push(codeChunk);

          remainingContent = remainingContent.substring(splitIndex).trimStart();
        }
        // 3. 分割完毕，重置状态以接收后续内容
        startNewChunk();
        return; // 此节点已完全处理，跳过后续常规逻辑
      } else {
        // --- 场景B: 代码块未超长，执行 "Fit or Defer" 逻辑 ---
        if (currentContentLength > 0 && currentContentLength + nodeContentLength > MAX_CONTENT_LENGTH) {
          finalizeCurrentChunk();
          startNewChunk();
        }
        currentChunkString += generator.generate(node);
        currentContentLength += nodeContentLength;
        return; // 原子节点处理完毕
      }
    }

    // 对于 inline_code 和其他非容器节点，如果加入后超长，则换块
    if (node.type === 'inline_code' || node.type === 'text' || node.type === 'newline') {
      if (currentContentLength + nodeContentLength > MAX_CONTENT_LENGTH && nodeContentLength > 0) {
        // 此处逻辑简化，实际分割在 text 内容处理中完成
        // 这里主要处理原子性的 inline_code
        if (node.type === 'inline_code') {
          finalizeCurrentChunk();
          startNewChunk();
        }
      }
    }

    // --- 2. 进入节点 (Pre-order Traversal) ---
    openNodesStack.push(node);
    currentChunkString += generator.getOpeningTag(node.type, node);

    // --- 3. 处理节点内容 ---
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    } else if (node.content || node.type === 'newline') {
      const content = node.content ?? '\n';
      const contentLength = getAstContentLength(node); // 使用精确计算

      if (currentContentLength + contentLength <= MAX_CONTENT_LENGTH) {
        // 内容可以完全放入当前块
        // 关键修复：调用 public 的 generateContent 方法
        currentChunkString += generator.generateContent(node);
        currentContentLength += contentLength;
      } else {
        // 内容需要被分割
        let remainingContent = content;
        while (remainingContent.length > 0) {
          const remainingSpace = MAX_CONTENT_LENGTH - currentContentLength;
          if (remainingSpace <= 0) {
            // 当前块已满，开启新块
            finalizeCurrentChunk();
            startNewChunk();
            continue; // 重新进入循环处理 remainingContent
          }

          // 寻找最佳分割点
          let splitIndex = 0;
          let currentLength = 0;
          const chars = [...remainingContent]; // 按码点分割

          for (let i = 0; i < chars.length; i++) {
            if (currentLength + 1 > remainingSpace) {
              break;
            }
            currentLength++;
            splitIndex++;
          }

          if (splitIndex < chars.length) {
            // 避免在末尾寻找
            let preferredSplitIndex = -1;
            const tempStr = chars.slice(0, splitIndex).join('');
            preferredSplitIndex = tempStr.lastIndexOf('\n');
            if (preferredSplitIndex === -1) {
              preferredSplitIndex = tempStr.lastIndexOf(' ');
            }
            if (preferredSplitIndex > 0) {
              // 确保不是在开头分割
              splitIndex = [...tempStr.substring(0, preferredSplitIndex + 1)].length;
            }
          }

          const part1 = chars.slice(0, splitIndex).join('');
          const part2 = chars.slice(splitIndex).join('');

          // 处理第一部分
          const tempNodePart1: AstNode = { ...node, content: part1 };
          // 关键修复：调用 public 的 generateContent 方法
          currentChunkString += generator.generateContent(tempNodePart1);
          currentContentLength += [...part1].length;

          if (part2.length > 0) {
            // 如果有剩余部分，说明当前块已满，需要结束并开启新块
            finalizeCurrentChunk();
            startNewChunk();
          }
          remainingContent = part2;
        }
      }
    }

    // --- 4. 离开节点 (Post-order Traversal) ---
    currentChunkString += generator.getClosingTag(node.type, node);
    openNodesStack.pop();
  };

  // 从根节点的子节点开始遍历
  if (rootNode.children) {
    for (const child of rootNode.children) {
      traverse(child);
    }
  }

  if (currentContentLength > 0 || (chunks.length === 0 && currentChunkString.length > 0)) {
    finalizeCurrentChunk();
  }

  return chunks;
};

/**
 * 简单的纯文本分割函数，确保在回退到纯文本模式时不会因消息超长而失败。
 * @param text - 原始文本。
 * @param maxLength - 每块的最大长度。
 */
export const splitPlainText = (text: string, maxLength: number): string[] => {
  // 关键修复：使用码点计数法进行初始长度检查，确保准确性。
  if ([...text].length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    // 优先在换行符处分割
    let splitIndex = remainingText.lastIndexOf('\n', maxLength);
    // 其次在空格处分割
    if (splitIndex === -1) {
      splitIndex = remainingText.lastIndexOf(' ', maxLength);
    }
    // 如果都找不到，则硬分割
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = maxLength;
    }

    chunks.push(remainingText.substring(0, splitIndex));
    remainingText = remainingText.substring(splitIndex).trimStart();
  }

  return chunks;
};
