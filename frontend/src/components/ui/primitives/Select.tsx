import { type SelectHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
  hasError?: boolean;
}

export function Select({
  ref,
  className,
  hasError = false,
  disabled,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-lg border border-border bg-surface-tertiary px-3 pr-9 text-sm text-text-primary transition-[color,border-color,box-shadow] duration-200 hover:border-border-hover focus-visible:border-border-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-quaternary/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:hover:border-border-dark-hover dark:focus-visible:border-border-dark-hover',
          hasError &&
            'border-error-500/60 text-error-700 focus-visible:border-error-500 focus-visible:ring-error-500/20 dark:border-error-500/40 dark:text-error-200',
          className,
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-quaternary dark:text-text-dark-quaternary">
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
