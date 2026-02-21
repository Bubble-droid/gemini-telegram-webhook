import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { ToolCallerInjectedDeps } from '@llm/types/tool.js';
import type { FileHandler } from '@services/file-service.js';
import type { MessageCollector } from '@services/message-collector.js';
import type { MentionHandler } from './messages/mention-handler.js';
import type { NormalMessageHandler } from './messages/normal-message-handler.js';

export interface HandlerWorkers {
  fileHandler: FileHandler;
  geminiApiAgent: GeminiAgent;
  geminiCliAgent: GeminiAgent;
  gemmaAgent: GeminiAgent;
  mcpClient: McpClient;
  toolCaller: ToolCallerInjectedDeps;
}

export interface Handlers {
  messageCollector: MessageCollector;
  mentionHandler: MentionHandler;
  normalMessageHandler: NormalMessageHandler;
}
