import { mcpServers } from '@/configs/mcp-servers';
import { config, logger } from '@/services';
import type { Config, Recordable, ServerConfig, ServerName, StandardizedFunctionResponse } from '@/types';
import { AppError } from '@/utils/errors';
import { Type, type FunctionDeclaration, type Tool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

export class MCPClient {
  private requestOptions: RequestOptions = { timeout: 60 * 60_000 };
  private tools: Tool[] = [{ functionDeclarations: [] }];
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

    // 如果已经有 Transport 且连接中，直接复用，不做任何操作
    if (this.transport) {
      logger.debug(`[${this.clientName}] Reusing existing connection (Active: ${this.activeConnections})`);
      return;
    }

    logger.debug(`[${this.clientName}] Establishing new connection...`);

    try {
      if (this.serverConfig.type === 'http') {
        const { url, headers } = this.serverConfig;
        const resolvedHeaders = headers && this.resolvePlaceholders(headers);
        await this.connectRemoteServer(this.serverName, url, resolvedHeaders);
      } else {
        const { type: _t, command, ...options } = this.serverConfig;
        await this.connectLocalServer(this.serverName, command, options);
      }
      await this.refreshTools();
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
      logger.debug(`[${this.clientName}] No active users. Closing transport.`);
      try {
        await this.mcp.close();
      } catch (err) {
        logger.warn(`[${this.clientName}] Error closing client`, { err });
      } finally {
        this.transport = null;
      }
    }
  }

  public getTools(): Tool[] {
    return this.tools;
  }

  /**
   * 执行工具调用并返回结果 Parts
   */
  public async executeTools(
    name: string,
    args?: Recordable,
  ): Promise<StandardizedFunctionResponse<Awaited<ReturnType<Client['callTool']>>>> {
    if (!this.transport) {
      throw new AppError(`[${this.clientName}] Cannot execute tools: Client is disconnected.`);
    }

    try {
      const toolResult = await this.mcp.callTool({ name, arguments: args }, CallToolResultSchema, this.requestOptions);
      logger.debug(`Tool executed: ${name}`);
      return {
        response: { output: toolResult },
      };
    } catch (err) {
      logger.error(`Tool execution failed: ${name}`, { err });
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
      logger.debug(`[${serverName}] Connecting via Streamable HTTP...`);
      this.transport = new StreamableHTTPClientTransport(serverUrl, { ...requestInit });
      await this.mcp.connect(this.transport as Transport, this.requestOptions);
    } catch (err) {
      logger.warn(`[${serverName}] HTTP failed, trying SSE...`, { err });
      this.transport = new SSEClientTransport(serverUrl, { ...requestInit });
      await this.mcp.connect(this.transport, this.requestOptions);
    }
    logger.debug(`[${serverName}] Connected.`);
  }

  private async connectLocalServer(
    serverName: string,
    command: string,
    options: Omit<StdioServerParameters, 'command'> = {},
  ): Promise<void> {
    logger.debug(`[${serverName}] Connecting via Stdio...`);
    this.transport = new StdioClientTransport({ command, ...options });
    await this.mcp.connect(this.transport, this.requestOptions);
    logger.debug(`[${serverName}] Connected.`);
  }

  /**
   * 获取并格式化工具列表以供 Gemini 使用
   */
  private async refreshTools(): Promise<void> {
    const toolsResult = await this.mcp.listTools();
    const declarations: FunctionDeclaration[] = toolsResult.tools.map(
      (tool): FunctionDeclaration => ({
        name: tool.name,
        ...(tool.description && { description: tool.description }),
        parameters: {
          type: Type.OBJECT,
          ...(tool.inputSchema.properties && { properties: tool.inputSchema.properties }),
          ...(tool.inputSchema.required && { required: tool.inputSchema.required }),
        },
      }),
    );

    this.tools = [{ functionDeclarations: declarations }];
    logger.debug('Tools refreshed:', { tools: declarations.map((d) => d.name) });
  }

  /**
   * 解析配置中的环境变量占位符
   */
  private resolvePlaceholders(obj: Recordable<string>): Recordable<string> {
    const resolvedObj: Recordable<string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolvedObj[key] = value.replace(/\$\{(.*?)\}/g, (match, varName) => {
          const envVar = config[varName as keyof Config];
          if (envVar) return String(envVar);
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
