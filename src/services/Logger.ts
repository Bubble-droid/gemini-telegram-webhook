// src/services/logger.ts

import { Logger, type ILogObj } from 'tslog';
import type { AppLog, LogData, LoggerLevel, LoggerAdapter, LoggerMessage, SerializableError } from '@/types';

// 私有模块变量，用于存储 tslog 实例。
// 初始为 null，表示尚未初始化。
let tslogInstance: Logger<ILogObj> | null = null;

/**
 * 将日志级别字符串（如 'info', 'error'）映射到 tslog 内部使用的数值级别。
 * tslog 默认的数值级别：0=trace, 1=debug, 2=info, 3=warn, 4=error, 5=fatal。
 * @param {LoggerLevel} levelStr - 日志级别字符串。
 * @returns {number} 对应的数值级别。
 */
const mapLoggerLevelToNumber = (levelStr: LoggerLevel): number => {
  switch (levelStr) {
    case 'trace':
      return 0;
    case 'debug':
      return 1;
    case 'info':
      return 2;
    case 'warn':
      return 3;
    case 'error':
      return 4;
    case 'fatal':
      return 5;
    default:
      return 2; // 默认回退到 'info' 级别
  }
};

/**
 * 创建一个新的 tslog 实例。
 * @param {number} minLevel - Tslog 实例的最小日志级别。只有达到或高于此级别的日志才会被输出。
 * @returns {Logger<ILogObj>} 配置好的 tslog 实例。
 */
const createTslogInstance = (minLevel: number): Logger<ILogObj> => {
  return new Logger({
    name: 'App', // 日志器的名称
    minLevel: minLevel, // 最小日志级别
    // 漂亮的日志模板，用于控制台输出的格式
    prettyLogTemplate: '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}\t{{logLevelName}}\t',
    prettyLogTimeZone: 'local', // 使用本地时区显示时间
    prettyErrorStackTemplate: '', // 错误堆栈模板，这里设置为空以避免重复输出
    prettyErrorLoggerNameDelimiter: '', // 错误日志器名称分隔符
    // 为不同日志级别定义控制台输出样式
    prettyLogStyles: {
      logLevelName: {
        '*': ['bold', 'black', 'bgWhiteBright', 'dim'], // 默认样式
        INFO: ['bold', 'blue'],
        WARN: ['bold', 'yellow'],
        ERROR: ['bold', 'red'],
        FATAL: ['bold', 'redBright'],
      },
    },
  });
};

/**
 * 初始化日志器。此函数应在应用程序启动时调用一次。
 * 它会根据传入的配置设置 tslog 的最小日志级别。
 * @param {object} [opts] - 初始化选项。
 * @param {LoggerLevel} [opts.loggerLevel] - 期望的日志级别字符串（例如 'info', 'debug'）。
 * @param {number} [opts.minLevel] - 期望的最小日志级别数值。如果同时提供了 `loggerLevel` 和 `minLevel`，`minLevel` 优先级更高。
 * @returns {void}
 */
const initLogger = (opts?: { loggerLevel?: LoggerLevel; minLevel?: number }): void => {
  // 根据传入的选项确定最小日志级别
  const minLevel: number =
    typeof opts?.minLevel === 'number'
      ? opts.minLevel // 如果提供了 minLevel，则直接使用
      : opts?.loggerLevel // 否则，如果提供了 loggerLevel，则进行转换
        ? mapLoggerLevelToNumber(opts.loggerLevel)
        : mapLoggerLevelToNumber('info'); // 如果两者都未提供，默认使用 'info' 级别

  // 创建或重新创建 tslog 实例
  tslogInstance = createTslogInstance(minLevel);
};

/**
 * 序列化 Error 对象，将其转换为一个普通对象，以便在 JSON 日志中包含错误详情。
 * @param {Error} err - 待序列化的 Error 实例。
 * @returns {SerializableError} 包含错误名称、消息和堆栈（如果存在）的对象。
 */
const serializeError = (err: Error): SerializableError => ({
  name: err.name,
  message: err.message,
});

/**
 * 导出的日志服务包装器。
 * 提供了 `info`, `warn`, `error`, `fatal` 等方法，这些方法会在内部调用 `tslogInstance`。
 * 如果 `tslogInstance` 尚未初始化，它们会回退到标准的 `console` 方法。
 * 这种设计确保了日志服务始终可用，无论初始化状态如何。
 */
