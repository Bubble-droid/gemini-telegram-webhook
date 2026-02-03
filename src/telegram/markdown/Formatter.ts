import type { AstNode } from '@shared/types/markdown';
import type { ParseMode } from 'grammy/types';
import { HtmlGenerator, LegacyMarkdownGenerator, MarkdownV2Generator, type Generator } from './Generator';
import { Parser } from './Parser';

/**
 * 协调解析器和生成器，将标准 Markdown 文本转换为 Telegram Bot API 支持的格式。
 */
export class Formatter {
  private htmlGenerator?: HtmlGenerator;
  private markdownV2Generator?: MarkdownV2Generator;
  private legacyMarkdownGenerator?: LegacyMarkdownGenerator;

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
        this.htmlGenerator ??= new HtmlGenerator();
        return this.htmlGenerator;
      case 'MarkdownV2':
        this.markdownV2Generator ??= new MarkdownV2Generator();
        return this.markdownV2Generator;
      case 'Markdown':
        this.legacyMarkdownGenerator ??= new LegacyMarkdownGenerator();
        return this.legacyMarkdownGenerator;
    }
  }
}
