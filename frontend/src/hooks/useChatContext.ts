import { use } from 'react';
import { ChatContext } from '@/contexts/ChatContextDefinition';
import { EMPTY_BUILTIN_COMMANDS } from '@/config/constants';

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
      builtinSlashCommands: EMPTY_BUILTIN_COMMANDS,
      personas: EMPTY,
    }
  );
}
