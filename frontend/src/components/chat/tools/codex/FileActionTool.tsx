import { memo } from 'react';
import { FileX, FileOutput } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractFilename } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';

const ICON_CLASS = 'h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary';

interface DeleteInput {
  file_path?: string;
  path?: string;
}

interface MoveInput {
  source?: string;
  destination?: string;
  src_path?: string;
  dst_path?: string;
}

const DeleteToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as DeleteInput | undefined;
  const filePath = input?.file_path || input?.path || '';
  const fileName = filePath ? extractFilename(filePath) : '';

  return (
    <ToolCard
      icon={<FileX className={ICON_CLASS} />}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Deleted ${fileName || 'file'}`;
          case 'failed':
            return `Failed to delete ${fileName || 'file'}`;
          default:
            return `Deleting ${fileName || 'file'}`;
        }
      }}
      loadingContent="Deleting file..."
      error={tool.error}
    />
  );
};

const MoveToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as MoveInput | undefined;
  const source = input?.source || input?.src_path || '';
  const destination = input?.destination || input?.dst_path || '';
  const srcName = source ? extractFilename(source) : '';
  const dstName = destination ? extractFilename(destination) : '';

  return (
    <ToolCard
      icon={<FileOutput className={ICON_CLASS} />}
      status={tool.status}
      title={(status) => {
        const label = srcName && dstName ? `${srcName} → ${dstName}` : srcName || 'file';
        switch (status) {
          case 'completed':
            return `Moved ${label}`;
          case 'failed':
            return `Failed to move ${label}`;
          default:
            return `Moving ${label}`;
        }
      }}
      loadingContent="Moving file..."
      error={tool.error}
    />
  );
};

export const DeleteTool = memo(DeleteToolInner);
export const MoveTool = memo(MoveToolInner);
