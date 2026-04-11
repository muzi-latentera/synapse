import { memo } from 'react';
import { FileSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { formatResult } from '@/utils/format';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';

type OutputMode = 'content' | 'files_with_matches' | 'count';

interface GrepInput {
  pattern: string;
  path?: string;
  output_mode?: OutputMode;
  glob?: string;
  type?: string;
}

const MODE_LABELS: Record<OutputMode, string> = {
  content: 'lines',
  files_with_matches: 'files',
  count: 'counts',
};

const GrepToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as GrepInput | undefined;
  const pattern = input?.pattern ?? '';
  const outputMode = input?.output_mode ?? 'files_with_matches';

  const result = formatResult(tool.result);
  const modeLabel = MODE_LABELS[outputMode];

  return (
    <ToolCard
      icon={<FileSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Searched: "${pattern}" (${modeLabel})`;
          case 'failed':
            return `Failed to search: "${pattern}" (${modeLabel})`;
          default:
            return `Searching: "${pattern}" (${modeLabel})`;
        }
      }}
      loadingContent="Searching..."
      error={tool.error}
    >
      {result && <pre className={TOOL_OUTPUT_PRE_CLASS}>{result}</pre>}
    </ToolCard>
  );
};

export const GrepTool = memo(GrepToolInner);
