import buildApp from '@app.js';
import { faqMatcher } from '@data/faq-matcher.js';
import { pathResolver } from '@data/path-resolver.js';
import { promptStore } from '@data/prompt-store.js';
import { GeminiAgent } from '@llm/agent/gemini-agent.js';
import { OpenAiAgent } from '@llm/agent/openai-agent.js';
import { GeminiApiClient } from '@llm/client/gemini-api-client.js';
import { OpenAiClient } from '@llm/client/openai-client.js';
import { McpClient } from '@llm/mcp/mcp-client.js';
import { createToolCaller } from '@llm/tool/tool-caller.js';
import { registerCliProxyRoute } from '@routes/cli.route.js';
import { registerGeminiProxyRoute } from '@routes/gemini.route.js';
import { registerWebhookRoute } from '@routes/webhook.route.js';
import { FileHandler } from '@services/file-service.js';
import { MessageCollector } from '@services/message-collector.js';
import { TaskScheduler } from '@services/task-scheduler.js';
import { CONFIG } from '@shared/core/config.js';
import {
  CLI_PROXY_BASE_URL,
  DATA_DIR,
  GEMINI_API_SAFETY_SETTINGS,
  GEMINI_CLIENT_BASE_CONFIG,
  GEMINI_PROXY_BASE_URL,
  GEMINI_SAFETY_SETTINGS,
  MCP_SERVERS_FILE,
  OPENAI_BASE_URL,
  OPENAI_MODEL,
} from '@shared/core/constants.js';
import { logger } from '@shared/core/logger.js';
import { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import { TelegramPoller } from '@telegram/bot/telegram-poller.js';
import { handleCallbackQuery } from '@telegram/handlers/callback-query-handler.js';
import { ChitchatHandler } from '@telegram/handlers/messages/chitchat-handler.js';
import { handleBotCommand } from '@telegram/handlers/messages/command-handler.js';
import { MentionHandler } from '@telegram/handlers/messages/mention-handler.js';
import { NormalMessageHandler } from '@telegram/handlers/messages/normal-message-handler.js';
import { UpdateHandler } from '@telegram/handlers/update-handler.js';
import path from 'node:path';

const MCP_SERVERS_PATH = path.join(DATA_DIR, MCP_SERVERS_FILE);
const BOT_UPDATE_MODE = process.env['NODE_ENV'] === 'development' ? 'polling' : 'webhook';

const start = async () => {
  const {
    WEBHOOK_RECEIVE_URL: url,
    WEBHOOK_SECRET_TOKEN: secret_token,
    SERVER_LISTEN_HOST: host,
    SERVER_LISTEN_PORT: port,
    SERVER_LOG_LEVEL: logLevel,
  } = CONFIG;

  logger.init({ logLevel });

  const mcpClient = new McpClient(MCP_SERVERS_PATH);
  await mcpClient.discoverMcpServers();

  const bot = new TelegramBotApi(CONFIG.TELEGRAM_BOT_TOKEN);
  const taskScheduler = new TaskScheduler(bot);
  bot.setScheduler(taskScheduler);

  const geminiApiClient = new GeminiApiClient(CONFIG.PROXY_AUTH_TOKEN, GEMINI_PROXY_BASE_URL, {
    ...GEMINI_CLIENT_BASE_CONFIG,
    enableEnhancedCivicAnswers: true,
  });
  const geminiCliClient = new GeminiApiClient(CONFIG.PROXY_AUTH_TOKEN, CLI_PROXY_BASE_URL, {
    ...GEMINI_CLIENT_BASE_CONFIG,
    safetySettings: GEMINI_SAFETY_SETTINGS,
  });
  const gemmaClient = new GeminiApiClient(CONFIG.PROXY_AUTH_TOKEN, GEMINI_PROXY_BASE_URL, GEMINI_CLIENT_BASE_CONFIG);

  const geminiApiAgent = new GeminiAgent(geminiApiClient);
  const geminiCliAgent = new GeminiAgent(geminiCliClient);
  const gemmaAgent = new GeminiAgent(gemmaClient);

  const openAiClient = new OpenAiClient(CONFIG.OPENAI_API_KEY, OPENAI_BASE_URL, {
    model: OPENAI_MODEL,
    extra_body: {
      google: {
        thinking_config: {
          include_thoughts: false,
          thinking_budget: -1,
        },
        safety_settings: GEMINI_API_SAFETY_SETTINGS,
      },
    },
  });

  const openAiAgent = new OpenAiAgent(openAiClient);

  const toolCaller = createToolCaller({ geminiApiAgent, geminiCliAgent, gemmaAgent, openAiAgent, mcpClient });

  const fileHandler = new FileHandler(bot);
  const messageCollector = new MessageCollector();
  const mentionHandler = new MentionHandler({
    fileHandler,
    geminiApiAgent,
    geminiCliAgent,
    gemmaAgent,
    openAiAgent,
    toolCaller,
    mcpClient,
  });
  const chitchatHandler = new ChitchatHandler({
    fileHandler,
    geminiApiAgent,
    geminiCliAgent,
    gemmaAgent,
    openAiAgent,
    toolCaller,
    mcpClient,
  });
  const normalMessageHandler = new NormalMessageHandler({ chitchatHandler });

  const updateHandler = new UpdateHandler(bot);

  updateHandler.onUpdate('callback_query', async (ctx) => {
    await handleCallbackQuery(ctx);
  });
  updateHandler.onUpdate('message', (ctx) => {
    messageCollector.append(ctx.message);
  });
  updateHandler.onUpdate('message', async (ctx) => {
    if (ctx.isBotCommand) {
      await handleBotCommand(ctx);
      return;
    }

    if (ctx.isBotMentioned || ctx.isReplyToBot || ctx.isMentionAlias) {
      const messages = await messageCollector.getMessages(ctx.message);
      await mentionHandler.handle(ctx, messages);
      return;
    }

    await normalMessageHandler.handle(ctx);
  });

  logger.info(`Environment: ${process.env['NODE_ENV']}`);
  logger.info(`Bot Mode: ${BOT_UPDATE_MODE.toUpperCase()}`);

  const server = buildApp();

  registerGeminiProxyRoute(server);
  registerCliProxyRoute(server);

  await pathResolver.loadFileIdMap();
  await promptStore.reload();
  await faqMatcher.reload();

  if (BOT_UPDATE_MODE === 'webhook') {
    registerWebhookRoute(server, updateHandler);
    await bot.setWebhook(url, true, {
      secret_token,
      allowed_updates: ['message', 'callback_query'],
    });
  } else {
    const poller = new TelegramPoller(bot, updateHandler);
    await poller.start(['callback_query', 'message']);
  }

  await server.listen({ host, port });
};

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', { err });
  process.exit(1);
});

try {
  await start();
} catch (err) {
  logger.fatal('Server startup failed', { err });
  process.exit(1);
}
