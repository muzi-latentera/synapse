import { type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';
import { baseInputClasses, inputErrorClasses } from './inputStyles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  hasError?: boolean;
  variant?: 'default' | 'unstyled';
}

export function Input({
  ref,
  className,
  type = 'text',
  hasError = false,
  disabled,
  variant = 'default',
  ...props
}: InputProps) {
  if (variant === 'unstyled') {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-quaternary/30 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        disabled={disabled}
        {...props}
      />
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      className={cn('h-10 w-full', baseInputClasses, hasError && inputErrorClasses, className)}
      disabled={disabled}
      {...props}
    />
  );
}
