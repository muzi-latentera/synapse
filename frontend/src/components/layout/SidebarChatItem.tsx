import { memo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/utils/cn';
import { stripMarkdownTitle } from '@/utils/format';
import { getRelativeTime } from '@/utils/date';
import type { Chat } from '@/types/chat.types';

interface SidebarChatItemProps {
  chat: Chat;
  isSelected: boolean;
  isHovered: boolean;
  isDropdownOpen: boolean;
  isChatStreaming: boolean;
  onSelect: (chatId: string) => void;
  onDropdownClick: (e: React.MouseEvent<HTMLButtonElement>, chat: Chat) => void;
  onMouseEnter: (chatId: string) => void;
  onMouseLeave: () => void;
}

export const SidebarChatItem = memo(function SidebarChatItem({
  chat,
  isSelected,
  isHovered,
  isDropdownOpen,
  isChatStreaming,
  onSelect,
  onDropdownClick,
  onMouseEnter,
  onMouseLeave,
}: SidebarChatItemProps) {
  return (
    <div
      className={cn(
        'group relative -mx-2 flex items-center gap-[11px] rounded-lg px-2 py-[7px] transition-colors duration-200',
        isSelected
          ? 'bg-surface-hover/50 text-text-primary dark:bg-surface-dark-hover/50 dark:text-text-dark-primary'
          : 'text-text-secondary hover:bg-surface-hover/50 hover:text-text-primary dark:text-text-dark-tertiary dark:hover:bg-surface-dark-hover/50 dark:hover:text-text-dark-secondary',
      )}
      onMouseEnter={() => onMouseEnter(chat.id)}
      onMouseLeave={onMouseLeave}
    >
      {isSelected && !isChatStreaming && (
        <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-text-primary dark:bg-text-dark-primary" />
      )}

      {isChatStreaming ? (
        <div className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-warning-500" />
      ) : (
        <div className="h-1.5 w-1.5 flex-shrink-0" />
      )}

      <Button
        onClick={() => onSelect(chat.id)}
        aria-current={isSelected ? 'page' : undefined}
        variant="unstyled"
        title={chat.title}
        className="min-w-0 flex-1 truncate pr-10 text-left text-[13px]"
      >
        <span className={cn('truncate', isSelected && 'font-medium')}>
          {stripMarkdownTitle(chat.title)}
        </span>
      </Button>

      <span
        className={cn(
          'absolute right-2 text-[10px] tabular-nums text-text-quaternary dark:text-text-dark-quaternary',
          'transition-opacity duration-200',
          isHovered || isSelected || isDropdownOpen ? 'opacity-0' : 'opacity-100',
        )}
      >
        {getRelativeTime(chat.updated_at)}
      </span>

      <Button
        onClick={(e) => onDropdownClick(e, chat)}
        onMouseDown={(e) => e.stopPropagation()}
        variant="unstyled"
        className={cn(
          'absolute right-2 flex-shrink-0 rounded-md p-0.5 transition-all duration-200',
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
