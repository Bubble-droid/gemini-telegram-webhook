export class AppError extends Error {
  public readonly code?: string; // 可选的错误代码，用于更精细的错误分类

  /**
   * @param message - 错误的详细信息。
   * @param code - 可选的错误代码，例如 'CONFIG_INIT_FAILED'。
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
