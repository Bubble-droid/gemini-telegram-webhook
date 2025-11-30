// src/types/mcp.d.ts

import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';

interface RemoteServer {
  type: 'http';
  url: string;
  headers?: RequestInit['headers'];
}

interface LocalServer extends StdioServerParameters {
  type: 'local';
}

export type MCPServerName = 'github_toolset' | 'local_rag';

export type MCPServerConfig = RemoteServer | LocalServer;

export type MCPServers = Record<MCPServerName, MCPServerConfig>;
