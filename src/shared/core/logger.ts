import type { Recordable } from '@shared/types/common.js';
import type { FastifyLoggerStreamDestination, LogLevel } from 'fastify/types/logger.js';
import type { ILogObj } from 'tslog';
import { Logger } from 'tslog';

type PinoLog = {
  level: number;
  msg: string;
} & Recordable;

type LogMethod = (message: string, data?: Recordable) => void;

interface SerializableError {
  name: string; // 错误的名称 (如 'ConfigError', 'TypeError')
  message: string; // 错误的详细消息
  stack?: string; // 错误的堆栈跟踪 (可选)
}

interface AppLog {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}

class LoggerService implements AppLog {
  /**
   * 提供给 Fastify 的 stream 适配器。
   * 负责将 Pino 的数值级别映射到 LoggerService 的对应方法。
   */
  public readonly stream: FastifyLoggerStreamDestination = {
    write: (pinoLogJson) => {
      try {
        const { level, msg, ...rest } = JSON.parse(pinoLogJson) as PinoLog;

        switch (true) {
          case level >= 60:
            this.fatal(msg, rest);
            break;
          case level >= 50:
            this.error(msg, rest);
            break;
          case level >= 40:
            this.warn(msg, rest);
            break;
          case level >= 30:
            this.info(msg, rest);
            break;
          case level >= 20:
            this.debug(msg, rest);
            break;
          default:
            this.trace(msg, rest);
            break;
        }
      } catch (err) {
        this.error('Failed to parse pino log JSON, logging as info.', {
          originalLog: pinoLogJson.trim(),
          err,
        });
      }
    },
  };

  private internalLogger: Logger<ILogObj>;

  // 默认配置：默认为 info 级别，避免初始化前产生过多噪音
  private readonly DEFAULT_MIN_LEVEL = 3;

  constructor() {
    // 构造函数中进行默认初始化，确保在调用 init 之前 logger 也是可用的
    this.internalLogger = this.createTslogInstance(this.DEFAULT_MIN_LEVEL);
  }

  /**
   * 初始化/重新配置日志器
   * 通常在应用启动获取到配置后调用
   */
  public init(opts?: { logLevel?: LogLevel; minLevel?: number }): void {
    const minLevel: number =
      typeof opts?.minLevel === 'number'
        ? opts.minLevel
        : opts?.logLevel
          ? this.mapLevelToNumber(opts.logLevel)
          : this.DEFAULT_MIN_LEVEL;

    this.internalLogger = this.createTslogInstance(minLevel);
    logger.info(`[Logger] 初始化完成，日志级别: ${opts?.logLevel}`);
  }

  // --- 公共日志方法 (完整实现) ---

  /**
   * 输出追踪级别日志 (Trace) - Level 0
   */
  public trace(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.trace(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出调试级别日志 (Debug) - Level 1
   */
  public debug(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.debug(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出信息级别日志 (Info) - Level 2
   */
  public info(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.info(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出警告级别日志 (Warn) - Level 3
   */
  public warn(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.warn(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出错误级别日志 (Error) - Level 4
   */
  public error(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.error(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出致命错误级别日志 (Fatal) - Level 5
   */
  public fatal(message: string, data?: Recordable): void {
    const payload = this.buildPayload(message, data);

    // 兼容性检查：如果 tslog 版本没有 fatal，回退到 error
    if (typeof this.internalLogger.fatal === 'function') {
      this.internalLogger.fatal(JSON.stringify(payload, null, 2));
    } else {
      this.internalLogger.error(JSON.stringify(payload, null, 2));
    }
  }

  /**
   * 将字符串日志级别映射为 tslog 数值
   * 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
   */
  private mapLevelToNumber(levelStr: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      silent: 0,
      trace: 1,
      debug: 2,
      info: 3,
      warn: 4,
      error: 5,
      fatal: 6,
    };
    return levels[levelStr];
  }

  /**
   * 创建 tslog 实例的工厂方法
   */
  private createTslogInstance(minLevel: number): Logger<ILogObj> {
    return new Logger({
      name: 'App',
      minLevel: minLevel,
      prettyLogTemplate: '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}\t{{logLevelName}}\t',
      prettyLogTimeZone: 'local',
      prettyErrorStackTemplate: '',
      prettyErrorLoggerNameDelimiter: '',
      prettyLogStyles: {
        logLevelName: {
          '*': ['bold', 'black', 'bgWhiteBright', 'dim'],
          TRACE: ['bold', 'magenta'],
          DEBUG: ['bold', 'cyan'],
          INFO: ['bold', 'blue'],
          WARN: ['bold', 'yellow'],
          ERROR: ['bold', 'red'],
          FATAL: ['bold', 'redBright'],
        },
      },
    });
  }

  /**
   * 序列化错误对象，防止 JSON.stringify 返回空对象或循环引用
   */
  private serializeError(err: Error): SerializableError {
    return {
      name: err.name,
      message: err.message,
      // stack: err.stack ?? 'No stack trace available',
    };
  }

  /**
   * 构建统一的日志 Payload
   * 如果 data 中包含 err 字段且为 Error 实例，自动进行序列化处理
   */
  private buildPayload(message: string, data: Recordable = {}): Recordable {
    const { err, ...rest } = data;
    const payload: Recordable = { message, ...rest };

    // 统一处理 Error 对象的序列化
    if (err instanceof Error) {
      payload['error'] = this.serializeError(err);
    }

    return payload;
  }
}

export const logger = new LoggerService();
