// src/utils/formatters/parser.ts

import type { AstNode, NodeType } from '@/types';

/**
 * 将自定义 Markdown 转换为抽象语法树 (AST) 的解析器。
 */
export class Parser {
  private text: string;
  private pos = 0;
  // 定义所有可能的标记符，用于文本解析
  private readonly markers = ['**', '__', '~~', '||', '`', '[', ']', '(', ')', '```', '\n', '>'];

  constructor(text: string) {
    // 规范化换行符，便于处理
    this.text = text.replace(/\r\n/g, '\n');
  }

  public parse(): AstNode {
    return { type: 'root', children: this.parseUntil((p) => p >= this.text.length) };
  }

  private parseUntil(endCondition: (pos: number) => boolean): AstNode[] {
    const nodes: AstNode[] = [];
    while (!endCondition(this.pos)) {
      const startPos = this.pos;
      const node =
        this.parseCodeBlock() ??
        this.parseBlockquote() ??
        this.parseBold() ??
        this.parseUnderline() ??
        this.parseStrikethrough() ??
        this.parseSpoiler() ??
        this.parseLink() ??
        this.parseInlineCode() ??
        this.parseNewline() ??
        this.parseText(endCondition);

      if (node) {
        nodes.push(node);
      }

      // 如果位置没有前进，说明解析陷入死循环，强制前进一位并当作文本处理
      if (this.pos === startPos) {
        if (!endCondition(this.pos)) {
          nodes.push({ type: 'text', content: this.text[this.pos] ?? '' });
          this.pos++;
        }
      }
    }
    return nodes;
  }

  private match(s: string): boolean {
    return this.text.substring(this.pos).startsWith(s);
  }

  private parseWithMarkers(type: NodeType, marker: string): AstNode | null {
    if (!this.match(marker)) return null;
    const startPos = this.pos;
    this.pos += marker.length;

    const children = this.parseUntil((p) => this.text.substring(p).startsWith(marker) || p >= this.text.length);

    if (this.match(marker)) {
      this.pos += marker.length;
      return { type, children };
    }

    // 如果没有找到闭合标记，则回溯，将整个部分视为纯文本
    this.pos = startPos;
    return null;
  }

  private parseBold = (): AstNode | null => this.parseWithMarkers('bold', '**');
  private parseUnderline = (): AstNode | null => this.parseWithMarkers('underline', '__');
  private parseStrikethrough = (): AstNode | null => this.parseWithMarkers('strikethrough', '~~');
  private parseSpoiler = (): AstNode | null => this.parseWithMarkers('spoiler', '||');
  private parseNewline = (): AstNode | null => {
    if (!this.match('\n')) return null;
    this.pos++;
    return { type: 'newline' };
  };

