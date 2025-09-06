// src/utils/formatting/parser.ts

// --- AST 节点类型定义 ---
export type NodeType =
  | 'root'
  | 'text'
  | 'bold'
  | 'underline'
  | 'strikethrough'
  | 'spoiler'
  | 'inline_code'
  | 'code_block'
  | 'link'
  | 'blockquote'
  | 'newline'; // 新增换行节点，便于处理

export interface AstNode {
  type: NodeType;
  children?: AstNode[];
  content?: string;
  lang?: string;
  href?: string;
  expandable?: boolean;
}

/**
 * 将自定义 Markdown 转换为抽象语法树 (AST) 的解析器。
 */
export class Parser {
  private text: string;
  private pos: number = 0;
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
        this.parseCodeBlock() ||
        this.parseBlockquote() ||
        this.parseBold() ||
        this.parseUnderline() ||
        this.parseStrikethrough() ||
        this.parseSpoiler() ||
        this.parseLink() ||
        this.parseInlineCode() ||
        this.parseNewline() ||
        this.parseText(endCondition);

      if (node) {
        nodes.push(node);
      }

      // 如果位置没有前进，说明解析陷入死循环，强制前进一位并当作文本处理
      if (this.pos === startPos) {
        if (!endCondition(this.pos)) {
          nodes.push({ type: 'text', content: this.text[this.pos] });
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
    // 使用 `^` 确保匹配从当前位置开始
    const match = /^`([^`]+?)`/.exec(this.text.substring(this.pos));
    if (!match) return null;

    // 关键修复：使用 match[0].length (匹配到的完整字符串长度) 来推进位置，match[1] 作为内容
    this.pos += match[0].length;
    return { type: 'inline_code', content: match[1] };
  }

  private parseCodeBlock(): AstNode | null {
    // 关键修复：使用更健壮的正则表达式，并正确处理捕获组
    const match = /^```(\w*)\n([\s\S]+?)\n```/.exec(this.text.substring(this.pos));
    if (!match) return null;

    // 关键修复：使用 match[0].length 来推进位置
    this.pos += match[0].length;
    // match[1] 是语言, match[2] 是内容
    return { type: 'code_block', lang: match[1] || undefined, content: match[2] };
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
    const match = /^(>>? .+(?:\n>>? .*)*)/m.exec(this.text.substring(this.pos));
    if (!match) return null;

    const fullMatchText = match[0];
    // 关键修复：使用 match[0].length 来推进位置
    this.pos += fullMatchText.length;

    // 关键修复：在 match[0] (字符串)上调用方法，而不是在 match (数组)上
    const isExpandable = fullMatchText.startsWith('>>');
    const innerContent = fullMatchText.replace(/^(>>?)\s?/gm, '');

    const innerParser = new Parser(innerContent);
    const children = innerParser.parse().children || [];

    return { type: 'blockquote', expandable: isExpandable, children };
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
