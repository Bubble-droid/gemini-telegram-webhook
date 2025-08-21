// src/types/logger.d.ts

/**
 * Logger 接口定义了日志记录的结构，通常用于描述 Fastify/Pino 产生的日志条目。
 */
export interface PinoLog {
  level: number; // 日志级别（例如 Pino 的数值级别）
  time?: number; // 时间戳 (可选)
  pid?: number; // 进程 ID (可选)
  hostname?: string; // 主机名 (可选)
  reqId: string; // 请求 ID
  msg: string; // 日志消息
  req?: LogReq;
  res?: LogRes;
  responseTime?: number; // 响应时间 (可选)
  [key: string]: unknown;
}

export interface LogReq {
  method: string;
  url: string;
  host: string;
  remoteAddress: string;
  remotePort: number;
}

export interface LogRes {
  // 响应信息 (可选)
  statusCode: number;
}

/**
 * LogData 类型别名，表示可以作为附加数据传递给日志方法的任意键值的对象。
 * 通常用于包含更多上下文信息，且是可序列化友好的。
 */
export type LogData = Record<string, unknown>;

/**
 * SerializableError 接口定义了 Error 对象在被序列化为 JSON 时的结构。
 * 通常包含错误的名称、消息和堆栈信息。
 */
export interface SerializableError {
  name: string; // 错误的名称 (如 'ConfigError', 'TypeError')
  message: string; // 错误的详细消息
  stack?: string; // 错误的堆栈跟踪 (可选)
}

/**
 * TslogInstance 接口定义了我们期望 tslog 实例拥有的最小方法签名。
 * 兼容 tslog 的 info, warn, error, fatal 方法。
 */
export interface TslogInstance {
  info(msg: unknown, ...args: unknown[]): void; // msg 可以是字符串或对象
  warn(msg: unknown, ...args: unknown[]): void;
  error(msg: unknown, ...args: unknown[]): void;
  fatal?(msg: unknown, ...args: unknown[]): void; // fatal 方法可能在某些日志库中是可选的
}

/**
 * LogMethod 类型定义了我们日志服务中每个日志方法的统一签名。
 * 接收一个消息字符串和可选的附加数据。
 */
export type LogMethod = (message: string, data?: LogData) => void;

/**
 * AppLog 接口定义了我们导出的日志对象所拥有的方法。
 * 确保了日志服务提供的接口一致性。
 */
export interface AppLog {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}

/**
 * LoggerMessage 类型别名，用于 Fastify 日志适配器解析 Pino 日志。
 * 实际上与 PinoLog 相同，提供更具语义的名称。
 */
export type LoggerMessage = PinoLog;

/**
 * LoggerAdapter 接口定义了 Fastify 日志流适配器的契约。
 * 它的 `write` 方法用于接收 Fastify 的日志输出。
 */
export interface LoggerAdapter {
  /**
   * 接收 pino 输出的一行 JSON 字符串日志。
   * 适配器内部负责解析此字符串并转发到我们自己的日志服务。
   * @param {string} pinoLogJson - Pino 产生的 JSON 格式日志字符串。
   * @returns {void}
   */
  write(pinoLogJson: string): void;
}

/**
 * CreateLogOptions 接口定义了创建日志实例时可能需要传递的选项。
 */
export interface CreateLogOptions {
  tslogInstance: TslogInstance;
}

/**
 * CreateLog 类型定义了日志工厂函数的签名。
 */
export type CreateLog = (opts: CreateLogOptions) => AppLog;
