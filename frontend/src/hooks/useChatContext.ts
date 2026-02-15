import { use } from 'react';
import { ChatContext } from '@/contexts/ChatContextDefinition';

const EMPTY: never[] = [];

export function useChatContext() {
  const context = use(ChatContext);
  return (
    context ?? {
      chatId: undefined,
      sandboxId: undefined,
      fileStructure: EMPTY,
      customAgents: EMPTY,
      customSlashCommands: EMPTY,
      customPrompts: EMPTY,
    }
  );
}
