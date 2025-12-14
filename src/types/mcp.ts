// src/types/mcp.d.ts

import type { mcpServers } from '@/configs';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';

interface RemoteServer {
  type: 'http';
  url: string;
  headers?: RequestInit['headers'];
}

interface LocalServer extends StdioServerParameters {
  type: 'local';
}

export type ServerConfig = RemoteServer | LocalServer;

export interface McpServer {
  [x: string]: ServerConfig;
}

export type ServerName = keyof typeof mcpServers;
