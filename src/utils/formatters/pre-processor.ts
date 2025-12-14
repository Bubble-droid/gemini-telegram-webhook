/**
 * @class MarkdownUtils
 * @description 提供 Markdown 文本处理相关的工具函数。
 */
class MarkdownUtils {
  // 用于 preprocessHeaders 的状态，作为类成员以在单次调用中保持状态
  private headerToc: number[] = [];

  /**
   * [私有辅助方法]
   * 一个高阶函数，用于安全地处理 Markdown 文本，自动跳过代码块（```...```）中的内容。
   *
   * @param markdownText - 原始 Markdown 文本。
   * @param processor - 一个处理器函数，它接收不包含代码块的"安全"文本，并返回处理后的文本。
   * @returns {string} 经过处理器函数处理，并恢复了代码块的最终文本。
   */
  private processTextOutsideCodeBlocks(markdownText: string, processor: (safeText: string) => string): string {
    const CODE_BLOCK_PLACEHOLDER = '__CODE_BLOCK_PLACEHOLDER_';
    const codeBlocks: string[] = [];

    // 步骤 1 & 2: 识别并用占位符替换所有已存在的代码块。
    const safeText = markdownText.replace(/```[\s\S]*?```/g, (block) => {
      const placeholder = `${CODE_BLOCK_PLACEHOLDER}${codeBlocks.length}__`;
      codeBlocks.push(block);
      return placeholder;
    });

    // 步骤 3: 在"安全"文本上执行传入的处理器函数。
    let processedSafeText = processor(safeText);

    // 步骤 4: 将占位符恢复为原始的代码块。
    // 从后向前替换，这是一个健壮的习惯，可以避免因占位符长度变化可能引起的索引问题。
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      processedSafeText = processedSafeText.replace(`${CODE_BLOCK_PLACEHOLDER}${i}__`, codeBlocks[i]);
    }

    return processedSafeText;
  }
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
    normalizedText = normalizedText.replace(/([^\n])(\s*`{3})/g, (_match, precedingChar, fenceBlock) => {
      // 在前导字符和代码块标记之间插入换行符
      return `${precedingChar}\n${fenceBlock.trim()}`;
    });

    // 步骤 2: 修正后方紧邻文本的代码块标记。
    // 这个规则更加精细，因为它必须允许 ` ```js` 这样的语言标识符存在。
    // 我们只处理 ``` 后面跟了至少一个【空格】，然后再跟其他非换行符内容的情况。
    // 这通常是需要修正的闭合标记，例如 "``` some other text"。
    // ` ```js` (无空格) 的情况不会被匹配，从而得以保留。
    normalizedText = normalizedText.replace(/(`{3})(\s+[^\n\r]+)/g, (_match, fence, trailingContent) => {
      // 在代码块标记和后续内容之间插入换行符
      return `${fence}\n${trailingContent}`;
    });

    return normalizedText;
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

    // 重置 TOC 计数器，确保每次调用都是全新的开始
    this.headerToc = [];

    return this.processTextOutsideCodeBlocks(markdownText, (safeText) => {
      const headerRegex = /^(#+)\s+(.*?)\s*#*\s*$/gm;
      return safeText.replace(headerRegex, (_match, hashes, title) => {
        const level = hashes.length;

        while (this.headerToc.length < level) {
          this.headerToc.push(0);
        }
        this.headerToc.length = level;
        this.headerToc[level - 1]++;

        const headerNumbers = this.headerToc.join('.');
        return `${headerNumbers}. **${title.trim()}**`;
      });
    });
  }
}

const markdownUtils: MarkdownUtils = new MarkdownUtils();

/**
 * 对原始 Markdown 文本应用所有预处理规则。
 * 规则执行顺序经过精心设计，以确保最佳效果和逻辑正确性。
 * @param markdownText - 原始 Markdown 文本。
 * @returns {string} 经过所有预处理步骤后的文本。
 */
export const preProcessMarkdown = (markdownText: string): string => {
  // 1. 首先规范化代码块，确保后续基于 ``` 的操作（如占位符替换）能正确识别所有代码块。
  let processedText = markdownUtils.normalizeCodeBlocks(markdownText);

  // 3. 最后处理标题。由于表格已被代码块保护，此操作将安全地转换所有剩余的裸露标题。
  processedText = markdownUtils.preprocessHeaders(processedText);

  return processedText;
};
