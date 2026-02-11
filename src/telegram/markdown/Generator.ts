import type { AstNode, NodeType } from '@shared/types/markdown.js';
import { Escaper } from './Escaper.js';

/**
 * AST 生成器基类，负责将 AST 转换为字符串。
 */
export abstract class Generator {
  public generate(node: AstNode): string {
    return this.visitNode(node);
  }

  /**
   * 关键修复：将此方法设为 public，以便 chunk_splitting 模块可以合法访问。
   * 这是最直接的解决方案，因为它确实需要生成节点内容的能力。
   */
  public generateContent(node: AstNode): string {
    return node.content ?? this.visitChildren(node);
  }

  protected visitNode(node: AstNode): string {
    const open = this.getOpeningTag(node.type, node);
    const content = this.generateContent(node);
    const close = this.getClosingTag(node.type, node);
    return open + content + close;
  }

  protected visitChildren(node: AstNode): string {
    return node.children?.map((child) => this.visitNode(child)).join('') ?? '';
  }

  // 这两个方法主要由新的 chunk_splitting 模块使用
  public abstract getOpeningTag(type: NodeType, node: AstNode): string;
  public abstract getClosingTag(type: NodeType, node: AstNode): string;
}

// --- HTML 生成器 ---
export class HtmlGenerator extends Generator {
  getOpeningTag(type: NodeType, node: AstNode): string {
    switch (type) {
      case 'bold':
        return '<b>';
      case 'underline':
        return '<u>';
      case 'strikethrough':
        return '<s>';
      case 'spoiler':
        return '<span class="tg-spoiler">';
      case 'inline_code':
        return '<code>';
      case 'code_block': {
        // 关键修复：为 case 添加块级作用域，避免 ESLint 错误
        const langClass = node.lang ? ` class="language-${Escaper.html(node.lang)}"` : '';
        return `<pre><code${langClass}>`;
      }
      case 'link':
        return `<a href="${Escaper.html(node.href ?? '')}">`;
      case 'blockquote':
        return node.expandable ? '<blockquote expandable>' : '<blockquote>';
      default:
        return '';
    }
  }

  getClosingTag(type: NodeType): string {
    // 关键修复：将未使用的 'node' 重命名为 '_node'
    switch (type) {
      case 'bold':
        return '</b>';
      case 'underline':
        return '</u>';
      case 'strikethrough':
        return '</s>';
      case 'spoiler':
        return '</span>';
      case 'inline_code':
        return '</code>';
      case 'code_block':
        return '</code></pre>';
      case 'link':
        return '</a>';
      case 'blockquote':
        return '</blockquote>';
      default:
        return '';
    }
  }

  public override generateContent(node: AstNode): string {
    if (node.type === 'text') return Escaper.html(node.content ?? '');
    if (node.type === 'newline') return '\n';
    if (node.type === 'code_block' || node.type === 'inline_code') {
      return Escaper.html(node.content ?? '');
    }
    return this.visitChildren(node);
  }
}

// --- MarkdownV2 生成器 ---
export class MarkdownV2Generator extends Generator {
  getOpeningTag(type: NodeType, node: AstNode): string {
    switch (type) {
      case 'bold':
        return '*';
      case 'underline':
        return '__';
      case 'strikethrough':
        return '~';
      case 'spoiler':
        return '||';
      case 'inline_code':
        return '`';
      case 'code_block':
        return `\`\`\`${node.lang ?? ''}\n`;
      case 'link':
        return '[';
      default:
        return '';
    }
  }

  getClosingTag(type: NodeType, node: AstNode): string {
    switch (type) {
      case 'bold':
        return '*';
      case 'underline':
        return '__';
      case 'strikethrough':
        return '~';
      case 'spoiler':
        return '||';
      case 'inline_code':
        return '`';
      case 'code_block':
        return '\n```';
      case 'link':
        return `](${Escaper.markdownV2Url(node.href ?? '')})`;
      default:
        return '';
    }
  }

  public override generateContent(node: AstNode): string {
    if (node.type === 'text') return Escaper.markdownV2(node.content ?? '');
    if (node.type === 'newline') return '\n';
    if (node.type === 'code_block' || node.type === 'inline_code') {
      return Escaper.markdownV2Code(node.content ?? '');
    }
    if (node.type === 'blockquote') {
      const content = this.visitChildren(node);
      // 为块引用的每一行添加前缀
      return content
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    return this.visitChildren(node);
  }

  // 覆盖 visitNode 以特殊处理 blockquote，因为它不是包裹型标签
  protected override visitNode(node: AstNode): string {
    if (node.type === 'blockquote') {
      return this.generateContent(node);
    }
    return super.visitNode(node);
  }
}

// --- Legacy Markdown 生成器 ---
export class LegacyMarkdownGenerator extends Generator {
  getOpeningTag(type: NodeType, node: AstNode): string {
    switch (type) {
      case 'bold':
        return '*';
      case 'inline_code':
        return '`';
      case 'code_block':
        return `\`\`\`${node.lang ?? ''}\n`;
      case 'link':
        return '[';
      default:
        return ''; // 不支持的格式
    }
  }

  getClosingTag(type: NodeType, node: AstNode): string {
    switch (type) {
      case 'bold':
        return '*';
      case 'inline_code':
        return '`';
      case 'code_block':
        return '\n```';
      case 'link':
        return `](${node.href ?? ''})`; // Legacy 不转义 URL
      default:
        return '';
    }
  }

  public override generateContent(node: AstNode): string {
    if (node.type === 'text') return Escaper.legacyMarkdown(node.content ?? '');
    if (node.type === 'newline') return '\n';
    if (node.type === 'code_block' || node.type === 'inline_code') {
      // 潜在问题修复：根据 Telegram 文档，Legacy Markdown 实体内部不允许转义。
      // 因此，代码块和行内代码的内容应保持原样。
      return node.content ?? '';
    }
    // 对于不支持的格式，直接渲染其子节点，相当于剥离格式
    if (['underline', 'strikethrough', 'spoiler', 'blockquote'].includes(node.type)) {
      return this.visitChildren(node);
    }
    return this.visitChildren(node);
  }
}
