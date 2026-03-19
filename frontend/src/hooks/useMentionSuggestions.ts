import { useCallback, useDeferredValue, useMemo, useRef } from 'react';
import type { FileStructure } from '@/types/file-system.types';
import type { CustomAgent } from '@/types/user.types';
import type { MentionItem } from '@/types/ui.types';
import { useSuggestionBase } from './useSuggestionBase';
import { traverseFileStructure, getFileName } from '@/utils/file';
import { parseMentionQuery } from '@/utils/mentionParser';
import { fuzzySearch } from '@/utils/fuzzySearch';

interface UseMentionOptions {
  message: string;
  cursorPosition: number;
  fileStructure: FileStructure[];
  customAgents: CustomAgent[];
  onSelect: (item: MentionItem, mentionStartPos: number, mentionEndPos: number) => void;
}

const convertFilesToMentions = (files: FileStructure[]): MentionItem[] => {
  return traverseFileStructure(files, (item) => {
    if (item.type === 'file') {
      return {
        type: 'file' as const,
        name: getFileName(item.path),
        path: item.path,
      };
    }
    return null;
  });
};

const convertAgentsToMentions = (agents: CustomAgent[]): MentionItem[] => {
  return agents.map((agent) => ({
    type: 'agent' as const,
    name: agent.name,
    path: `agent:${encodeURIComponent(agent.name)}`,
    description: agent.description,
  }));
};

export const useMentionSuggestions = ({
  message,
  cursorPosition,
  fileStructure,
  customAgents,
  onSelect,
}: UseMentionOptions) => {
  const allFiles = useMemo(() => convertFilesToMentions(fileStructure), [fileStructure]);
  const allAgents = useMemo(() => convertAgentsToMentions(customAgents), [customAgents]);

  const { isActive, query, mentionStartPos, mentionEndPos } = parseMentionQuery(
    message,
    cursorPosition,
  );

  const deferredQuery = useDeferredValue(query);

  const { filteredFiles, filteredAgents, allSuggestions } = useMemo(() => {
    if (!isActive) {
      return { filteredFiles: [], filteredAgents: [], allSuggestions: [] };
    }

    const files = fuzzySearch(deferredQuery, allFiles, { keys: ['name', 'path'], limit: 30 });
    const agents = fuzzySearch(deferredQuery, allAgents, {
      keys: ['name', 'description'],
      limit: 20,
    });

    return {
      filteredFiles: files,
      filteredAgents: agents,
      allSuggestions: [...agents, ...files],
    };
  }, [isActive, deferredQuery, allFiles, allAgents]);

  const hasSuggestions = allSuggestions.length > 0;

  const mentionStartPosRef = useRef(mentionStartPos);
  mentionStartPosRef.current = mentionStartPos;
  const mentionEndPosRef = useRef(mentionEndPos);
  mentionEndPosRef.current = mentionEndPos;

  const handleSelect = useCallback(
    (item: MentionItem) => {
      if (mentionStartPosRef.current === -1) return;
      onSelect(item, mentionStartPosRef.current, mentionEndPosRef.current);
    },
    [onSelect],
  );

  const { highlightedIndex, selectItem, handleKeyDown } = useSuggestionBase({
    suggestions: allSuggestions,
    hasSuggestions,
    onSelect: handleSelect,
  });

  return {
    filteredFiles,
    filteredAgents,
    allSuggestions,
    highlightedIndex,
    hasSuggestions,
    selectItem,
    handleKeyDown,
    isActive,
  } as const;
};
