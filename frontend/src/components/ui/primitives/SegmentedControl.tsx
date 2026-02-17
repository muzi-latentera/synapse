import { useRef, useLayoutEffect, useCallback, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    opacity: 0,
  });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeIndex = options.findIndex((o) => o.value === value);
    if (activeIndex < 0) {
      setIndicatorStyle({ opacity: 0 });
      return;
    }

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const activeButton = buttons[activeIndex];
    if (!activeButton) return;

    setIndicatorStyle({
      opacity: 1,
      width: activeButton.offsetWidth,
      transform: `translateX(${activeButton.offsetLeft}px)`,
    });
  }, [value, options]);

  useLayoutEffect(() => {
    updateIndicator();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex rounded-lg border border-border bg-surface-tertiary p-0.5 dark:border-border-dark dark:bg-surface-dark-secondary',
        className,
      )}
      role="radiogroup"
    >
      <span
        className="absolute left-0.5 top-0.5 h-[calc(100%-4px)] rounded-md bg-surface-secondary shadow-sm transition-[transform,width] duration-300 ease-out dark:bg-surface-dark-hover"
        style={indicatorStyle}
      />
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            className={cn(
              'relative z-10 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-quaternary/30',
              isActive
                ? 'text-text-primary dark:text-text-dark-primary'
                : 'text-text-quaternary hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary',
              option.disabled && 'cursor-not-allowed opacity-35',
            )}
          >
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