  private parseInlineCode(): AstNode | null {
    const match = /^`([^`]+?)`/.exec(this.text.substring(this.pos));
    if (!match) return null;
    this.pos += match[0].length;
    return { type: 'inline_code', content: match[1] ?? '' };
  }

  private parseCodeBlock(): AstNode | null {
    const match = /^```(\w*)\n([\s\S]+?)\n```/.exec(this.text.substring(this.pos));
    if (!match) return null;
    this.pos += match[0].length;
    return { type: 'code_block', lang: match[1] ?? undefined, content: match[2] ?? '' };
  }

  private parseLink(): AstNode | null {
    if (!this.match('[')) return null;
    const startPos = this.pos;
    this.pos++; // Skip '['

    const children = this.parseUntil((p) => this.text[p] === ']' || p >= this.text.length);
    if (!this.match('](')) {
      this.pos = startPos;
      return null;
    }
    this.pos += 2; // Skip ']('

    const hrefEnd = this.text.indexOf(')', this.pos);
    if (hrefEnd === -1) {
      this.pos = startPos;
      return null;
    }

    const href = this.text.substring(this.pos, hrefEnd);
    this.pos = hrefEnd + 1; // Skip ')'

    return { type: 'link', href, children };
  }

  /**
   * 主引用块解析器，遵循“最具体优先”原则。
   * 优先尝试解析可展开引用块 (>>)，如果失败，再尝试解析普通引用块 (>).
   */
  private parseBlockquote(): AstNode | null {
    return this._parseBlockquoteOfType('>>') ?? this._parseBlockquoteOfType('>');
  }

  /**
   * [核心重构] 辅助方法，用于解析特定类型的连续多行引用块。
   * @param marker - 要匹配的标记符 ('>' 或 '>>')。
   */
  private _parseBlockquoteOfType(marker: '>' | '>>'): AstNode | null {
    const startPos = this.pos;

    // 1. 严格的行首检查
    if (startPos > 0 && this.text[startPos - 1] !== '\n') {
      return null;
    }

    const isSimpleQuote = marker === '>';
    const isExpandableQuote = marker === '>>';

    // 2. 区分 '>' 和 '>>' 的严格检查
    if (isSimpleQuote && this.text.substring(startPos).startsWith('>>')) {
      // 如果我们正在寻找'>'，但实际上遇到了'>>'，则此解析器应失败，
      // 以便让更具体的 '>>' 解析器接管。
      return null;
    }
    if (!this.text.substring(startPos).startsWith(marker)) {
      return null;
    }

    const lines: string[] = [];
    let currentPos = startPos;

    // 3. 逐行消耗与合并
    while (currentPos < this.text.length) {
      // 检查当前行是否是行首
      if (currentPos > 0 && this.text[currentPos - 1] !== '\n') {
        break; // 不是新行的开始，块结束
      }

      // 再次进行严格检查，确保行标记正确
      const lineStartsWithDouble = this.text.substring(currentPos).startsWith('>>');
      if (isExpandableQuote && !lineStartsWithDouble) {
        break; // 正在寻找'>>'，但当前行不是，块结束
      }
      if (isSimpleQuote && lineStartsWithDouble) {
        break; // 正在寻找'>'，但遇到了'>>'，块结束
      }
      if (!this.text.substring(currentPos).startsWith(marker)) {
        break; // 标记不匹配，块结束
      }

      // 寻找行尾
      const endOfLine = this.text.indexOf('\n', currentPos);
      const lineEndPos = endOfLine === -1 ? this.text.length : endOfLine;

      // 提取内容（移除标记和紧随其后的空格）
      const contentStartPos = currentPos + marker.length + (this.text[currentPos + marker.length] === ' ' ? 1 : 0);
      lines.push(this.text.substring(contentStartPos, lineEndPos));

      // 移动到下一行的开头
      currentPos = lineEndPos + 1;
    }

    if (lines.length === 0) {
      this.pos = startPos; // 回溯
      return null;
    }

    // 4. 【关键】一次性推进主解析器的位置
    this.pos = currentPos;

    // 5. 递归解析合并后的内容
    const innerContent = lines.join('\n');
    const innerParser = new Parser(innerContent);
    const children = innerParser.parse().children ?? [];

    return { type: 'blockquote', expandable: isExpandableQuote, children };
  }

  private parseText(endCondition: (pos: number) => boolean): AstNode | null {
    const startPos = this.pos;
    let endPos = this.text.length;

    // 找到下一个标记的最近位置
    for (const marker of this.markers) {
      const markerPos = this.text.indexOf(marker, this.pos);
      if (markerPos !== -1) {
        endPos = Math.min(endPos, markerPos);
      }
    }

    // 确保不会越过父节点的结束条件
    let parentEndPos = this.pos;
    while (!endCondition(parentEndPos) && parentEndPos < this.text.length) {
      parentEndPos++;
    }
    endPos = Math.min(endPos, parentEndPos);

    if (endPos > startPos) {
      this.pos = endPos;
      return { type: 'text', content: this.text.substring(startPos, endPos) };
    }
    return null;
  }
}
