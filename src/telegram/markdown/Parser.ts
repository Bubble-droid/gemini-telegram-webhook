import type { AstNode, NodeType } from '@shared/types/markdown.js';

// Define strictly typed match groups for RegEx
interface CodeBlockMatchGroups {
  delimiter: string;
  language: string;
  content: string;
}

/**
 * A Parser for converting custom Markdown to an Abstract Syntax Tree (AST).
 */
export class Parser {
  private readonly text: string;
  private pos = 0;

  // ========================================================================
  // 1. Pre-compiled Regex (Performance Optimization)
  // Using 'y' (Sticky) flag with lastIndex for O(n) scanning
  // ========================================================================

  // Matches 3-6 backticks, optional language, and content
  private readonly regexCodeBlock =
    /^[ \t]*(?<delimiter>`{3,6})(?<language>\w*)[ \t]*\n?(?<content>[\s\S]+?)\n?[ \t]*\k<delimiter>/my;

  // Matches inline code `code`
  private readonly regexInlineCode = /`(?<content>[^`]+)`/y;

  private readonly regexListItem = /^(?<indent>[ \t]*)\*(?:[ \t]+|$)/my;

  private readonly markers = ['**', '__', '~~', '||', '`', '[', ']', '(', ')', '```', '\n', '>', '>>', '*'];

  constructor(text: string) {
    // Normalize newlines for consistent parsing
    this.text = text.replace(/\r\n/g, '\n');
  }

  public parse(): AstNode {
    return { type: 'root', children: this.parseUntil((p) => p >= this.text.length) };
  }

  private parseUntil(endCondition: (pos: number) => boolean): AstNode[] {
    const nodes: AstNode[] = [];
    while (!endCondition(this.pos)) {
      const startPos = this.pos;

      // Try parsers in order of precedence
      const node =
        this.parseCodeBlock() ??
        this.parseBlockquote() ??
        this.parseUnorderedList() ??
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

      // Dead loop protection: Force consume 1 char if no parser advanced position
      if (this.pos === startPos) {
        if (!endCondition(this.pos)) {
          // Fallback: treat the character as plain text
          nodes.push({ type: 'text', content: this.text[this.pos] ?? '' });
          this.pos++;
        }
      }
    }
    return nodes;
  }

  private match(s: string): boolean {
    return this.text.startsWith(s, this.pos);
  }

  /**
   * Generic marker parser (e.g., **bold**)
   */
  private parseWithMarkers(type: NodeType, marker: string): AstNode | null {
    if (!this.match(marker)) return null;
    const startPos = this.pos;
    this.pos += marker.length;

    // Find closing marker
    const children = this.parseUntil((p) => this.text.startsWith(marker, p) || p >= this.text.length);

    if (this.match(marker)) {
      this.pos += marker.length;
      return { type, children };
    }

    // Backtrack if no closing marker found
    this.pos = startPos;
    return null;
  }

  // Wrapper functions for specific markers
  private parseBold = (): AstNode | null => this.parseWithMarkers('bold', '**');
  private parseUnderline = (): AstNode | null => this.parseWithMarkers('underline', '__');
  private parseStrikethrough = (): AstNode | null => this.parseWithMarkers('strikethrough', '~~');
  private parseSpoiler = (): AstNode | null => this.parseWithMarkers('spoiler', '||');

  private parseNewline = (): AstNode | null => {
    if (!this.match('\n')) return null;
    this.pos++;
    return { type: 'newline' };
  };

  /**
   * Inline Code Parser
   */
  private parseInlineCode(): AstNode | null {
    if (!this.text.startsWith('`', this.pos)) return null;

    this.regexInlineCode.lastIndex = this.pos;
    const match = this.regexInlineCode.exec(this.text);

    if (!match?.groups) {
      return null;
    }

    this.pos += match[0].length;
    return { type: 'inline_code', content: match.groups['content']! };
  }

  /**
   * [NEW] Unordered List Parser
   * Handles lines starting with '*' allowing arbitrary indentation.
   */
  private parseUnorderedList(): AstNode | null {
    const startPos = this.pos;
    const items: AstNode[] = [];
    let currentPos = this.pos;

    while (currentPos < this.text.length) {
      this.regexListItem.lastIndex = currentPos;
      const match = this.regexListItem.exec(this.text);

      if (!match?.groups) break;

      const { indent } = match.groups;
      const endOfLine = this.text.indexOf('\n', currentPos);
      const lineEndPos = endOfLine === -1 ? this.text.length : endOfLine;

      // Extract content strictly within line boundaries
      const contentStart = currentPos + match[0].length;
      if (contentStart > lineEndPos) break;

      const lineContent = this.text.substring(contentStart, lineEndPos);

      const innerParser = new Parser(lineContent);
      const children = innerParser.parse().children ?? [];

      items.push({
        type: 'list_item',
        indent: indent ?? '',
        children,
      });

      currentPos = lineEndPos + 1;
    }

    if (items.length > 0) {
      this.pos = currentPos;
      return { type: 'unordered_list', children: items };
    }

    this.pos = startPos;
    return null;
  }

  /**
   * Code Block Parser
   */
  private parseCodeBlock(): AstNode | null {
    this.regexCodeBlock.lastIndex = this.pos;
    const match = this.regexCodeBlock.exec(this.text);

    if (!match?.groups) return null;

    const { language, content } = match.groups as unknown as CodeBlockMatchGroups;
    this.pos += match[0].length;

    return {
      type: 'code_block',
      lang: language || undefined,
      content: content,
    };
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

  private parseBlockquote(): AstNode | null {
    return this._parseBlockquoteOfType('>>') ?? this._parseBlockquoteOfType('>');
  }

  private _parseBlockquoteOfType(marker: '>' | '>>'): AstNode | null {
    const startPos = this.pos;
    const isExpandableQuote = marker === '>>';

    if (startPos > 0 && this.text[startPos - 1] !== '\n') {
      return null;
    }

    const lineRegex = isExpandableQuote ? /^[ \t]*>>/my : /^[ \t]*>(?!>)/my;

    lineRegex.lastIndex = startPos;
    const match = lineRegex.exec(this.text);

    if (!match) return null;

    const lines: string[] = [];
    let currentPos = startPos;

    while (currentPos < this.text.length) {
      lineRegex.lastIndex = currentPos;
      const currentMatch = lineRegex.exec(this.text);

      if (!currentMatch) break;

      const endOfLine = this.text.indexOf('\n', currentPos);
      const lineEndPos = endOfLine === -1 ? this.text.length : endOfLine;

      let contentStart = currentPos + currentMatch[0].length;
      if (this.text[contentStart] === ' ') {
        contentStart++;
      }

      lines.push(this.text.substring(contentStart, lineEndPos));
      currentPos = lineEndPos + 1;
    }

    if (lines.length === 0) return null;

    this.pos = currentPos;
    const innerContent = lines.join('\n');
    const innerParser = new Parser(innerContent);
    const children = innerParser.parse().children ?? [];

    return {
      type: 'blockquote',
      expandable: isExpandableQuote,
      children,
    };
  }

  /**
   * Plain Text Parser
   * Optimized: Scans until the next marker or end condition.
   */
  private parseText(endCondition: (pos: number) => boolean): AstNode | null {
    const startPos = this.pos;
    let endPos = this.text.length;

    // Optimization: find the nearest marker
    for (const marker of this.markers) {
      const markerPos = this.text.indexOf(marker, this.pos);
      if (markerPos !== -1) {
        endPos = Math.min(endPos, markerPos);
      }
    }

    let checkPos = this.pos;
    while (checkPos < endPos && !endCondition(checkPos)) {
      checkPos++;
    }
    endPos = Math.min(endPos, checkPos);

    if (endPos > startPos) {
      this.pos = endPos;
      return { type: 'text', content: this.text.substring(startPos, endPos) };
    }
    return null;
  }
}
