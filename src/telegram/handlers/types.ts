import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { OpenAiAgent } from '@llm/agent/openai-agent.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { ToolCallerInjectedDeps } from '@llm/types/tool.js';
import type { FileHandler } from '@services/file-service.js';
import type { MessageCollector } from '@services/message-collector.js';
import type { ChatHistoryStore } from '@storage/chat-history-store.js';
import type { LongTermMemoryStore } from '@storage/long-term-memory-store.js';
import type { PromptStore } from '@storage/prompt-store.js';
import type { MentionHandler } from './messages/mention-handler.js';
import type { NormalMessageHandler } from './messages/normal-message-handler.js';

export interface HandlerWorkers {
  fileHandler: FileHandler;
  geminiApiAgent: GeminiAgent;
  openAiAgent: OpenAiAgent;
  mcpClient: McpClient;
  toolCaller: ToolCallerInjectedDeps;
  chatHistory: ChatHistoryStore;
  promptStore: PromptStore;
  longTermMemory: LongTermMemoryStore;
}

export interface Handlers {
  messageCollector: MessageCollector;
  mentionHandler: MentionHandler;
  normalMessageHandler: NormalMessageHandler;
}
