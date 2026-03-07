import buildApp from '@app.js';
import { CALLBACKS } from '@configs/callbacks.js';
import { canPerformAction, COMMANDS } from '@configs/commands.js';
import { Messages } from '@configs/messages.js';
import type { BotCommand } from '@grammyjs/types';
import { GeminiAgent } from '@llm/agent/gemini-agent.js';
import { OpenAiAgent } from '@llm/agent/openai-agent.js';
import { GeminiApiClient } from '@llm/client/gemini-api-client.js';
import { OpenAiClient } from '@llm/client/openai-client.js';
import { McpClient } from '@llm/mcp/mcp-client.js';
import { createToolCaller } from '@llm/tool/tool-caller.js';
import { registerGeminiProxyRoute } from '@routes/gemini.route.js';
import { registerWebhookRoute } from '@routes/webhook.route.js';
import { FileHandler } from '@services/file-service.js';
import { MessageCollector } from '@services/message-collector.js';
import { TaskScheduler } from '@services/task-scheduler.js';
import { CONFIG } from '@shared/core/config.js';
import {
  DATA_DIR,
  GEMINI_CLIENT_BASE_CONFIG,
  GEMINI_PROXY_BASE_URL,
  MCP_SERVERS_FILE,
  OPENAI_BASE_URL,
} from '@shared/core/constants.js';
import { TelegraphError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { decodeToString, ms } from '@shared/utils/helpers.js';
import { ChatHistoryStore } from '@storage/chat-history-store.js';
import { FaqMatcher } from '@storage/faq-matcher.js';
import { LongTermMemoryStore } from '@storage/long-term-memory-store.js';
import { pathResolver } from '@storage/path-resolver.js';
import { PromptStore } from '@storage/prompt-store.js';
import { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import { TelegramPoller } from '@telegram/bot/telegram-poller.js';
import { ChitchatHandler } from '@telegram/handlers/messages/chitchat-handler.js';
import { MentionHandler } from '@telegram/handlers/messages/mention-handler.js';
import { NormalMessageHandler } from '@telegram/handlers/messages/normal-message-handler.js';
import type { HandlerWorkers } from '@telegram/handlers/types.js';
import { UpdateHandler } from '@telegram/handlers/update-handler.js';
import { Redis } from '@upstash/redis';
import * as path from 'node:path';
import { Telegraph, type Account } from 'telegraph-api-client';

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

  const redisClient = new Redis({
    url: CONFIG.UPSTASH_REDIS_REST_URL,
    token: CONFIG.UPSTASH_REDIS_REST_TOKEN,
    keepAlive: true,
  });

  const chatHistory = new ChatHistoryStore(redisClient);

  const faqMatcher = new FaqMatcher();
  await faqMatcher.initFaqData();

  const promptStore = new PromptStore();
  await promptStore.initPrompts();

  await pathResolver.loadFileIdMap();

  const longTermMemory = new LongTermMemoryStore(redisClient);

  const mcpClient = new McpClient(MCP_SERVERS_PATH);
  await mcpClient.discoverMcpServers();

  const telegraph = new Telegraph();

  let accountInfo: Account;
  try {
    accountInfo = JSON.parse(decodeToString(CONFIG.TELEGRAPH_ACCOUNT_INFO)) as Account;
  } catch (err) {
    throw new TelegraphError(`Invalid account JSON format. ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  if (!accountInfo.access_token) {
    throw new TelegraphError('Authentication required: No access_token set.');
  }

  const bot = new TelegramBotApi(CONFIG.TELEGRAM_BOT_TOKEN, telegraph, accountInfo);
  const taskScheduler = new TaskScheduler(bot, redisClient);
  bot.setScheduler(taskScheduler);
  await taskScheduler.refreshSchedule();
  await bot.refreshBotInfo();

  const geminiApiClient = new GeminiApiClient(CONFIG.PROXY_AUTH_TOKEN, GEMINI_PROXY_BASE_URL, {
    ...GEMINI_CLIENT_BASE_CONFIG,
    enableEnhancedCivicAnswers: true,
  });

  const geminiApiAgent = new GeminiAgent(geminiApiClient);

  const openAiClient = new OpenAiClient(CONFIG.OPENAI_API_KEY, OPENAI_BASE_URL);
  const openAiAgent = new OpenAiAgent(openAiClient);

  const toolCaller = createToolCaller({ geminiApiAgent, openAiAgent, mcpClient, longTermMemory });

  const fileHandler = new FileHandler(bot);
  const messageCollector = new MessageCollector();

  const handlerWorkers: HandlerWorkers = {
    fileHandler,
    geminiApiAgent,
    openAiAgent,
    toolCaller,
    mcpClient,
    chatHistory,
    promptStore,
    longTermMemory,
  };

  const mentionHandler = new MentionHandler(handlerWorkers);
  const chitchatHandler = new ChitchatHandler(handlerWorkers);
  const normalMessageHandler = new NormalMessageHandler({ chitchatHandler, faqMatcher });

  const updateHandler = new UpdateHandler(bot);

  const botCommands = COMMANDS.map((cmd): BotCommand => {
    const { action, permissions, ...rest } = cmd;
    return rest;
  });

  COMMANDS.forEach((c) => {
    updateHandler.command(c.command, async (ctx) => {
      await ctx.api.setBotCommands(botCommands, ctx.chat.id, ctx.user.id).catch((err: unknown) => {
        logger.warn('Failed to set bot commands:', { err });
      });
      if (c.permissions) {
        if (!(await canPerformAction(ctx))) {
          return;
        }
      }
      await c.action({ ctx, chatHistory });
    });
  });

  CALLBACKS.forEach((c) => {
    updateHandler.callback(c.data, async (ctx) => {
      await ctx.api.answerCallbackQuery(ctx.callbackQueryId).catch((err: unknown) => {
        logger.warn('Failed to answer callback query:', { err });
      });
      await c.action({ ctx, mentionHandler }).catch(async (err: unknown) => {
        logger.warn('Failed to handle callback query:', { err });
        await ctx.updateCallbackMessage(Messages.callbackFailed, {
          deleteAfterMs: ms['3m'],
        });
      });
    });
  });

  updateHandler.message((ctx) => {
    messageCollector.append(ctx.message!);
  });

  updateHandler.message(async (ctx, done) => {
    if (!ctx.isBotMentioned) return;
    done();
    const messages = await messageCollector.getMessages(ctx.message!);
    await mentionHandler.handle(ctx, messages);
  });

  updateHandler.message(async (ctx) => {
    await normalMessageHandler.handle(ctx);
  });

  logger.info(`Environment: ${process.env['NODE_ENV']}`);
  logger.info(`Bot Mode: ${BOT_UPDATE_MODE.toUpperCase()}`);

  const server = buildApp();

  registerGeminiProxyRoute(server);

  await bot.deleteWebhook(true);
  if (BOT_UPDATE_MODE === 'webhook') {
    registerWebhookRoute(server, updateHandler);
    await bot.setWebhook(url, true, {
      secret_token,
      allowed_updates: ['message', 'callback_query'],
    });
  } else {
    const poller = new TelegramPoller(bot, updateHandler);
    poller.start(['callback_query', 'message']);
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
