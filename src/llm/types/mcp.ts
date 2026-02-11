import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Recordable } from '@shared/types/common.js';
import type { GeneralFunctionSchema } from './agent.js';

interface BaseServer {
  description: string;
}

interface RemoteServer extends BaseServer {
  type: 'http';
  url: string;
  headers?: Recordable<string>;
}

interface LocalServer extends BaseServer, StdioServerParameters {
  type: 'local';
}

export type McpServerConfig = RemoteServer | LocalServer;
export type McpServer = Recordable<McpServerConfig>;

export interface LoadedMcpServer extends BaseServer {
  name: string;
  tools: Omit<GeneralFunctionSchema, 'parametersJsonSchema'>[];
}
