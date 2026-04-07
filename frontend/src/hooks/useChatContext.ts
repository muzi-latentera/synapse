import { use } from 'react';
import { ChatContext } from '@/contexts/ChatContextDefinition';

const EMPTY: never[] = [];

export function useChatContext() {
  const context = use(ChatContext);
  return (
    context ?? {
      chatId: undefined,
      sandboxId: undefined,
      parentChatId: undefined,
      fileStructure: EMPTY,
      customSkills: EMPTY,
      personas: EMPTY,
    }
  );
}