export const Log: AppLog = {
  /**
   * 输出信息级别日志。
   * @param {string} message - 日志消息。
   * @param {LogData} [data] - 附加的日志数据，可以包含任意键值对。
   */
  info: (message: string, data?: LogData): void => {
    // 构造日志 payload，将消息和附加数据合并
    const payload: LogData = { message, ...(data || {}) };
    if (tslogInstance) {
      // 如果 tslog 已初始化，使用其 info 方法。tslog 可以直接处理对象。
      tslogInstance.info(JSON.stringify(payload, null, 2));
    } else {
      // 否则，回退到 console.log
      console.log('INFO', JSON.stringify(payload, null, 2));
    }
  },

  /**
   * 输出警告级别日志。
   * @param {string} message - 日志消息。
   * @param {LogData} [data] - 附加的日志数据。
   */
  warn: (message: string, data?: LogData): void => {
    const payload: LogData = { message, ...(data || {}) };
    if (tslogInstance) {
      tslogInstance.warn(JSON.stringify(payload, null, 2));
    } else {
      console.warn('WARN', JSON.stringify(payload, null, 2));
    }
  },

  /**
   * 输出错误级别日志。
   * 如果 `data` 中包含 `err` 属性且其值为 Error 实例，会将其序列化并添加到日志 payload 中。
   * @param {string} message - 日志消息。
   * @param {LogData} [data] - 附加的日志数据，可能包含 Error 实例。
   */
  error: (message: string, data?: LogData): void => {
    const payload: LogData = { message, ...(data || {}) };
    if (data?.err instanceof Error) {
      // 如果存在 Error 实例，将其序列化并添加到 payload 的 'error' 字段
      payload.error = serializeError(data.err);
      delete payload.err; // 移除原始 Error 对象，避免循环引用或不必要的序列化
    }
    if (tslogInstance) {
      tslogInstance.error(JSON.stringify(payload, null, 2));
    } else {
      console.error('ERROR', JSON.stringify(payload, null, 2));
    }
  },

  /**
   * 输出致命错误级别日志。
   * 如果 `data` 中包含 `err` 属性且其值为 Error 实例，会将其序列化并添加到日志 payload 中。
   * 如果 `tslogInstance` 没有 `fatal` 方法，则会降级使用 `error` 方法。
   * @param {string} message - 日志消息。
   * @param {LogData} [data] - 附加的日志数据，可能包含 Error 实例。
   */
  fatal: (message: string, data?: LogData): void => {
    const payload: LogData = { message, ...(data || {}) };
    if (data?.err instanceof Error) {
      payload.error = serializeError(data.err);
      delete payload.err;
    }
    if (tslogInstance) {
      if (typeof tslogInstance.fatal === 'function') {
        // 某些版本的 tslog 可能不提供 fatal 方法
        tslogInstance.fatal(JSON.stringify(payload, null, 2));
      } else {
        // 降级使用 error 方法
        tslogInstance.error(JSON.stringify(payload, null, 2));
      }
    } else {
      console.error('FATAL', JSON.stringify(payload, null, 2));
    }
  },
};

/**
 * Fastify / Pino 日志适配器。
 * 此对象实现了 `LoggerAdapter` 接口，可以直接作为 Fastify 配置中 `logger.stream` 的值。
 * 它负责接收 Fastify (内部使用 Pino) 输出的 JSON 格式日志字符串，解析后将其转发到我们自定义的 `log` 服务。
 */
const loggerAdapter: LoggerAdapter = {
  /**
   * 接收来自 Pino 的一行 JSON 字符串日志，并将其转换为结构化日志。
   * @param {string} pinoLogJson - Pino 输出的单行 JSON 字符串日志。
   * @returns {void}
   */
  write: (pinoLogJson: string): void => {
    try {
      // 尝试解析 JSON 字符串为 LoggerMessage (即 PinoLog) 对象
      const { level, msg, ...rest } = JSON.parse(pinoLogJson) as LoggerMessage;

      // 删除 Pino/Fastify 自动添加的一些重复或不必要的字段，使日志更整洁
      delete rest.time; // 日志时间戳
      delete rest.pid; // 进程 ID
      delete rest.hostname; // 主机名

      // 根据 Pino 的日志级别（数值）调用我们自定义日志服务的对应方法
      switch (true) {
        case level >= 60: // 60 是 Pino 的 FATAL 级别
          Log.fatal(msg, rest);
          break;
        case level >= 50: // 50 是 Pino 的 ERROR 级别
          Log.error(msg, rest);
          break;
        case level >= 40: // 40 是 Pino 的 WARN 级别
          Log.warn(msg, rest);
          break;
        case level >= 30: // 30 是 Pino 的 INFO 级别
          Log.info(msg, rest);
          break;
        default:
          // 对于更低级别（如 debug, trace），也映射到 info
          Log.info(msg, rest);
          break;
      }
    } catch (e: unknown) {
      // 如果 JSON 解析失败（例如，Fastify 输出了一些非 JSON 格式的信息），
      // 则记录一个错误日志，并包含原始的非 JSON 内容
      Log.error('Failed to parse pino log JSON, logging as info.', {
        originalLog: pinoLogJson.trim(),
        err: e as Error,
      });
    }
  },
};

export { initLogger, loggerAdapter };
