import { memo, useState, useCallback } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useSubThreadsQuery } from '@/hooks/queries/useChatQueries';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/utils/cn';
import type { Chat } from '@/types/chat.types';

interface SubThreadListProps {
  parentChatId: string;
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  onDropdownClick: (e: React.MouseEvent<HTMLButtonElement>, chat: Chat) => void;
  streamingChatIdSet: Set<string>;
}

export const SubThreadList = memo(function SubThreadList({
  parentChatId,
  selectedChatId,
  onSelect,
  onDropdownClick,
  streamingChatIdSet,
}: SubThreadListProps) {
  const { data: subThreads, isLoading, isError, refetch } = useSubThreadsQuery(parentChatId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleMouseEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  if (isLoading || (!subThreads && !isError)) return null;

  if (isError) {
    return (
      <div className="ml-4 border-l border-border/30 px-2 py-1 dark:border-border-dark/30">
        <button
          type="button"
          onClick={() => refetch()}
          className="text-2xs text-text-quaternary transition-colors duration-200 hover:text-text-tertiary dark:text-text-dark-quaternary dark:hover:text-text-dark-tertiary"
        >
          Failed to load · Retry
        </button>
      </div>
    );
  }

  if (!subThreads || subThreads.length === 0) return null;

  return (
    <div className="ml-4 border-l border-border/30 dark:border-border-dark/30">
      {subThreads.map((thread) => {
        const isSelected = thread.id === selectedChatId;
        const isStreaming = streamingChatIdSet.has(thread.id);
        const isHovered = hoveredId === thread.id;

        return (
          <div
            key={thread.id}
            className="group relative flex items-center"
            onMouseEnter={() => handleMouseEnter(thread.id)}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-r-md py-1 pl-2 pr-6 transition-colors duration-200',
                isSelected
                  ? 'bg-surface-hover text-text-primary dark:bg-surface-dark-hover dark:text-text-dark-primary'
                  : 'text-text-secondary hover:bg-surface-hover dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover',
              )}
            >
              <span className="truncate text-xs">{thread.title}</span>
              {isStreaming && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-text-quaternary dark:text-text-dark-quaternary" />
              )}
            </button>
            <Button
              onClick={(e) => onDropdownClick(e, thread)}
              onMouseDown={(e) => e.stopPropagation()}
              variant="unstyled"
              className={cn(
                'absolute right-1 flex-shrink-0 rounded-md p-1 transition-all duration-200',
                'text-text-quaternary dark:text-text-dark-quaternary',
                'hover:text-text-primary dark:hover:text-text-dark-primary',
                isHovered || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
              aria-label="Sub-thread options"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
});
