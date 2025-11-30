import { config } from '@/services';
import type { MCPServers } from '@/types';

export const mcpServers: MCPServers = {
  github_toolset: {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/x/all/readonly',
    headers: {
      Authorization: 'Bearer ${githubToken}',
    },
  },
  local_rag: {
    type: 'local',
    command: config.nodeEnv === 'production' ? '/app/node_modules/.bin/mcp-local-rag' : 'pnpm',
    args: config.nodeEnv === 'production' ? [] : ['exec', 'mcp-local-rag'],
    env: {
      BASE_DIR: '/data/mcp-local-rag/Documents',
      DB_PATH: '/data/mcp-local-rag/lancedb',
      CACHE_DIR: '/data/mcp-local-rag/models',
      MODEL_NAME: 'jinaai/jina-embeddings-v2-base-zh',
      CHUNK_SIZE: '2048',
      CHUNK_OVERLAP: '256',
    },
  },
};
