import type { GeneralFunctionSchema, StandardizedFunctionResponse } from '@llm/types/agent.js';
import type { LoadedMcpServer, McpServer, McpServerConfig } from '@llm/types/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import type { JSONSchema } from '@shared/types/schema.js';
import { ms } from '@shared/utils/helpers.js';
import { loadData } from '@storage/data-load.js';

/**
 * Internal state interface for a single MCP server instance.
 */
interface ServerInstanceState {
  name: string;
  config: McpServerConfig;
  client: Client;
  transport: Transport | null;
  tools: GeneralFunctionSchema[];
  activeConnections: number;
}

const REQUEST_OPTIONS: RequestOptions = { timeout: ms.min(5) };

export class McpClient {
  // Registry to hold state for all configured servers
  private registry = new Map<string, ServerInstanceState>();

  // Maps specific tool names to server names for quick lookups (optional, but useful)
  private toolsToServerMap = new Map<Set<string>, string>();

  private readonly configPath: string;

  constructor(mcpServerConfigPath: string) {
    this.configPath = mcpServerConfigPath;
  }

  /**
   * Initializes the MCP Client Manager.
   * 1. Loads configuration.
   * 2. Registers all servers.
   * 3. Performs initial connection to fetch and cache tools.
   * 4. Disconnects to save resources until needed.
   */
  public async discoverMcpServers() {
    logger.info('[McpClient] Initializing MCP Server Registry...');

    // Load configuration
    const configData = await loadData<{ mcpServers: McpServer }>(this.configPath, 'json');
    const serversConfig = configData.mcpServers;

    // Clear existing registry if re-initializing
    this.registry.clear();
    this.toolsToServerMap.clear();

    // Initialize each server
    for (const [name, config] of Object.entries(serversConfig)) {
      this.registerServer(name, config);
    }

    // Perform initial discovery (Connect -> Fetch Tools -> Disconnect)
    const discoveryPromises = [...this.registry.keys()].map(async (serverName) => {
      try {
        await this.connect(serverName);
        await this.refreshTools(serverName);
      } catch (error) {
        logger.error(`[McpClient] Failed to discover tools for server: ${serverName}`, { error });
      } finally {
        await this.disconnect(serverName);
      }
    });

    await Promise.allSettled(discoveryPromises);
    logger.info(`[McpClient] Initialization complete. Managed Servers: ${this.registry.size}`);
  }

  /**
   * Returns a list of loaded server summaries.
   */
  public getLoadedServers(): LoadedMcpServer[] {
    return [...this.registry.values()].map(
      (state): LoadedMcpServer => ({
        name: state.name,
        description: state.config.description,
        tools: state.tools.map((tool) => ({
          name: tool.name,
          ...(tool.description && { description: tool.description }),
        })),
      }),
    );
  }

  /**
   * Retrieves cached tools for a specific server.
   */
  public getTools(serverName: string): GeneralFunctionSchema[] {
    const state = this.registry.get(serverName);
    if (!state) {
      logger.warn(`[McpClient] Request for tools from unknown server: ${serverName}`);
      throw new McpError(`[McpClient] Server not found: ${serverName}`);
    }
    return state.tools;
  }

  /**
   * Executes a tool on a specific server.
   * Handles connection lifecycle (Connect -> Execute -> Disconnect).
   */
  public async callTool(
    toolName: string,
    args?: Recordable,
  ): Promise<StandardizedFunctionResponse<Awaited<ReturnType<Client['callTool']>>>> {
    let serverName: string | undefined;
    for (const [toolNames, name] of this.toolsToServerMap) {
      if (toolNames.has(toolName)) {
        serverName = name;
        break;
      }
    }

    if (!serverName) {
      throw new McpError(`[McpClient] Tool not found: ${toolName}`);
    }

    const state = this.registry.get(serverName);
    if (!state) {
      throw new McpError(`[McpClient] Server not found: ${serverName}`);
    }

    const startTime = Date.now();

    // Lifecycle: Connect
    await this.connect(serverName);

    try {
      logger.debug(`[${serverName}] Executing tool: ${toolName}`, { args });

      const toolResult = await state.client.callTool(
        { name: toolName, arguments: args },
        CallToolResultSchema,
        REQUEST_OPTIONS,
      );

      logger.debug(`[${serverName}] Tool executed successfully`, {
        tool: toolName,
        duration: `${Date.now() - startTime}ms`,
      });

      if (Array.isArray(toolResult.content)) {
        (toolResult.content as { text?: string }[]).forEach((c) => {
          if (c.text) {
            c.text =
              c.text.length > 50_000 * 4
                ? c.text.slice(0, 20_000 * 4) + '...(Tool result too long, truncated)'
                : c.text;
          }
        });
      }

      return {
        response: { output: toolResult },
      };
    } catch (err) {
      logger.warn(`[${serverName}] Tool execution failed: ${toolName}`, {
        duration: `${Date.now() - startTime}ms`,
        error: err,
      });
      return {
        response: {
          error: err instanceof Error ? err.message : String(err),
        },
      };
    } finally {
      // Lifecycle: Disconnect
      await this.disconnect(serverName);
    }
  }

