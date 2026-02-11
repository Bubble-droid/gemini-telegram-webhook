import type { AstNode, NodeType } from '@shared/types/markdown.js';

// 补充类型定义，以便代码可直接运行/检查
interface CodeBlockMatchGroups {
  delimiter: string;
  language: string;
  content: string;
}

/**
 * 将自定义 Markdown 转换为抽象语法树 (AST) 的解析器。
 */
export class Parser {
  private readonly text: string;
  private pos = 0;

  // ========================================================================
  // 1. 预编译正则 (Performance Optimization)
  // 使用 'y' (Sticky) 标志，配合 lastIndex 实现高性能扫描
  // ========================================================================

  // 匹配 3-6 个反引号，支持同行结束，支持命名捕获
  private readonly regexCodeBlock =
    /^\s*(?<delimiter>`{3,6})(?<language>\w*)\s*\n?(?<content>[\s\S]+?)\s*\k<delimiter>/my;

  // 匹配行内代码 `code`
  private readonly regexInlineCode = /`(?<content>[^`]+)`/y;

  // 定义所有可能的标记符，用于文本解析加速
  private readonly markers = ['**', '__', '~~', '||', '`', '[', ']', '(', ')', '```', '\n', '>', '>>'];

  constructor(text: string) {
    // 规范化换行符
    this.text = text.replace(/\r\n/g, '\n');
  }

  public parse(): AstNode {
    return { type: 'root', children: this.parseUntil((p) => p >= this.text.length) };
  }

  private parseUntil(endCondition: (pos: number) => boolean): AstNode[] {
    const nodes: AstNode[] = [];
    while (!endCondition(this.pos)) {
      const startPos = this.pos;

      // 尝试各种解析器
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

      // 死循环保护：如果位置没有前进，强制消耗一个字符
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
    return this.text.startsWith(s, this.pos); // 使用 startsWith 的第二个参数避免 substring
  }

  /**
   * 通用标记对解析器 (如 **bold**)
   */
  private parseWithMarkers(type: NodeType, marker: string): AstNode | null {
    if (!this.match(marker)) return null;
    const startPos = this.pos;
    this.pos += marker.length;

    // 寻找闭合标记
    const children = this.parseUntil((p) => this.text.startsWith(marker, p) || p >= this.text.length);

    if (this.match(marker)) {
      this.pos += marker.length;
      return { type, children };
    }

    // 回溯
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

  /**
   * [优化] 行内代码解析
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
   * [核心重构] 代码块解析器
   * 使用命名捕获组和 sticky 正则
   */
  private parseCodeBlock(): AstNode | null {
    // 1. 设置正则起始位置
    this.regexCodeBlock.lastIndex = this.pos;

    // 2. 执行匹配
    const match = this.regexCodeBlock.exec(this.text);

    // 3. 校验匹配结果及分组
    if (!match?.groups) return null;

    // 4. 类型安全的解构
    const { language, content } = match.groups as unknown as CodeBlockMatchGroups;

    // 5. 更新位置
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

    // 2. 构造或引用动态正则
    // ^\s{0,3} 匹配可选的缩进
    // 使用 'y' 确保从当前 pos 开始匹配
    const lineRegex = isExpandableQuote ? /^\s{0,3}>>/my : /^\s{0,3}>(?!>)/my; // 使用负向先行断言，确保 > 不会误匹配 >>

    lineRegex.lastIndex = startPos;
    const match = lineRegex.exec(this.text);

    if (!match) return null;

    const lines: string[] = [];
    let currentPos = startPos;

    // 3. 逐行收集内容
    while (currentPos < this.text.length) {
      lineRegex.lastIndex = currentPos;
      const currentMatch = lineRegex.exec(this.text);

      if (!currentMatch) break;

      // 找到当前行结束位置
      const endOfLine = this.text.indexOf('\n', currentPos);
      const lineEndPos = endOfLine === -1 ? this.text.length : endOfLine;

      // 提取内容：
      // match[0].length 包含了缩进和标记符
      // 检查标记符后是否有空格，如果有则跳过一个空格
      let contentStart = currentPos + currentMatch[0].length;
      if (this.text[contentStart] === ' ') {
        contentStart++;
      }

      lines.push(this.text.substring(contentStart, lineEndPos));

      // 移动到下一行开头（跳过换行符）
      currentPos = lineEndPos + 1;
    }

    if (lines.length === 0) return null;

    // 4. 更新主解析器进度
    this.pos = currentPos;

    // 5. 递归解析内部内容
    const innerContent = lines.join('\n');
    const innerParser = new Parser(innerContent);
    const children = innerParser.parse().children ?? [];

    return {
      type: 'blockquote',
      expandable: isExpandableQuote, // 使用变量
      children,
    };
  }

  /**
   * 纯文本解析
   * 优化逻辑：只扫描到最近的 marker 或父级结束条件
   */
  private parseText(endCondition: (pos: number) => boolean): AstNode | null {
    const startPos = this.pos;
    let endPos = this.text.length;

    // 优化：不再使用 substring 查找，而是利用 indexOf 的第二个参数
    for (const marker of this.markers) {
      const markerPos = this.text.indexOf(marker, this.pos);
      if (markerPos !== -1) {
        endPos = Math.min(endPos, markerPos);
      }
    }

    // 检查父级结束条件
    // 注意：这里简单的循环检查可能在长文本中较慢，但在 AST 解析中通常是必要的
    // 如果 endCondition 比较复杂，这里可以优化，但通常它是基于字符比对的
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
