import { createContext } from 'react';
import type { FileStructure } from '@/types/file-system.types';
import type { CustomSkill, Persona } from '@/types/user.types';

interface ChatContextValue {
  chatId: string | undefined;
  sandboxId: string | undefined;
  parentChatId: string | undefined;
  fileStructure: FileStructure[];
  customSkills: CustomSkill[];
  personas: Persona[];
}

export const ChatContext = createContext<ChatContextValue | null>(null);
