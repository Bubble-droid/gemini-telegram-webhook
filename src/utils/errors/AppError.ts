/**
 * @description 应用程序中所有自定义错误的基础类。
 *              提供统一的错误结构和堆栈跟踪捕获。
 *              可以包含一个可选的 `code` 属性，用于更精细的错误分类。
 */
export class AppError extends Error {
  public readonly code?: string; // 可选的错误代码，用于更精细的错误分类

  /**
   * 构造函数
   * @param {string} message - 错误的详细信息。
   * @param {string} [code] - 可选的错误代码，例如 'CONFIG_INIT_FAILED'。
   */
  constructor(message: string, code?: string) {
    super(message);
    this.name = this.constructor.name;

    // 设置错误代码
    if (code) {
      this.code = code;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}
