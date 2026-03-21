import { memo, useMemo } from 'react';
import { SuggestionPanel } from './SuggestionPanel';
import { MentionIcon } from './MentionIcon';
import type { MentionItem } from '@/types/ui.types';

interface MentionSuggestionsPanelProps {
  files: MentionItem[];
  agents: MentionItem[];
  highlightedIndex: number;
  onSelect: (item: MentionItem) => void;
}

function renderAgent(agent: MentionItem, isActive: boolean) {
  return (
    <>
      <MentionIcon type="agent" name={agent.name} className="h-4 w-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-xs font-medium leading-tight ${
            isActive
              ? 'text-text-primary dark:text-text-dark-primary'
              : 'text-text-secondary dark:text-text-dark-secondary'
          }`}
        >
          {agent.name}
        </span>
        {agent.description && (
          <span className="truncate text-2xs leading-tight text-text-tertiary dark:text-text-dark-tertiary">
            {agent.description}
          </span>
        )}
      </div>
    </>
  );
}

function renderFile(file: MentionItem, isActive: boolean) {
  return (
    <>
      <MentionIcon type="file" name={file.name} className="h-4 w-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`font-mono text-xs leading-tight ${
            isActive
              ? 'text-text-primary dark:text-text-dark-primary'
              : 'text-text-secondary dark:text-text-dark-secondary'
          }`}
        >
          {file.name}
        </span>
        <span className="truncate text-2xs leading-tight text-text-tertiary dark:text-text-dark-tertiary">
          {file.path}
        </span>
      </div>
    </>
  );
}

const agentItemKey = (item: MentionItem) => item.path;
const fileItemKey = (item: MentionItem) => item.path;

export const MentionSuggestionsPanel = memo(function MentionSuggestionsPanel({
  files,
  agents,
  highlightedIndex,
  onSelect,
}: MentionSuggestionsPanelProps) {
  const sections = useMemo(
    () => [
      {
        label: 'Agents',
        items: agents,
        itemKey: agentItemKey,
        renderItem: renderAgent,
      },
      {
        label: 'Files',
        items: files,
        itemKey: fileItemKey,
        renderItem: renderFile,
      },
    ],
    [agents, files],
  );

  return (
    <SuggestionPanel sections={sections} highlightedIndex={highlightedIndex} onSelect={onSelect} />
  );
});
