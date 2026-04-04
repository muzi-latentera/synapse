import React, { type CSSProperties } from 'react';

const DELAY_0: CSSProperties = { animationDelay: '0ms' };
const DELAY_150: CSSProperties = { animationDelay: '150ms' };
const DELAY_300: CSSProperties = { animationDelay: '300ms' };

export const SearchLoadingDots: React.FC<{ label?: string }> = ({
  label = 'Searching the web',
}) => (
  <div className="mt-0.5 flex items-center gap-1.5">
    <div className="flex space-x-1">
      <div
        className="h-1 w-1 animate-bounce rounded-full bg-text-tertiary dark:bg-text-dark-tertiary"
        style={DELAY_0}
      />
      <div
        className="h-1 w-1 animate-bounce rounded-full bg-text-tertiary dark:bg-text-dark-tertiary"
        style={DELAY_150}
      />
      <div
        className="h-1 w-1 animate-bounce rounded-full bg-text-tertiary dark:bg-text-dark-tertiary"
        style={DELAY_300}
      />
    </div>
    <p className="text-2xs text-text-tertiary dark:text-text-dark-tertiary">{label}</p>
  </div>
);
