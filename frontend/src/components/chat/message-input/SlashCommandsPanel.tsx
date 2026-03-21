import { memo, useMemo } from 'react';
import { SuggestionPanel } from './SuggestionPanel';
import type { SlashCommand } from '@/types/ui.types';

interface SlashCommandsPanelProps {
  suggestions: SlashCommand[];
  highlightedIndex: number;
  onSelect: (command: SlashCommand) => void;
}

function renderCommand(command: SlashCommand, isActive: boolean) {
  return (
    <>
      <span
        className={`flex-shrink-0 font-mono text-xs leading-tight ${
          isActive
            ? 'text-text-primary dark:text-text-dark-primary'
            : 'text-text-secondary dark:text-text-dark-secondary'
        }`}
      >
        {command.value}
      </span>
      {command.description && (
        <span className="min-w-0 text-2xs leading-tight text-text-tertiary dark:text-text-dark-tertiary">
          {command.description}
        </span>
      )}
    </>
  );
}

const commandItemKey = (command: SlashCommand) => command.value;

export const SlashCommandsPanel = memo(function SlashCommandsPanel({
  suggestions,
  highlightedIndex,
  onSelect,
}: SlashCommandsPanelProps) {
  const sections = useMemo(
    () => [
      {
        items: suggestions,
        itemKey: commandItemKey,
        itemClassName: 'gap-6 px-3 py-1',
        renderItem: renderCommand,
      },
    ],
    [suggestions],
  );

  return (
    <SuggestionPanel sections={sections} highlightedIndex={highlightedIndex} onSelect={onSelect} />
  );
});
