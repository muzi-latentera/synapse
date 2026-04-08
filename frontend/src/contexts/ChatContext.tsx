import { type ReactNode, useMemo } from 'react';
import type { FileStructure } from '@/types/file-system.types';
import type { CustomSkill, Persona } from '@/types/user.types';
import type { SlashCommand } from '@/types/ui.types';
import type { AgentKind } from '@/types/chat.types';
import { ChatContext } from './ChatContextDefinition';
import { EMPTY_BUILTIN_COMMANDS } from '@/config/constants';

const EMPTY_FILES: FileStructure[] = [];
const EMPTY_SKILLS: CustomSkill[] = [];
const EMPTY_PERSONAS: Persona[] = [];

interface ChatProviderProps {
  chatId?: string;
  sandboxId?: string;
  parentChatId?: string;
  fileStructure?: FileStructure[];
  customSkills?: CustomSkill[];
  builtinSlashCommands?: Record<AgentKind, SlashCommand[]>;
  personas?: Persona[];
  children: ReactNode;
}

export function ChatProvider({
  chatId,
  sandboxId,
  parentChatId,
  fileStructure = EMPTY_FILES,
  customSkills = EMPTY_SKILLS,
  builtinSlashCommands = EMPTY_BUILTIN_COMMANDS,
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
      builtinSlashCommands,
      personas,
    }),
    [chatId, sandboxId, parentChatId, fileStructure, customSkills, builtinSlashCommands, personas],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
