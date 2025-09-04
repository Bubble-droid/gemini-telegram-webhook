// src/script/execution.ts

import { VM } from 'vm2';
import type { Message, ScriptExecutionResult } from '@/types';
import { Http, Body } from './http_client';

/**
 * @class ExecutionService
 * @description 使用 vm2 在一个高度隔离的、安全的沙箱环境中执行 JavaScript 脚本。
 */
export class ExecutionService {
  /**
   * 执行指定的 JavaScript 脚本字符串。
   * 脚本必须包含一个异步或同步的 `run(input)` 函数。
   * 沙箱中会注入一个名为 `httpClient` 的网络请求工具。
   *
   * @param scriptContent - 要执行的脚本内容。
   * @param param - (可选) 需要传入脚本的参数，将被强制转换为字符串。
   * @returns 返回一个包含执行结果或错误信息的 Promise。
   */
  public async executeScript(scriptContent: string, message: Message, param?: unknown): Promise<ScriptExecutionResult> {
    const startTime = process.hrtime.bigint();

    // 1. 创建 vm2 实例，并配置沙箱
    const vm = new VM({
      timeout: 60000, // 脚本总执行时间超时（10秒）
      allowAsync: true, // 允许在沙箱中使用异步操作 (async/await, Promises)
      sandbox: {
        // 注入我们受控的 httpClient 实例
        Http,
        Body,
      },
    });

    try {
      // 2. 运行脚本内容，这会在沙箱的上下文中定义 `run` 函数
      vm.run(scriptContent);

      // 3. 准备传递给 `run` 函数的参数
      const scriptArgument = String(param ?? '');
      // 将参数安全地 "冻结" 到沙箱的全局作用域中
      vm.freeze(scriptArgument, 'scriptArgument');
      vm.freeze(message, 'message');

      // 4. 动态调用沙箱中的 `run` 函数，并传入参数
      // vm2 会自动处理 Promise，所以可以直接 await
      const result = await vm.run('run(scriptArgument, message)');

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      return {
        success: true,
        result,
        duration,
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      // 对 vm2 抛出的错误进行格式化，使其更易读
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 检查是否是 `run` 函数未定义的特定错误
      if (errorMessage.includes("'run' is not a function")) {
        return {
          success: false,
          error: "脚本执行失败：脚本中未定义有效的 'run' 函数。",
          duration,
        };
      }

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }
}

export const executionService: ExecutionService = new ExecutionService();
