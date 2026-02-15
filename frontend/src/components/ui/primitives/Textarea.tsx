import { type TextareaHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';
import { baseInputClasses, inputErrorClasses } from './inputStyles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  hasError?: boolean;
}

export function Textarea({ ref, className, hasError = false, disabled, ...props }: TextareaProps) {
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
