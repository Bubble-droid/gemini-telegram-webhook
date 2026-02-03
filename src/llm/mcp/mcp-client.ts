import { mcpServers } from '@configs/mcp-servers';
import type { GeneralFunctionSchema, StandardizedFunctionResponse } from '@llm/types/agent';
import type { ServerConfig } from '@llm/types/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { AgentError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import type { Recordable } from '@shared/types/common';
import type { JSONSchema } from '@shared/types/schema';
import { ms } from '@shared/utils/helpers';

type ServerName = keyof typeof mcpServers;

export class McpClient {
  private requestOptions: RequestOptions = { timeout: ms.min(5) };
  private tools: GeneralFunctionSchema[] = [];
  private clientName: string;
  private serverName: ServerName;
  private serverConfig: ServerConfig;
  private mcp: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;

  private activeConnections = 0;

  constructor(name: ServerName) {
    this.serverName = name;
    this.serverConfig = mcpServers[name];
    this.clientName = `${name}-client`;
    this.mcp = new Client({ name: this.clientName, version: '2.0.0' });
  }

  /**
   * 连接到所有配置的 MCP 服务器
   */
  public async connect(): Promise<void> {
    this.activeConnections++;

    if (this.transport) {
      logger.trace(`[${this.clientName}] Reusing existing connection (Active: ${this.activeConnections})`);
      return;
    }

    logger.info(`[${this.clientName}] Establishing new connection...`);

    try {
      if (this.serverConfig.type === 'http') {
        const { url, headers } = this.serverConfig;
        const resolvedHeaders = headers && this.resolvePlaceholders(headers);
        await this.connectRemoteServer(this.serverName, url, resolvedHeaders);
      } else {
        const { type, command, ...options } = this.serverConfig;
        await this.connectLocalServer(this.serverName, command, options);
      }
      await this.refreshTools();
      logger.info(`[${this.clientName}] Connected and tools refreshed`, {
        server: this.serverName,
        active: this.activeConnections,
      });
    } catch (err) {
      this.activeConnections--;
      this.transport = null;
      logger.error(`[${this.clientName}] Connection failed`, { err });
      throw err;
    }
  }

  /**
   * 断开连接 (引用计数)
   * 只有当所有活跃任务都完成时，才真正断开物理连接
   */
  public async disconnect(): Promise<void> {
    if (this.activeConnections > 0) {
      this.activeConnections--;
    }

    logger.debug(`[${this.clientName}] Release requested. Remaining active: ${this.activeConnections}`);

    if (this.activeConnections === 0 && this.transport) {
      logger.info(`[${this.clientName}] No active users. Closing transport.`);
      try {
        await this.mcp.close();
      } catch (err) {
        logger.warn(`[${this.clientName}] Error closing client`, { err });
      } finally {
        this.transport = null;
      }
    }
  }

  public getTools(): GeneralFunctionSchema[] {
    return this.tools;
  }

  /**
   * 执行工具调用并返回结果 Parts
   */
  public async callTool(
    name: string,
    args?: Recordable,
  ): Promise<StandardizedFunctionResponse<Awaited<ReturnType<Client['callTool']>>>> {
    if (!this.transport) {
      throw new AgentError(`[${this.clientName}] Cannot execute tools: Client is disconnected.`);
    }

    const startTime = Date.now();
    try {
      const toolResult = await this.mcp.callTool({ name, arguments: args }, CallToolResultSchema, this.requestOptions);
      logger.debug(`[${this.clientName}] Tool executed: ${name}`, {
        duration: `${Date.now() - startTime}ms`,
        args,
      });
      return {
        response: { output: toolResult },
      };
    } catch (err) {
      logger.warn(`[${this.clientName}] Tool call rejected: ${name}`, {
        duration: `${Date.now() - startTime}ms`,
        err,
      });
      return {
        response: {
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  private async connectRemoteServer(serverName: string, url: string, headers?: RequestInit['headers']): Promise<void> {
    const serverUrl = new URL(url);
    const requestInit = headers && { requestInit: { headers } };
    try {
      logger.debug(`[${serverName}] Attempting Streamable HTTP...`);
      this.transport = new StreamableHTTPClientTransport(serverUrl, { ...requestInit });
      await this.mcp.connect(this.transport as Transport, this.requestOptions);
    } catch (err) {
      logger.warn(`[${serverName}] HTTP Stream failed, falling back to SSE`, { err });
      this.transport = new SSEClientTransport(serverUrl, { ...requestInit });
      await this.mcp.connect(this.transport, this.requestOptions);
    }
    logger.info(`[${serverName}] Remote connection established`, { url });
  }

  private async connectLocalServer(
    serverName: string,
    command: string,
    options: Omit<StdioServerParameters, 'command'> = {},
  ): Promise<void> {
    logger.debug(`[${serverName}] Spawning Stdio process: ${command}`);
    this.transport = new StdioClientTransport({ command, ...options });
    await this.mcp.connect(this.transport, this.requestOptions);
    logger.info(`[${serverName}] Local server connected (PID: ${this.transport.stderr ? 'active' : 'unknown'})`);
  }

  /**
   * 获取并格式化工具列表以供 Gemini 使用
   */
  private async refreshTools(): Promise<void> {
    const toolsResult = await this.mcp.listTools();
    const functionTools = toolsResult.tools.map(
      (tool): GeneralFunctionSchema => ({
        name: tool.name,
        ...(tool.description && { description: tool.description }),
        parametersJsonSchema: tool.inputSchema as JSONSchema,
      }),
    );

    this.tools = functionTools;
    logger.info(`[${this.clientName}] Sync complete: ${this.tools.length} tools registered.`);
    logger.debug(`[${this.clientName}] Registered tools:`, { names: this.tools.map((d) => d.name) });
  }

  /**
   * 解析配置中的环境变量占位符
   */
  private resolvePlaceholders(obj: Recordable<string>): Recordable<string> {
    const resolvedObj: Recordable<string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolvedObj[key] = value.replace(/\$\{(.*?)\}/g, (match, varName: string) => {
          const envVar = process.env[varName];
          if (envVar) return envVar;
          logger.warn(`Environment variable "${varName}" not found for placeholder.`);
          return match;
        });
      } else {
        resolvedObj[key] = value;
      }
    }
    return resolvedObj;
  }
}
