// src/utils/formatting/formatter.ts

import type { ParseMode } from '@/types';
import { Parser, type AstNode } from './parser';
import { HtmlGenerator, LegacyMarkdownGenerator, MarkdownV2Generator, Generator } from './generator';

/**
 * 协调解析器和生成器，将标准 Markdown 文本转换为 Telegram Bot API 支持的格式。
 */
class Formatter {
  private readonly htmlGenerator: HtmlGenerator;
  private readonly markdownV2Generator: MarkdownV2Generator;
  private readonly legacyMarkdownGenerator: LegacyMarkdownGenerator;

  constructor() {
    this.htmlGenerator = new HtmlGenerator();
    this.markdownV2Generator = new MarkdownV2Generator();
    this.legacyMarkdownGenerator = new LegacyMarkdownGenerator();
  }

  /**
   * 将 Markdown 文本解析为 AST。
   * 这是发送流程的第一步，获取结构化数据。
   * @param markdownText - 标准 Markdown 格式的输入文本。
   * @returns 解析后的 AST 根节点。
   */
  public parse(markdownText: string): AstNode {
    const parser = new Parser(markdownText);
    return parser.parse();
  }

  /**
   * 根据指定的 ParseMode 获取对应的生成器实例。
   * @param parseMode - 目标格式。
   * @returns 对应的 Generator 实例。
   */
  public getGenerator(parseMode: ParseMode): Generator {
    switch (parseMode) {
      case 'HTML':
        return this.htmlGenerator;
      case 'MarkdownV2':
        return this.markdownV2Generator;
      case 'Markdown':
        return this.legacyMarkdownGenerator;
    }
  }
}

export const formatter: Formatter = new Formatter();

/**
 * [已废弃] 旧的单次格式化函数，仅用于测试或简单场景。
 * 发送长消息应使用新的 AST 工作流：formatter.parse() -> splitAstAndGenerateChunks()。
 * @param text - 原始 Markdown 文本。
 * @param parseMode - 目标格式。
 * @returns 格式化后的完整文本。
 */
export function formatText(text: string, parseMode: ParseMode | null): string {
  if (parseMode === null) {
    return text; // 纯文本不处理
  }
  const ast = formatter.parse(text);
  const generator = formatter.getGenerator(parseMode);
  return generator.generate(ast);
}
