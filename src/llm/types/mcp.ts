import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Recordable } from '@shared/types/common';

interface RemoteServer {
  type: 'http';
  url: string;
  headers?: Recordable<string>;
}

interface LocalServer extends StdioServerParameters {
  type: 'stdio';
}

export type ServerConfig = RemoteServer | LocalServer;

export type McpServer = Recordable<ServerConfig>;
