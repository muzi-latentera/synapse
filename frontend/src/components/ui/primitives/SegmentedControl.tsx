import { useRef, useLayoutEffect, useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

type SegmentSize = 'sm' | 'md';

const SIZE_CLASSES: Record<SegmentSize, { container: string; indicator: string; button: string }> =
  {
    sm: {
      container: 'rounded-md',
      indicator: 'rounded-[5px]',
      button: 'rounded-[5px] px-2.5 py-1 text-2xs',
    },
    md: {
      container: 'rounded-lg',
      indicator: 'rounded-[7px]',
      button: 'rounded-[7px] px-3.5 py-1.5 text-xs',
    },
  };

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentSize;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
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
      height: activeButton.offsetHeight,
      transform: `translate(${activeButton.offsetLeft}px, ${activeButton.offsetTop}px)`,
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

  const enabledIndices = useMemo(
    () =>
      options.reduce<number[]>((acc, o, i) => {
        if (!o.disabled) acc.push(i);
        return acc;
      }, []),
    [options],
  );

  // Roving tabindex: arrow keys move focus+selection, only active item is tabbable
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const pos = enabledIndices.indexOf(currentIndex);
      if (pos < 0) return;

      let nextIndex: number | undefined;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = enabledIndices[(pos + 1) % enabledIndices.length];
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length];
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = enabledIndices[0];
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = enabledIndices[enabledIndices.length - 1];
      }

      if (nextIndex != null) {
        onChange(options[nextIndex].value);
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [enabledIndices, options, onChange],
  );

  // Active option if enabled, otherwise first enabled option — ensures at least
  // one button stays tabbable even when value is stale or the selected option is disabled
  const activeIdx = options.findIndex((o) => o.value === value && !o.disabled);
  const tabbableIdx = activeIdx >= 0 ? activeIdx : options.findIndex((o) => !o.disabled);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex border border-border bg-surface-tertiary dark:border-border-dark dark:bg-surface-dark-secondary',
        SIZE_CLASSES[size].container,
        className,
      )}
      role="radiogroup"
    >
      <span
        className={cn(
          'absolute left-0 top-0 bg-surface-secondary shadow-sm transition-[transform,width,height] duration-300 ease-out dark:bg-surface-dark-hover',
          SIZE_CLASSES[size].indicator,
        )}
        style={indicatorStyle}
      />
      {options.map((option, index) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={index === tabbableIdx ? 0 : -1}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative z-10 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-quaternary/30',
              SIZE_CLASSES[size].button,
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