  /**
   * Internal: Registers a server configuration and initializes its Client instance.
   */
  private registerServer(name: string, config: McpServerConfig): void {
    const client = new Client({ name: `${name}-client`, version: '1.0.0' });

    const state: ServerInstanceState = {
      name,
      config,
      client,
      transport: null,
      tools: [],
      activeConnections: 0,
    };

    this.registry.set(name, state);
  }

  /**
   * Internal: Establishes a connection to a specific server.
   * Uses reference counting to reuse existing connections.
   */
  private async connect(serverName: string): Promise<void> {
    const state = this.registry.get(serverName);
    if (!state) throw new McpError(`Server ${serverName} not found`);

    state.activeConnections++;

    if (state.transport) {
      logger.trace(`[${serverName}] Reusing existing connection (Active Users: ${state.activeConnections})`);
      return;
    }

    logger.info(`[${serverName}] Establishing connection...`);

    try {
      if (state.config.type === 'http') {
        const { url, headers } = state.config;
        const resolvedHeaders = headers ? this.resolvePlaceholders(headers) : undefined;
        await this.connectRemoteServer(state, url, resolvedHeaders);
      } else {
        const { type, description, command, ...options } = state.config;
        await this.connectLocalServer(state, command, options);
      }
    } catch (err) {
      state.activeConnections--; // Revert count on failure
      state.transport = null;
      logger.error(`[${serverName}] Connection failed`, { err });
      throw err;
    }
  }

  /**
   * Internal: Disconnects from a server.
   * Only closes the physical transport if active users drops to 0.
   */
  private async disconnect(serverName: string): Promise<void> {
    const state = this.registry.get(serverName);
    if (!state) return;

    if (state.activeConnections > 0) {
      state.activeConnections--;
    }

    logger.trace(`[${serverName}] Release requested. Remaining users: ${state.activeConnections}`);

    if (state.activeConnections === 0 && state.transport) {
      logger.info(`[${serverName}] No active users. Closing transport.`);
      try {
        await state.client.close();
      } catch (err) {
        logger.warn(`[${serverName}] Error closing client`, { err });
      } finally {
        state.transport = null;
      }
    }
  }

  /**
   * Internal: Fetches tools from the server and updates the cache.
   */
  private async refreshTools(serverName: string): Promise<void> {
    const state = this.registry.get(serverName);
    if (!state?.transport) return;

    try {
      const toolsResult = await state.client.listTools();
      state.tools = toolsResult.tools.map(
        (tool): GeneralFunctionSchema => ({
          name: tool.name,
          ...(tool.description && { description: tool.description }),
          parametersJsonSchema: tool.inputSchema as JSONSchema,
        }),
      );

      const toolNames = new Set(state.tools.map((tool) => tool.name));
      this.toolsToServerMap.set(toolNames, serverName);

      logger.info(`[${serverName}] Tools refreshed: ${state.tools.length} tools found.`);
    } catch (err) {
      logger.error(`[${serverName}] Failed to list tools`, { err });
      throw err;
    }
  }

  /**
   * Internal: Connect logic for HTTP/SSE servers.
   */
  private async connectRemoteServer(
    state: ServerInstanceState,
    url: string,
    headers?: RequestInit['headers'],
  ): Promise<void> {
    const serverUrl = new URL(url);
    const requestInit = headers && { requestInit: { headers } };

    try {
      logger.debug(`[${state.name}] Attempting Streamable HTTP...`);
      state.transport = new StreamableHTTPClientTransport(serverUrl, { ...requestInit }) as Transport;
      await state.client.connect(state.transport, REQUEST_OPTIONS);
    } catch (err) {
      logger.warn(`[${state.name}] HTTP Stream failed, falling back to SSE`, { err });
      state.transport = new SSEClientTransport(serverUrl, { ...requestInit });
      await state.client.connect(state.transport, REQUEST_OPTIONS);
    }

    logger.info(`[${state.name}] Remote connection established`, { url });
  }

  /**
   * Internal: Connect logic for Local Stdio servers.
   */
  private async connectLocalServer(
    state: ServerInstanceState,
    command: string,
    options: Omit<StdioServerParameters, 'command'> = {},
  ): Promise<void> {
    logger.debug(`[${state.name}] Spawning Stdio process: ${command}`);

    state.transport = new StdioClientTransport({
      command,
      ...options,
    });

    await state.client.connect(state.transport, REQUEST_OPTIONS);

    logger.info(`[${state.name}] Local server connected (PID: Active)`);
  }

  /**
   * Internal: Resolves environment variable placeholders in configuration strings.
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
