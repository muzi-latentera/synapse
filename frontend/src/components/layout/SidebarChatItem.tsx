import { memo } from 'react';
import { ChevronRight, MoreHorizontal, Loader2, Pin } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/utils/cn';
import type { Chat } from '@/types/chat.types';

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

interface SidebarChatItemProps {
  chat: Chat;
  isSelected: boolean;
  isHovered: boolean;
  isDropdownOpen: boolean;
  isChatStreaming: boolean;
  isSubThreadsExpanded?: boolean;
  onSelect: (chatId: string) => void;
  onDropdownClick: (e: React.MouseEvent<HTMLButtonElement>, chat: Chat) => void;
  onMouseEnter: (chatId: string) => void;
  onMouseLeave: () => void;
  onToggleSubThreads?: (chatId: string) => void;
}

export const SidebarChatItem = memo(function SidebarChatItem({
  chat,
  isSelected,
  isHovered,
  isDropdownOpen,
  isChatStreaming,
  isSubThreadsExpanded,
  onSelect,
  onDropdownClick,
  onMouseEnter,
  onMouseLeave,
  onToggleSubThreads,
}: SidebarChatItemProps) {
  const isPinned = !!chat.pinned_at;
  const hasSubThreads = (chat.sub_thread_count ?? 0) > 0;

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-2.5 py-1.5 transition-colors duration-200',
        isSelected
          ? 'bg-surface-hover text-text-primary dark:bg-surface-dark-hover dark:text-text-dark-primary'
          : 'text-text-secondary hover:bg-surface-hover/50 hover:text-text-primary dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover/50 dark:hover:text-text-dark-secondary',
      )}
      onMouseEnter={() => onMouseEnter(chat.id)}
      onMouseLeave={onMouseLeave}
    >
      <Button
        onClick={() => onSelect(chat.id)}
        aria-current={isSelected ? 'page' : undefined}
        variant="unstyled"
        className="flex min-w-0 flex-1 items-center text-left text-xs"
      >
        {isChatStreaming && (
          <Loader2 className="mr-2.5 h-3 w-3 flex-shrink-0 animate-spin text-text-tertiary dark:text-text-dark-tertiary" />
        )}
        {hasSubThreads && onToggleSubThreads && (
          <ChevronRight
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubThreads(chat.id);
            }}
            className={cn(
              '-ml-1.5 mr-0.5 h-3 w-3 flex-shrink-0 cursor-pointer text-text-quaternary transition-all duration-200 hover:text-text-primary dark:text-text-dark-quaternary dark:hover:text-text-dark-primary',
              isSubThreadsExpanded && 'rotate-90',
            )}
          />
        )}
        <span className="flex-1 truncate">{chat.title}</span>
        {isPinned && (
          <Pin className="h-2.5 w-2.5 flex-shrink-0 text-text-quaternary dark:text-text-dark-quaternary" />
        )}
        <span
          className={cn(
            'flex-shrink-0 text-2xs tabular-nums text-text-quaternary dark:text-text-dark-quaternary',
            'transition-opacity duration-200',
            isHovered || isSelected || isDropdownOpen ? 'opacity-0' : 'opacity-100',
          )}
        >
          {getRelativeTime(chat.updated_at || chat.created_at)}
        </span>
      </Button>

      <Button
        onClick={(e) => onDropdownClick(e, chat)}
        onMouseDown={(e) => e.stopPropagation()}
        variant="unstyled"
        className={cn(
          'absolute right-1 flex-shrink-0 rounded-md p-1 transition-all duration-200',
          'text-text-quaternary dark:text-text-dark-quaternary',
          'hover:text-text-primary dark:hover:text-text-dark-primary',
          isHovered || isSelected || isDropdownOpen
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100',
        )}
        aria-label="Chat options"
      >
        <MoreHorizontal className="h-3 w-3" />
      </Button>
    </div>
  );
});
