// src/types/logger.d.ts

import type { Recordable } from './common';

/**
 * Logger 接口定义了日志记录的结构，通常用于描述 Fastify/Pino 产生的日志条目。
 */
export type PinoLog = {
  level: number;
  msg: string;
} & Recordable;

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
 * LogMethod 类型定义了我们日志服务中每个日志方法的统一签名。
 * 接收一个消息字符串和可选的附加数据。
 */
type LogMethod = (message: string, data?: Recordable) => void;

/**
 * AppLog 接口定义了我们导出的日志对象所拥有的方法。
 * 确保了日志服务提供的接口一致性。
 */
export interface AppLog {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}
