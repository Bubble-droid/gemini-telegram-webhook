import { buildApp } from '@/app';
import { config, logger } from '@/services';
import { bot } from '@/services/apis';

/**
 * 启动 Fastify 服务器
 */
const start = async (): Promise<void> => {
  const { listenHost, listenPort } = config;
  const server = buildApp();

  // --- 1. 定义控制优雅退出的标志 ---
  let isShuttingDown = false;

  // --- 2. 定义优雅退出逻辑 ---
  const gracefulShutdown = async (signal: string) => {
    // 检查标志，确保只执行一次
    if (isShuttingDown) {
      logger.warn(`系统信号 ${signal} 被忽略，服务器正在关闭中...`);
      return;
    }
    isShuttingDown = true;
    logger.info(`收到系统信号 ${signal}，正在优雅关闭服务器...`);

    try {
      // server.close() 会触发 Fastify 的 onClose 钩子
      // 停止接收新 HTTP 请求，等待现有请求完成

      await server.close();
      logger.info('🚀 服务器已安全关闭 (Graceful Shutdown Completed)');
      process.exit(0);
    } catch (err) {
      logger.error('服务器关闭过程中发生错误', { err });
      process.exit(1);
    }
  };

  // --- 2. 注册信号监听 ---
  // SIGINT: 通常是 Ctrl+C
  // SIGTERM: 通常是 Docker/Kubernetes 的停止命令
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

  await bot.setWebhook(config.webhookUrl, {
    secret_token: config.secretToken,
  });

  // --- 3. 启动服务器 ---
  try {
    await server.listen({ host: listenHost, port: listenPort });
  } catch (err) {
    logger.fatal('Server startup failed', { err });
    process.exit(1);
  }
};

// 捕获未处理的 Promise 拒绝 (兜底)
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', { err });
  process.exit(1);
});

void start().catch((err: unknown) => {
  logger.error('Unhandled Rejection:', { err });
});
