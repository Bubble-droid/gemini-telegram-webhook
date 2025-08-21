// src/server.ts

import type { FastifyInstance } from 'fastify';
import buildApp from '@/app';
import { BotConfig, Log } from '@/services';
import type { AddressInfo } from 'node:net';

/**
 * @function startServer
 * @description 启动 Fastify 服务器。
 *              此函数负责加载应用程序配置，初始化日志服务以及其他核心业务服务（如 Gemini、Telegram），
 *              然后构建 Fastify 应用程序并开始监听指定的网络端口。
 * @returns {Promise<void>} 此函数不返回任何值，如果服务器启动失败则会退出进程。
 */
const startServer = async (): Promise<void> => {
  const { listenHost: host, listenPort: port } = BotConfig.load();
  const server: FastifyInstance = await buildApp();
  try {
    await server.listen({ port, host });
    const addressInfo: AddressInfo | string | null = server.server.address();
    if (addressInfo && typeof addressInfo === 'object') {
      const serverUrl: string = `http://${addressInfo.address === '0.0.0.0' ? '127.0.0.1' : addressInfo.address}:${addressInfo.port}`;
      Log.info(`🚀 Server ready`, { url: serverUrl });
    } else {
      Log.info(`🚀 Server ready, listening on ${host}:${port}`);
    }
  } catch (error: unknown) {
    Log.fatal('Server startup failed', {
      err: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

startServer();
