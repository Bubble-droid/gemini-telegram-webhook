// src/services/LoggerService.ts

import type { AppLog, LogData, LoggerAdapter, LoggerLevel, PinoLog, SerializableError } from '@/types';
import { Logger, type ILogObj } from 'tslog';

/**
 * @class LoggerService
 * @description 统一日志服务类，封装 tslog 并提供 Fastify 适配器。
 *              采用无状态单例模式设计，实现了完整的日志级别方法。
 */
class LoggerService implements AppLog {
  private internalLogger: Logger<ILogObj>;

  // 默认配置：默认为 info 级别，避免初始化前产生过多噪音
  private readonly DEFAULT_MIN_LEVEL = 3;

  constructor() {
    // 构造函数中进行默认初始化，确保在调用 init 之前 logger 也是可用的
    this.internalLogger = this.createTslogInstance(this.DEFAULT_MIN_LEVEL);
  }

  /**
   * 将字符串日志级别映射为 tslog 数值
   * 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
   */
  private mapLevelToNumber(levelStr: LoggerLevel): number {
    const levels: Record<LoggerLevel, number> = {
      trace: 1,
      debug: 2,
      info: 3,
      warn: 4,
      error: 5,
      fatal: 6,
    };
    return levels[levelStr] ?? 3;
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
      // stack: err.stack, // 如需调试堆栈，可取消注释
    };
  }

  /**
   * 构建统一的日志 Payload
   * 如果 data 中包含 err 字段且为 Error 实例，自动进行序列化处理
   */
  private buildPayload(message: string, data?: LogData): LogData {
    const payload: LogData = { message, ...(data || {}) };

    // 统一处理 Error 对象的序列化
    if (data?.err instanceof Error) {
      payload.error = this.serializeError(data.err);
      delete payload.err; // 移除原始 Error 对象
    }

    return payload;
  }

  /**
   * 初始化/重新配置日志器
   * 通常在应用启动获取到配置后调用
   */
  public init(opts?: { loggerLevel?: LoggerLevel; minLevel?: number }): void {
    const minLevel: number =
      typeof opts?.minLevel === 'number'
        ? opts.minLevel
        : opts?.loggerLevel
          ? this.mapLevelToNumber(opts.loggerLevel)
          : this.DEFAULT_MIN_LEVEL;

    this.internalLogger = this.createTslogInstance(minLevel);
    logger.info(`[Logger] 初始化完成，日志级别: ${opts?.loggerLevel}`);
  }

  // --- 公共日志方法 (完整实现) ---

  /**
   * 输出追踪级别日志 (Trace) - Level 0
   */
  public trace(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.trace(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出调试级别日志 (Debug) - Level 1
   */
  public debug(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.debug(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出信息级别日志 (Info) - Level 2
   */
  public info(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.info(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出警告级别日志 (Warn) - Level 3
   */
  public warn(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.warn(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出错误级别日志 (Error) - Level 4
   */
  public error(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);
    this.internalLogger.error(JSON.stringify(payload, null, 2));
  }

  /**
   * 输出致命错误级别日志 (Fatal) - Level 5
   */
  public fatal(message: string, data?: LogData): void {
    const payload = this.buildPayload(message, data);

    // 兼容性检查：如果 tslog 版本没有 fatal，回退到 error
    if (typeof this.internalLogger.fatal === 'function') {
      this.internalLogger.fatal(JSON.stringify(payload, null, 2));
    } else {
      this.internalLogger.error(JSON.stringify(payload, null, 2));
    }
  }

  // --- Fastify 适配器 ---

  /**
   * 提供给 Fastify 的 stream 适配器。
   * 负责将 Pino 的数值级别映射到 LoggerService 的对应方法。
   */
  public readonly stream: LoggerAdapter = {
    write: (pinoLogJson: string): void => {
      try {
        const { level, msg, ...rest } = JSON.parse(pinoLogJson) as PinoLog;

        // 清理 Pino 默认字段
        delete rest.time;
        delete rest.pid;
        delete rest.hostname;

        // Pino Level Mapping:
        // 10: Trace
        // 20: Debug
        // 30: Info
        // 40: Warn
        // 50: Error
        // 60: Fatal

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
          default: // level 10 or lower
            this.trace(msg, rest);
            break;
        }
      } catch (e: unknown) {
        this.error('Failed to parse pino log JSON, logging as info.', {
          originalLog: pinoLogJson.trim(),
          err: e as Error,
        });
      }
    },
  };
}

// 导出单例实例
export const logger = new LoggerService();
