import { type ReactNode, useMemo } from 'react';
import type { FileStructure } from '@/types/file-system.types';
import type { CustomSkill, Persona } from '@/types/user.types';
import { ChatContext } from './ChatContextDefinition';

const EMPTY_FILES: FileStructure[] = [];
const EMPTY_SKILLS: CustomSkill[] = [];
const EMPTY_PERSONAS: Persona[] = [];

interface ChatProviderProps {
  chatId?: string;
  sandboxId?: string;
  parentChatId?: string;
  fileStructure?: FileStructure[];
  customSkills?: CustomSkill[];
  personas?: Persona[];
  children: ReactNode;
}

export function ChatProvider({
  chatId,
  sandboxId,
  parentChatId,
  fileStructure = EMPTY_FILES,
  customSkills = EMPTY_SKILLS,
  personas = EMPTY_PERSONAS,
  children,
}: ChatProviderProps) {
  const value = useMemo(
    () => ({
      chatId,
      sandboxId,
      parentChatId,
      fileStructure,
      customSkills,
      personas,
    }),
    [chatId, sandboxId, parentChatId, fileStructure, customSkills, personas],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
