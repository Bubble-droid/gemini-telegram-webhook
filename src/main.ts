import buildApp from '@app';
import { FUNCTION_TOOLS } from '@configs/function-tools';
import { faqMatcher } from '@data/faq-matcher';
import { pathResolver } from '@data/path-resolver';
import { promptStore } from '@data/prompt-store';
import { GeminiAgent } from '@llm/agent/gemini-agent';
import { OpenAiAgent } from '@llm/agent/openai-agent';
import { GeminiApiClient } from '@llm/client/gemini-api-client';
import { OpenAiClient } from '@llm/client/openai-client';
import { convertToOpenAiTool } from '@llm/lib/converter';
import { createToolCaller } from '@llm/tool/tool-call';
import type { ToolName } from '@llm/types/tool';
import { registerProxyRoute } from '@routes/gemini.route';
import { registerWebhookRoute } from '@routes/webhook.route';
import { FileHandler } from '@services/file-service';
import { MessageCollector } from '@services/message-collector';
import { RateLimiter } from '@services/rate-limiter';
import { TaskScheduler } from '@services/task-scheduler';
import { CONFIG } from '@shared/core/config';
import {
  DEFAULT_TEMPERATURE,
  DYNAMIC_THINKING_CONFIG,
  GEMINI_SAFETY_SETTINGS,
  OPENAI_MODEL,
} from '@shared/core/constants';
import { logger } from '@shared/core/logger';
import { ms } from '@shared/utils/helpers';
import { TelegramBotApi } from '@telegram/bot/telegram-bot-api';
import { ChitchatHandler } from '@telegram/handlers/messages/chitchat-handler';
import { MentionHandler } from '@telegram/handlers/messages/mention-handler';
import { NormalMessageHandler } from '@telegram/handlers/messages/normal-message-handler';
import { UpdateHandler } from '@telegram/handlers/update-handler';

/**
 * 启动 Fastify 服务器
 */
const start = async (): Promise<void> => {
  const {
    WEBHOOK_RECEIVE_URL: url,
    WEBHOOK_SECRET_TOKEN: secret_token,
    SERVER_LISTEN_HOST: host,
    SERVER_LISTEN_PORT: port,
    SERVER_LOG_LEVEL: logLevel,
  } = CONFIG;

  logger.init({ logLevel });

  const bot = new TelegramBotApi(CONFIG.TELEGRAM_BOT_TOKEN);
  const taskScheduler = new TaskScheduler(bot);
  bot.setScheduler(taskScheduler);

  const fileHandler = new FileHandler(bot);

  const geminiClient = new GeminiApiClient(CONFIG.LOCAL_PROXY_BASE_URL, {
    temperature: DEFAULT_TEMPERATURE,
    safetySettings: GEMINI_SAFETY_SETTINGS,
    thinkingConfig: DYNAMIC_THINKING_CONFIG,
  });
  const geminiAgent = new GeminiAgent(geminiClient);

  const openaiClient = new OpenAiClient(CONFIG.OPENAI_API_KEY, CONFIG.OPENAI_BASE_URL, {
    model: OPENAI_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    tools: FUNCTION_TOOLS.map(convertToOpenAiTool),
    tool_choice: 'auto',
    extra_body: {
      google: {
        thinking_config: {
          thinking_budget: -1,
        },
      },
    },
  });
  const openaiAgent = new OpenAiAgent(openaiClient, (name, args) => {
    return createToolCaller(bot, geminiAgent, () => {
      /*  */
    })[name as ToolName](args as never);
  });

  const rateLimiter = new RateLimiter(ms.sec(CONFIG.REQUEST_LIMIT_SECOND));
  const messageCollector = new MessageCollector();

  const mentionHandler = new MentionHandler({
    limiter: rateLimiter,
    fileHandler,
    agent: geminiAgent,
  });

  const chitchatHandler = new ChitchatHandler(openaiAgent, fileHandler);

  const normalMessageHandler = new NormalMessageHandler({
    mentionHandler,
    chitchatHandler,
  });

  const updateHandler = new UpdateHandler(bot, {
    messageCollector,
    mentionHandler,
    normalMessageHandler,
  });

  logger.info(`运行环境：${process.env['NODE_ENV']}`);

  const server = buildApp();

  registerWebhookRoute(server, updateHandler);
  registerProxyRoute(server);

  await pathResolver.loadFileIdMap();
  await promptStore.reload();
  await faqMatcher.reload();

  await bot.setWebhook(url, { secret_token });

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

  // --- 3. 启动服务器 ---
  try {
    await server.listen({ host, port });
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
