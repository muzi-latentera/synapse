import { memo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/primitives/Button';
import { MentionIcon } from './MentionIcon';
import type { MentionItem } from '@/types/ui.types';

interface MentionSuggestionsPanelProps {
  files: MentionItem[];
  agents: MentionItem[];
  highlightedIndex: number;
  onSelect: (item: MentionItem) => void;
}

export const MentionSuggestionsPanel = memo(function MentionSuggestionsPanel({
  files,
  agents,
  highlightedIndex,
  onSelect,
}: MentionSuggestionsPanelProps) {
  const mentionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const hasFiles = files.length > 0;
  const hasAgents = agents.length > 0;
  const hasSuggestions = hasFiles || hasAgents;

  useEffect(() => {
    if (highlightedIndex >= 0 && mentionRefs.current[highlightedIndex]) {
      mentionRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [highlightedIndex]);

  if (!hasSuggestions) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-40 mb-2">
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-sm dark:border-border-dark dark:bg-surface-dark">
        <div className="py-1" role="listbox">
          {hasAgents && (
            <>
              <div className="px-3 py-1 text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                Agents
              </div>
              {agents.map((agent, index) => {
                const isActive = index === highlightedIndex;
                return (
                  <Button
                    key={agent.path}
                    ref={(el) => {
                      mentionRefs.current[index] = el;
                    }}
                    type="button"
                    variant="unstyled"
                    role="option"
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                      isActive
                        ? 'bg-surface-active dark:bg-surface-dark-active'
                        : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover'
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(agent);
                    }}
                  >
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
                  </Button>
                );
              })}
            </>
          )}
          {hasFiles && (
            <>
              <div className="px-3 py-1 text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                Files
              </div>
              {files.map((file, index) => {
                const globalIndex = agents.length + index;
                const isActive = globalIndex === highlightedIndex;
                return (
                  <Button
                    key={file.path}
                    ref={(el) => {
                      mentionRefs.current[globalIndex] = el;
                    }}
                    type="button"
                    variant="unstyled"
                    role="option"
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                      isActive
                        ? 'bg-surface-active dark:bg-surface-dark-active'
                        : 'hover:bg-surface-hover dark:hover:bg-surface-dark-hover'
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(file);
                    }}
                  >
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
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
