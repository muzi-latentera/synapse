import { memo } from 'react';
import { FilePlus } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractFilename } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';
import { NumberedContent } from '../common/NumberedContent';
import { OpenInEditorButton } from '../common/OpenInEditorButton';
import type { OpencodeWriteInput } from './opencodePayload';

const ICON = <FilePlus className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const WriteToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeWriteInput | undefined;
  const filePath = input?.filePath ?? '';
  const fileName = filePath ? extractFilename(filePath) : tool.title?.trim() || 'file';
  const content = input?.content ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Wrote ${fileName}`;
          case 'failed':
            return `Failed to write ${fileName}`;
          default:
            return `Writing ${fileName}...`;
        }
      }}
      loadingContent="Writing file..."
      error={tool.error}
      actions={filePath ? <OpenInEditorButton filePath={filePath} /> : null}
    >
      {content && <NumberedContent content={content} />}
    </ToolCard>
  );
};

export const WriteTool = memo(WriteToolInner);
