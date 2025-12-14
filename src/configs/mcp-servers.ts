import type { McpServer } from '@/types';

export const mcpServers = {
  'github-toolset': {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/x/all/readonly',
    headers: {
      Authorization: 'Bearer ${githubToken}',
    },
  },
} as const satisfies McpServer;
