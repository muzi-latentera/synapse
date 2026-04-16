import { memo } from 'react';
import { Globe } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractDomain } from '@/utils/format';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';
import type { CopilotFetchInput, CopilotToolOutput } from './copilotPayload';

const ICON = <Globe className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const FetchToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as CopilotFetchInput | undefined;
  const result = tool.result as CopilotToolOutput | undefined;

  const url = input?.url ?? '';
  const domain = extractDomain(url) || url || 'content';
  const output = result?.content ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Fetched: ${domain}`;
          case 'failed':
            return `Failed to fetch: ${domain}`;
          default:
            return `Fetching: ${domain}`;
        }
      }}
      loadingContent="Fetching content..."
      error={tool.error}
    >
      {(url || output) && (
        <div className="space-y-1.5">
          {url && (
            <div className="truncate font-mono text-2xs text-text-tertiary dark:text-text-dark-quaternary">
              {url}
            </div>
          )}
          {output && <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>}
        </div>
      )}
    </ToolCard>
  );
};

export const FetchTool = memo(FetchToolInner);
