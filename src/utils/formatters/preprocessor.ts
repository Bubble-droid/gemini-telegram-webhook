// src/utils/formatters/preprocessor.ts

/**
 * @class MarkdownUtils
 * @description 提供 Markdown 文本处理相关的工具函数。
 */
class MarkdownUtils {
  /**
   * 规范化 Markdown 文本中的代码块标记（```）。
   * 确保代码块的开启和关闭标记各占一行，同时正确处理开启标记后的语言标识符。
   *
   * 此方法主要解决两个问题：
   * 1. 代码块标记前有非换行符内容（例如：`some text```js`）。
   * 2. 闭合的代码块标记后有其他内容（例如：`code...```some text`）。
   *
   * @param {string} markdownText - 原始的 Markdown 文本。
   * @returns {string} 规范化处理后的 Markdown 文本。
   */
  public normalizeCodeBlocks(markdownText: string): string {
    if (typeof markdownText !== 'string' || !markdownText) {
      return '';
    }

    let normalizedText = markdownText;

    // 步骤 1: 修正前方紧邻文本的代码块标记。
    // 匹配一个非换行符字符，后跟可选的空白，然后是 ```。
    // 例如： "some text```js" -> "some text\n```js"
    // 使用正向后行断言 (?<=[^\n]) 来匹配前面有非换行符的 ```，更精准且不捕获前面的字符。
    // 为保持浏览器兼容性，这里使用捕获组实现。
    normalizedText = normalizedText.replace(/([^\n])(\s*`{3})/g, (match, precedingChar, fenceBlock) => {
      // 在前导字符和代码块标记之间插入换行符
      return `${precedingChar}\n${fenceBlock.trim()}`;
    });

    // 步骤 2: 修正后方紧邻文本的代码块标记。
    // 这个规则更加精细，因为它必须允许 ` ```js` 这样的语言标识符存在。
    // 我们只处理 ``` 后面跟了至少一个【空格】，然后再跟其他非换行符内容的情况。
    // 这通常是需要修正的闭合标记，例如 "``` some other text"。
    // ` ```js` (无空格) 的情况不会被匹配，从而得以保留。
    normalizedText = normalizedText.replace(/(`{3})(\s+[^\n\r]+)/g, (match, fence, trailingContent) => {
      // 在代码块标记和后续内容之间插入换行符
      return `${fence}\n${trailingContent}`;
    });

    return normalizedText;
  }

  /**
   * 预处理 Markdown 文本，自动将未被代码块包裹的 Markdown 表格用 ```markdown ... ``` 包裹起来。
   * 采用“占位符”策略，确保操作的健壮性和准确性。
   *
   * @param {string} markdownText - 原始的 Markdown 文本。
   * @returns {string} 转换了表格格式的 Markdown 文本。
   */
  public preprocessTables(markdownText: string): string {
    if (typeof markdownText !== 'string' || !markdownText) {
      return '';
    }

    const CODE_BLOCK_PLACEHOLDER = '__CODE_BLOCK_PLACEHOLDER_';
    const codeBlocks: string[] = [];

    // 步骤 1 & 2: 识别所有已存在的代码块，并用占位符替换它们。
    // 正则表达式 /```[\s\S]*?```/g 匹配从 ``` 开始到 ``` 结束的所有内容（包括换行符）。
    let safeText = markdownText.replace(/```[\s\S]*?```/g, (block) => {
      const placeholder = `${CODE_BLOCK_PLACEHOLDER}${codeBlocks.length}__`;
      codeBlocks.push(block);
      return placeholder;
    });

    // 步骤 3: 在移除了代码块的"安全"文本中，查找并包裹裸露的表格。
    // 一个健壮的表格正则表达式，要求至少有一个表头行和一个分隔线行。
    // - `^(\s*\|.*\|\s*\n)`: 匹配表头行。
    // - `\s*\|(?::?-+:?\|)+\s*`: 匹配分隔线行。
    // - `((?:\s*\|.*\|\s*\n?)*)`: 匹配零行或多行表体。
    // - `gm` 标志: g (全局搜索), m (多行模式, 使 ^ 匹配每行的开头)。
    const tableRegex = /^(\s*\|.*\|\s*\n\s*\|(?::?-+:?\|)+\s*\n?)((?:\s*\|.*\|\s*\n?)*)/gm;

    safeText = safeText.replace(tableRegex, (table) => {
      // 移除表格末尾可能存在的多余换行符，以保持格式整洁
      const trimmedTable = table.trim();
      return `\`\`\`markdown\n${trimmedTable}\n\`\`\``;
    });

    // 步骤 4: 将占位符恢复为原始的代码块。
    // 从后向前替换，避免索引问题（虽然在此场景下影响不大，但这是一个好习惯）。
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      safeText = safeText.replace(`${CODE_BLOCK_PLACEHOLDER}${i}__`, codeBlocks[i]);
    }

    return safeText;
  }

  /**
   * 预处理 Markdown 文本，将标准的 Markdown 标题转换为带层级序号的有序列表项。
   * 例如： # 概览 -> 1. **概览**
   *        ## 细节 -> 1.1. **细节**
   * 此方法采用“占位符”策略，确保不会错误地转换代码块中的内容。
   *
   * @param {string} markdownText - 原始的 Markdown 文本。
   * @returns {string} 转换了标题格式的 Markdown 文本。
   */
  public preprocessHeaders(markdownText: string): string {
    if (typeof markdownText !== 'string' || !markdownText) {
      return '';
    }

    const CODE_BLOCK_PLACEHOLDER = '__CODE_BLOCK_PLACEHOLDER_';
    const codeBlocks: string[] = [];
    const toc: number[] = []; // 使用动态数组，不限制标题层级

    // 步骤 1 & 2: 识别并用占位符替换所有已存在的代码块。
    let safeText = markdownText.replace(/```[\s\S]*?```/g, (block) => {
      const placeholder = `${CODE_BLOCK_PLACEHOLDER}${codeBlocks.length}__`;
      codeBlocks.push(block);
      return placeholder;
    });

    // 步骤 3: 在"安全"文本上，使用 replace 和回调函数来处理标题。
    // 正则表达式：
    // - ^(#+)      : 匹配行首的一个或多个 # (捕获组1: hashes)
    // - \s+         : 匹配至少一个空白符
    // - (.*?)       : 非贪婪地匹配标题文本 (捕获组2: title)
    // - \s*#*\s*$   : 匹配末尾可选的空白、# 和行尾，以正确处理 "## Title ##" 这样的格式
    // - gm          : 全局、多行模式
    const headerRegex = /^(#+)\s+(.*?)\s*#*\s*$/gm;

    safeText = safeText.replace(headerRegex, (match, hashes, title) => {
      const level = hashes.length; // 标题层级

      // 动态调整 toc 数组的长度，并重置更低层级的序号
      // 1. 如果当前层级比 toc 数组长，用0填充
      while (toc.length < level) {
        toc.push(0);
      }
      // 2. 将 toc 数组截断到当前层级，巧妙地重置了所有更低层级
      toc.length = level;

      // 3. 递增当前层级的序号
      toc[level - 1]++;

      const headerNumbers = toc.join('.');
      return `${headerNumbers}. **${title.trim()}**`;
    });

    // 步骤 4: 将占位符恢复为原始的代码块。
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      safeText = safeText.replace(`${CODE_BLOCK_PLACEHOLDER}${i}__`, codeBlocks[i]);
    }

    return safeText;
  }
}

export const markdownUtils: MarkdownUtils = new MarkdownUtils();

/**
 * 对原始 Markdown 文本应用所有预处理规则。
 * 规则按顺序执行：
 * 1. 转换标题为有序列表。
 * 2. 包裹独立的 Markdown 表格。
 * @param markdownText - 原始 Markdown 文本。
 * @returns {string} 经过所有预处理步骤后的文本。
 */
export const preprocessMarkdown = (markdownText: string): string => {
  let processedText = markdownText;

  processedText = markdownUtils.normalizeCodeBlocks(processedText);
  processedText = markdownUtils.preprocessTables(processedText);
  processedText = markdownUtils.preprocessHeaders(processedText);
  return processedText;
};
