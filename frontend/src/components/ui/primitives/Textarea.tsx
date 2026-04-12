import { type TextareaHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';
import { baseInputClasses, inputErrorClasses } from './inputStyles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  hasError?: boolean;
  variant?: 'default' | 'unstyled';
}

export function Textarea({
  ref,
  className,
  hasError = false,
  disabled,
  variant = 'default',
  ...props
}: TextareaProps) {
  if (variant === 'unstyled') {
    return (
      <textarea
        ref={ref}
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
    <textarea
      ref={ref}
      className={cn(
        'min-h-32 w-full resize-y',
        baseInputClasses,
        hasError && inputErrorClasses,
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
