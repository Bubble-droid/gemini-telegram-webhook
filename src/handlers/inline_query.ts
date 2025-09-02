// src/handlers/inline_query.ts

import { Log } from '@/services';
import type { InlineQuery } from '@/types';

export const handleInlineQuery = async (inlineQuery: InlineQuery): Promise<void> => {
  if (!inlineQuery.query && inlineQuery.chat_type === 'private') {
    Log.info('Invalid inline query', { queryId: inlineQuery.id });
    return;
  }
  const { id, from, query: queryText } = inlineQuery;
  Log.info('Handling inline query', { queryId: id, userId: from.id, queryText });
  return;
};
