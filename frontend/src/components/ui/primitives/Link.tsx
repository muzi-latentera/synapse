import { type AnchorHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ref?: Ref<HTMLAnchorElement>;
  variant?: 'default' | 'unstyled';
}

export function Link({ ref, className, variant = 'default', ...props }: LinkProps) {
  if (variant === 'unstyled') {
    return (
      <a
        ref={ref}
        className={cn(
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-quaternary/30',
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <a
      ref={ref}
      className={cn(
        'text-text-primary underline transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-quaternary/30 dark:text-text-dark-primary dark:hover:text-text-dark-secondary',
        className,
      )}
      {...props}
    />
  );
}
