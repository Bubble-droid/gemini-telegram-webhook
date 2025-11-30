// src/services/AppError.ts

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
    super(message); // 调用父类 Error 的构造函数，初始化消息
    this.name = this.constructor.name; // 错误名称设置为当前类的名称，便于识别

    // 设置错误代码
    if (code) {
      this.code = code;
    }

    // 在支持的环境（如 Node.js）中捕获堆栈跟踪，提升调试能力。
    // `this.constructor` 参数确保堆栈跟踪从该错误的构造函数调用点开始，
    // 而不是从 AppError 构造函数本身开始。
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
