// src/utils/formatters/escaper.ts

/**
 * 封装了针对 Telegram 不同解析模式的文本转义方法。
 * 严格遵循 Telegram Bot API 文档中的转义规则。
 */
export class Escaper {
  /**
   * 为 MarkdownV2 模式转义通用文本中的特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public markdownV2(text: string): string {
    // 参照文档: In all other places characters '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!' must be escaped.
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * 为 MarkdownV2 模式下的 pre 和 code 实体内部转义特殊字符。
   * @param text 代码字符串。
   * @returns 转义后的代码字符串。
   */
  public markdownV2Code(text: string): string {
    // 参照文档: Inside pre and code entities, all '`' and '\' characters must be escaped.
    return text.replace(/([`\\])/g, '\\$1');
  }

  /**
   * 为 MarkdownV2 模式下的链接 URL 部分转义特殊字符。
   * @param url URL 字符串。
   * @returns 转义后的 URL 字符串。
   */
  public markdownV2Url(url: string): string {
    // 参照文档: Inside the (...) part of the inline link, all ')' and '\' must be escaped.
    return url.replace(/([)\\])/g, '\\$1');
  }

  /**
   * 为 HTML 模式转义特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public html(text: string): string {
    // 参照文档: All <, > and & symbols that are not a part of a tag or an HTML entity must be replaced.
    return text.replace(/[<>&]/g, (char) => {
      switch (char) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        default:
          return char;
      }
    });
  }

  /**
   * 为 Legacy Markdown 模式转义实体内部的特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public legacyMarkdown(text: string): string {
    // 参照文档: To escape characters '_', '*', '`', '[' outside of an entity, prepend '\'.
    // 此处用于转义实体内部的内容，因为 Legacy 模式不允许内部转义，所以需要关闭实体再重新打开。
    // 但我们的输入规范是统一的，所以我们选择转义内容，这在多数情况下是安全的。
    return text.replace(/([_*`[])/g, '\\$1');
  }
}
