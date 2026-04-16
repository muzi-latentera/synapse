import { memo, useMemo } from 'react';

const DiffLine: React.FC<{ line: string }> = ({ line }) => {
  const isAdded = line.startsWith('+') && !line.startsWith('+++');
  const isRemoved = line.startsWith('-') && !line.startsWith('---');
  const isHunkHeader =
    line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ');
  const isFileHeader = line.startsWith('+++') || line.startsWith('---');

  if (isHunkHeader || isFileHeader) {
    return <div className="text-text-quaternary dark:text-text-dark-quaternary">{line}</div>;
  }

  return (
    <div className="flex">
      <span
        className={`w-4 flex-shrink-0 select-none text-center ${
          isRemoved
            ? 'text-error-600/40 dark:text-error-400/40'
            : isAdded
              ? 'text-success-600/40 dark:text-success-400/40'
              : 'text-transparent'
        }`}
      >
        {isRemoved ? '−' : isAdded ? '+' : ' '}
      </span>
      <span
        className={`whitespace-pre ${
          isRemoved
            ? 'text-text-quaternary line-through dark:text-text-dark-quaternary'
            : isAdded
              ? 'text-text-secondary dark:text-text-dark-secondary'
              : 'text-text-tertiary dark:text-text-dark-tertiary'
        }`}
      >
        {line.slice(1) || '\u00A0'}
      </span>
    </div>
  );
};

const DiffViewInner: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = useMemo(() => diff.split('\n').filter((l) => l.length > 0), [diff]);
  return (
    <div className="max-h-48 overflow-auto font-mono text-2xs leading-relaxed">
      {lines.map((line, idx) => (
        <DiffLine key={idx} line={line} />
      ))}
    </div>
  );
};

export const DiffView = memo(DiffViewInner);
