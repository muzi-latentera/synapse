import { memo, ReactNode } from 'react';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/utils/cn';

interface SelectItemProps {
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
  role?: string;
}

function SelectItemInner({ isSelected, onSelect, className, children, role }: SelectItemProps) {
  return (
    <Button
      onClick={onSelect}
      variant="unstyled"
      role={role}
      className={cn(
        'w-full rounded-lg px-2 py-1.5 text-left transition-colors duration-150',
        isSelected
          ? 'bg-surface-hover/80 dark:bg-surface-dark-hover/80'
          : 'hover:bg-surface-hover/50 active:bg-surface-hover/70 dark:hover:bg-surface-dark-hover/50 dark:active:bg-surface-dark-hover/70',
        className,
      )}
    >
      {children}
    </Button>
  );
}

export const SelectItem = memo(SelectItemInner);
