import { memo } from 'react';
import { FileEdit, FilePlus } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractFilename } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';
import { OpenInEditorButton } from '../common/OpenInEditorButton';

interface FileChange {
  type: 'add' | 'update' | 'delete';
  content?: string;
  unified_diff?: string;
  move_path?: string | null;
}

interface EditInput {
  changes?: Record<string, FileChange>;
}

interface EditOutput {
  success?: boolean;
  stdout?: string;
  changes?: Record<string, FileChange>;
}

const DiffLine: React.FC<{ line: string }> = ({ line }) => {
  const isAdded = line.startsWith('+') && !line.startsWith('+++');
  const isRemoved = line.startsWith('-') && !line.startsWith('---');
  const isHeader = line.startsWith('@@');

  if (isHeader) {
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

const FileContent: React.FC<{ change: FileChange }> = ({ change }) => {
  if (change.unified_diff) {
    const lines = change.unified_diff.split('\n').filter((l) => l.length > 0);
    return (
      <div>
        {lines.map((line, idx) => (
          <DiffLine key={idx} line={line} />
        ))}
      </div>
    );
  }

  if (change.content) {
    return (
      <div>
        {change.content.split('\n').map((line, idx) => (
          <div key={idx} className="flex">
            <span className="w-8 flex-shrink-0 select-none pr-2 text-right text-text-quaternary dark:text-text-dark-quaternary">
              {idx + 1}
            </span>
            <span className="whitespace-pre text-text-tertiary dark:text-text-dark-tertiary">
              {line || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

const EditToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as EditInput | undefined;
  const result = tool.result as EditOutput | undefined;

  const changedFiles = Object.entries(input?.changes ?? result?.changes ?? {});

  const firstFilePath = changedFiles[0]?.[0] ?? '';
  const firstFileName = firstFilePath ? extractFilename(firstFilePath) : '';
  const isNewFile = changedFiles[0]?.[1]?.type === 'add';
  const fileCount = changedFiles.length;

  const Icon = isNewFile ? FilePlus : FileEdit;

  const hasExpandableContent = changedFiles.length > 0 && tool.status === 'completed';
  const target = fileCount > 1 ? `${fileCount} files` : firstFileName;

  return (
    <ToolCard
      icon={<Icon className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        const label = isNewFile ? 'Created' : 'Edited';
        const verb = isNewFile ? 'Creating' : 'Editing';
        switch (status) {
          case 'completed':
            return `${label} ${target}`;
          case 'failed':
            return `Failed to edit ${target}`;
          default:
            return `${verb} ${target}`;
        }
      }}
      loadingContent={isNewFile ? 'Creating file...' : 'Applying changes...'}
      error={tool.error}
      expandable={hasExpandableContent}
      actions={firstFilePath ? <OpenInEditorButton filePath={firstFilePath} /> : null}
    >
      {hasExpandableContent && (
        <div className="max-h-48 overflow-auto font-mono text-2xs leading-relaxed">
          {changedFiles.map(([filePath, change]) => (
            <div key={filePath} className="mb-2 last:mb-0">
              {fileCount > 1 && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`text-2xs font-medium ${
                      change.type === 'add'
                        ? 'text-success-600 dark:text-success-400'
                        : change.type === 'delete'
                          ? 'text-error-600 dark:text-error-400'
                          : 'text-text-tertiary dark:text-text-dark-tertiary'
                    }`}
                  >
                    {change.type === 'add' ? 'A' : change.type === 'delete' ? 'D' : 'M'}
                  </span>
                  <span className="truncate text-text-secondary dark:text-text-dark-tertiary">
                    {extractFilename(filePath)}
                  </span>
                </div>
              )}
              <FileContent change={change} />
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  );
};

export const EditTool = memo(EditToolInner);
