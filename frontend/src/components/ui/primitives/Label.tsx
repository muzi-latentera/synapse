import { type LabelHTMLAttributes, type Ref } from 'react';
import { cn } from '@/utils/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  ref?: Ref<HTMLLabelElement>;
  requiredIndicator?: boolean;
}

export function Label({
  ref,
  className,
  children,
  requiredIndicator = false,
  ...props
}: LabelProps) {
  return (
    <label
      ref={ref}
      className={cn(
        'flex items-center gap-2 text-sm font-medium text-text-primary dark:text-text-dark-primary',
        className,
      )}
      {...props}
    >
      {children}
      {requiredIndicator ? <span className="text-error-500">*</span> : null}
    </label>
  );
}
