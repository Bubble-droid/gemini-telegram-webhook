// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Escaper {
  /**
   * 为 MarkdownV2 模式转义通用文本中的特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public static markdownV2(text: string): string {
    // 参照文档: In all other places characters '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!' must be escaped.
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * 为 MarkdownV2 模式下的 pre 和 code 实体内部转义特殊字符。
   * @param text 代码字符串。
   * @returns 转义后的代码字符串。
   */
  public static markdownV2Code(text: string): string {
    // 参照文档: Inside pre and code entities, all '`' and '\' characters must be escaped.
    return text.replace(/([`\\])/g, '\\$1');
  }

  /**
   * 为 MarkdownV2 模式下的链接 URL 部分转义特殊字符。
   * @param url URL 字符串。
   * @returns 转义后的 URL 字符串。
   */
  public static markdownV2Url(url: string): string {
    // 参照文档: Inside the (...) part of the inline link, all ')' and '\' must be escaped.
    return url.replace(/([)\\])/g, '\\$1');
  }

  /**
   * 为 HTML 模式转义特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public static html(text: string): string {
    // 参照文档: All <, > and & symbols that are not a part of a tag or an HTML entity must be replaced.
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;');
  }

  /**
   * 为 Legacy Markdown 模式转义实体内部的特殊字符。
   * @param text 要转义的字符串。
   * @returns 转义后的字符串。
   */
  public static legacyMarkdown(text: string): string {
    // 参照文档: To escape characters '_', '*', '`', '[' outside of an entity, prepend '\'.
    // 此处用于转义实体内部的内容，因为 Legacy 模式不允许内部转义，所以需要关闭实体再重新打开。
    // 但我们的输入规范是统一的，所以我们选择转义内容，这在多数情况下是安全的。
    return text.replace(/([_*`[])/g, '\\$1');
  }
}
