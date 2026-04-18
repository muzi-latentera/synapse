import { memo, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SelectItemProps {
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
  role?: string;
}

function SelectItemInner({ isSelected, onSelect, className, children, role }: SelectItemProps) {
  // Rendered as a div (not a button) so renderItem can nest secondary interactive controls
  // like a favorite toggle — nesting interactive elements inside a <button> is invalid.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role={role}
      tabIndex={0}
      aria-selected={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-quaternary/30',
        isSelected
          ? 'bg-surface-hover/80 dark:bg-surface-dark-hover/80'
          : 'hover:bg-surface-hover/50 active:bg-surface-hover/70 dark:hover:bg-surface-dark-hover/50 dark:active:bg-surface-dark-hover/70',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const SelectItem = memo(SelectItemInner);
