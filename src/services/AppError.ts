// src/services/error.ts

/**
 * @class AppError
 * @extends Error
 * @description 应用程序中所有自定义错误的基础类。
 *              提供统一的错误结构和堆栈跟踪捕获。
 *              可以包含一个可选的 `code` 属性，用于更精细的错误分类。
 */
class AppError extends Error {
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

/**
 * @class GeminiError
 * @extends AppError
 * @description 表示与 Google Gemini API 交互时发生的错误。
 *              可用于 API 请求失败、内容生成限制等场景。
 */
export class GeminiError extends AppError {
  // 新增 public readonly hasToolThoughts 属性
  public readonly hasToolThoughts?: boolean;

  /**
   * 构造函数
   * @param {string} message - Gemini API 错误的详细信息。
   * @param {string} [code] - 可选的错误代码，例如 'GEMINI_API_ERROR'。
   * @param {boolean} [hasToolThoughts] - 可选的布尔值，指示错误发生时是否有工具思考过程。
   */
  constructor(message: string, code?: string, hasToolThoughts?: boolean) {
    // 默认使用 'GEMINI_API_ERROR' 作为错误代码
    super(message, code || 'GEMINI_API_ERROR');
    // 保存 hasToolThoughts 属性
    this.hasToolThoughts = hasToolThoughts;
  }
}

export class KvNamespaceError extends AppError {
  constructor(
    public message: string,
    public code?: string,
  ) {
    super(message, code || 'KV_NAMESPACE_ERROR');
  }
}

/**
 * @class GitHubAPIError
 * @description 自定义错误类，用于封装来自 GitHub API 的错误信息。
 */
export class GithubError extends AppError {
  constructor(
    public message: string,
    public code?: string,
  ) {
    super(message, code || 'GITHUB_API_ERROR');
  }
}

/**
 * @class ConfigError
 * @extends AppError
 * @description 表示在加载或解析应用程序配置时发生的特定错误。
 */
class ConfigError extends AppError {
  /**
   * 构造函数
   * @param {string} message - 配置错误的详细信息。
   */
  constructor(message: string, code?: string) {
    // 默认使用 'CONFIG_ERROR' 作为错误代码
    super(message, code || 'CONFIG_ERROR');
    // name 属性已由 AppError 的构造函数设置为 'ConfigError'
  }
}

class ContextError extends AppError {
  /**
   * 构造函数
   * @param {string} message - 错误信息。
   */
  constructor(message: string, code?: string) {
    // 默认使用 'TELEGRAM_ERROR' 作为错误代码
    super(message, code || 'CONTEXT_ERROR');
    // name 属性已由 AppError 的构造函数设置为 'TelegramError'
  }
}

/**
 * @class TelegramError
 * @extends AppError
 * @description 表示与 Telegram Bot API 交互时发生的错误。
 *              可用于网络请求失败、API 返回错误等场景。
 */
class TelegramError extends AppError {
  /**
   * 构造函数
   * @param {string} message - Telegram API 错误的详细信息。
   * @param {string} [code] - 可选的错误代码，例如 'TELEGRAM_API_ERROR'。
   */
  constructor(message: string, code?: string) {
    // 默认使用 'TELEGRAM_API_ERROR' 作为错误代码
    super(message, code || 'TELEGRAM_API_ERROR');
    // name 属性已由 AppError 的构造函数设置为 'TelegramError'
  }
}

// 统一导出所有自定义错误类。
// 这个模块本身扮演了“错误服务”的角色，因为它集中提供了不同服务的错误定义，
// 方便在整个应用程序中被导入和使用，从而实现对不同服务错误的“处理”（识别和分类）。
export { AppError, ConfigError, ContextError, TelegramError };
