import type { GenerateContentResponse, GroundingChunk } from '@google/genai';
import { resolvePath } from './PathResolver';

/**
 * 辅助函数：将 UTF-8 字节索引转换为 JavaScript 字符串索引
 * 解决中文/Emoji 环境下 API 返回的索引与 JS 字符串长度不一致的问题
 */
const getJsIndexFromByteIndex = (text: string, byteIndex: number | undefined): number => {
  if (!byteIndex) return 0;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  if (byteIndex >= bytes.length) {
    return text.length;
  }

  const slicedBytes = bytes.slice(0, byteIndex);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(slicedBytes).length;
};

/**
 * 辅助函数：提取引用源的 URL 或 标识符
 * 策略：优先使用 Web URI，如果没有，则降级使用 File Title
 */
const extractCitationUrl = (chunk: GroundingChunk): string | null => {
  // 策略 1: Web Search
  if (chunk.web?.uri) {
    return chunk.web.uri;
  }

  // 策略 2: File/Vertex Search
  if (chunk.retrievedContext?.title) {
    return resolvePath(chunk.retrievedContext.title);
  }

  return null;
};

/**
 * 通用引用添加函数
 * 同时支持 Network Search 和 File Search
 *
 * @param response Gemini API 的完整响应对象
 * @returns 处理后包含 Markdown 引用的文本
 */
export const addCitations = (response: GenerateContentResponse): string => {
  // 1. 获取原始文本 (兼容 SDK 快捷字段和 Raw JSON)
  let text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No text found.';

  const candidate = response.candidates?.[0];
  const metadata = candidate?.groundingMetadata;

  // 防御性检查
  if (!metadata?.groundingSupports || !metadata.groundingChunks) {
    return text;
  }

  const { groundingSupports, groundingChunks } = metadata;

  // 2. 预处理：计算 JS 索引
  // 将 API 的 Byte Index 转换为 JS 可用的 Char Index
  const supportsWithIndices = groundingSupports.map((support) => ({
    ...support,
    jsEndIndex: getJsIndexFromByteIndex(text, support.segment?.endIndex),
  }));

  // 3. 倒序排序
  // 必须按照在文本中出现的位置倒序排列，防止插入操作破坏后续索引
  supportsWithIndices.sort((a, b) => b.jsEndIndex - a.jsEndIndex);

  // 4. 遍历处理每个支撑段落
  for (const support of supportsWithIndices) {
    const { jsEndIndex, groundingChunkIndices } = support;

    // 过滤无效数据
    if (jsEndIndex === 0 || !groundingChunkIndices?.length) {
      continue;
    }

    // 5. 生成引用链接
    const citationLinks = groundingChunkIndices
      .map((chunkIndex) => {
        const chunk = groundingChunks[chunkIndex];
        if (!chunk) return null;

        const url = extractCitationUrl(chunk);

        if (url) {
          // 格式化为 Markdown: [索引](链接或标题)
          return `[参${chunkIndex + 1}](${url})`;
        }
        return null;
      })
      .filter((link): link is string => link !== null);

    // 6. 插入文本
    if (citationLinks.length > 0) {
      const citationString = ' ' + citationLinks.join(' ');
      // 使用精确计算的 JS 索引进行切片拼接
      text = text.slice(0, jsEndIndex) + citationString + text.slice(jsEndIndex);
    }
  }

  if (response.executableCode) {
    text += '\n\n```python\n' + response.executableCode + '\n```';
  }

  if (response.codeExecutionResult) {
    text += '\n\n' + response.codeExecutionResult;
  }

  return text.trim();
};
