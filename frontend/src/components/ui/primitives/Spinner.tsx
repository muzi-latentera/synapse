import { type HTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function Spinner({ ref, size = 'md', className, ...props }: SpinnerProps) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        'inline-flex rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin',
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
