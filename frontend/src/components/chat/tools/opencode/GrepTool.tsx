import { memo } from 'react';
import { FileSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { ToolCard } from '../common/ToolCard';
import { SearchLoadingDots } from '../common/SearchLoadingDots';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import type { OpencodeGrepInput, OpencodeGrepMetadata, OpencodeOutput } from './opencodePayload';

const ICON = (
  <FileSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
);

const GrepToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeGrepInput | undefined;
  const result = tool.result as OpencodeOutput | undefined;
  const metadata = result?.metadata as OpencodeGrepMetadata | undefined;

  const pattern = input?.pattern ?? tool.title?.trim() ?? 'pattern';
  const matches = metadata?.matches;
  const truncated = metadata?.truncated ?? false;
  const output = result?.output ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed': {
            if (typeof matches !== 'number') return `Searched for "${pattern}"`;
            const suffix = truncated ? '+' : '';
            return `Found ${matches}${suffix} match${matches === 1 ? '' : 'es'}`;
          }
          case 'failed':
            return `Search failed: ${pattern}`;
          default:
            return `Searching for "${pattern}"...`;
        }
      }}
      loadingContent={<SearchLoadingDots label="Searching files" />}
      error={tool.error}
    >
      {output && typeof matches === 'number' && matches > 0 && (
        <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>
      )}
    </ToolCard>
  );
};

export const GrepTool = memo(GrepToolInner);
