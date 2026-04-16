import { memo } from 'react';
import { FileSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractFilename } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';
import { NumberedContent } from '../common/NumberedContent';
import { OpenInEditorButton } from '../common/OpenInEditorButton';
import {
  type ShellLikeInput,
  type ShellLikeOutput,
  extractCommand,
  extractOutput,
  renderCommand,
} from './codexShellPayload';

const ReadToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as ShellLikeInput | undefined;
  const result = tool.result as ShellLikeOutput | undefined;
  const filePath = input?.parsed_cmd?.[0]?.path ?? '';
  const fileLabel = filePath ? extractFilename(filePath) : 'file';
  const content = extractOutput(result);
  const command = extractCommand(input);

  return (
    <ToolCard
      icon={<FileSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Read ${fileLabel}`;
          case 'failed':
            return `Failed to read ${fileLabel}`;
          default:
            return `Reading ${fileLabel}`;
        }
      }}
      loadingContent="Loading file content..."
      error={tool.error}
      actions={filePath ? <OpenInEditorButton filePath={filePath} /> : null}
    >
      {(filePath || command || content) && (
        <div className="space-y-1.5">
          {filePath && (
            <div className="truncate font-mono text-2xs text-text-tertiary dark:text-text-dark-quaternary">
              {filePath}
            </div>
          )}
          {renderCommand(command)}
          {content && <NumberedContent content={content} />}
        </div>
      )}
    </ToolCard>
  );
};

export const ReadTool = memo(ReadToolInner);
