import type { AstNode, NodeType } from '@shared/types/markdown.js';
import { Escaper } from './Escaper.js';

/**
 * Base Generator class responsible for converting AST to string.
 */
export abstract class Generator {
  public generate(node: AstNode): string {
    return this.visitNode(node);
  }

  /**
   * Public access to allow chunk_splitting module to generate content.
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

  // Abstract methods used by subclasses and chunk_splitting
  public abstract getOpeningTag(type: NodeType, node: AstNode): string;
  public abstract getClosingTag(type: NodeType, node: AstNode): string;
}

// --- HTML Generator ---
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
        const langClass = node.lang ? ` class="language-${Escaper.html(node.lang)}"` : '';
        return `<pre><code${langClass}>`;
      }
      case 'link':
        return `<a href="${Escaper.html(node.href ?? '')}">`;
      case 'blockquote':
        return node.expandable ? '<blockquote expandable>' : '<blockquote>';
      // Lists: Telegram HTML doesn't support <ul>/<li>. We simulate them with text.
      case 'unordered_list':
        return '';
      case 'list_item':
        return (node.indent ?? '') + '· ';
      default:
        return '';
    }
  }

  getClosingTag(type: NodeType): string {
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
      case 'unordered_list':
        return '';
      case 'list_item':
        return '\n'; // Lists act as block elements
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

// --- MarkdownV2 Generator ---
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
      case 'unordered_list':
        return '';
      case 'list_item':
        return (node.indent ?? '') + '· ';
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
      case 'unordered_list':
        return '';
      case 'list_item':
        return '\n';
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
      return content
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    return this.visitChildren(node);
  }

  protected override visitNode(node: AstNode): string {
    if (node.type === 'blockquote') {
      return this.generateContent(node);
    }
    return super.visitNode(node);
  }
}

// --- Legacy Markdown Generator ---
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
      case 'unordered_list':
        return '';
      case 'list_item':
        return (node.indent ?? '') + '· ';
      default:
        return '';
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
        return `](${node.href ?? ''})`;
      case 'unordered_list':
        return '';
      case 'list_item':
        return '\n';
      default:
        return '';
    }
  }

  public override generateContent(node: AstNode): string {
    if (node.type === 'text') return Escaper.legacyMarkdown(node.content ?? '');
    if (node.type === 'newline') return '\n';
    if (node.type === 'code_block' || node.type === 'inline_code') {
      return node.content ?? '';
    }
    // Flatten unsupported tags by rendering children directly
    if (['underline', 'strikethrough', 'spoiler', 'blockquote'].includes(node.type)) {
      return this.visitChildren(node);
    }
    return this.visitChildren(node);
  }
}
