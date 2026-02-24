import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type Ref,
} from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

const THIN_SCROLLBAR_STYLE: CSSProperties = { scrollbarWidth: 'thin' };

export interface TextareaProps {
  ref?: Ref<HTMLTextAreaElement>;
  message: string;
  setMessage: (value: string) => void;
  placeholder: string;
  isLoading: boolean;
  disabled?: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCursorPositionChange?: (position: number) => void;
  compact?: boolean;
}

const CURSOR_DEBOUNCE_MS = 150;

export function Textarea({
  ref,
  message,
  setMessage,
  placeholder,
  isLoading,
  disabled = false,
  onKeyDown,
  onCursorPositionChange,
  compact,
}: TextareaProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorPositionRef = useRef<number>(-1);
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message, textareaRef]);

  useEffect(() => {
    if (!isLoading && textareaRef.current && !isMobile) {
      textareaRef.current.focus();
    }
  }, [isLoading, isMobile, textareaRef]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const debouncedCursorChange = useCallback(
    (position: number) => {
      if (!onCursorPositionChange) return;
      if (position === lastCursorPositionRef.current) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        lastCursorPositionRef.current = position;
        onCursorPositionChange(position);
      }, CURSOR_DEBOUNCE_MS);
    },
    [onCursorPositionChange],
  );

  const handleCursorChange = useCallback(() => {
    if (textareaRef.current) {
      debouncedCursorChange(textareaRef.current.selectionStart);
    }
  }, [debouncedCursorChange, textareaRef]);

  const scrollIntoViewOnMobile = useCallback(() => {
    if (isMobile && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 150);
    }
  }, [isMobile, textareaRef]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
      debouncedCursorChange(e.target.selectionStart);
    },
    [setMessage, debouncedCursorChange],
  );

  return (
    <textarea
      ref={textareaRef}
      value={message}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onKeyUp={handleCursorChange}
      onClick={handleCursorChange}
      onSelect={handleCursorChange}
      onFocus={scrollIntoViewOnMobile}
      placeholder={placeholder}
      disabled={isLoading || disabled}
      rows={1}
      className={`max-h-[180px] w-full resize-none overflow-y-auto bg-transparent py-1.5 pr-14 text-xs leading-normal text-text-primary outline-none transition-all duration-200 placeholder:text-text-quaternary focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:text-text-dark-primary dark:placeholder:text-text-dark-quaternary ${isMobile && compact ? 'min-h-[28px]' : 'min-h-[80px]'}`}
      style={THIN_SCROLLBAR_STYLE}
      aria-label="Message input"
    />
  );
}
