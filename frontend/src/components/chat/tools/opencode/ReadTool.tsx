import { memo } from 'react';
import { FileSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractFilename } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';
import { NumberedContent } from '../common/NumberedContent';
import { OpenInEditorButton } from '../common/OpenInEditorButton';
import type { OpencodeReadInput, OpencodeOutput } from './opencodePayload';

const ICON = (
  <FileSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
);

const ReadToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeReadInput | undefined;
  const result = tool.result as OpencodeOutput | undefined;

  const filePath = input?.filePath ?? '';
  const fileName = filePath ? extractFilename(filePath) : tool.title?.trim() || 'file';
  const content = result?.output ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Read ${fileName}`;
          case 'failed':
            return `Failed to read ${fileName}`;
          default:
            return `Reading ${fileName}...`;
        }
      }}
      loadingContent="Loading file content..."
      error={tool.error}
      actions={filePath ? <OpenInEditorButton filePath={filePath} /> : null}
    >
      {content && <NumberedContent content={content} />}
    </ToolCard>
  );
};

export const ReadTool = memo(ReadToolInner);
