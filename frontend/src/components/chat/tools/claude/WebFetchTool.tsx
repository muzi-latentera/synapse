import { memo } from 'react';
import { Globe } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractDomain, formatResult } from '@/utils/format';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';

interface WebFetchInput {
  url: string;
  prompt: string;
}

const WebFetchToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as WebFetchInput | undefined;
  const url = input?.url ?? '';
  const prompt = input?.prompt ?? '';

  const domain = extractDomain(url) || 'content';
  const result = formatResult(tool.result);

  return (
    <ToolCard
      icon={<Globe className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
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
      loadingContent="Fetching content\u2026"
      error={tool.error}
    >
      {(url || prompt || result) && (
        <div className="space-y-1.5">
          {url && (
            <div className="truncate font-mono text-2xs text-text-tertiary dark:text-text-dark-quaternary">
              {url}
            </div>
          )}
          {prompt && (
            <p className="text-2xs text-text-tertiary dark:text-text-dark-tertiary">{prompt}</p>
          )}
          {result && <pre className={TOOL_OUTPUT_PRE_CLASS}>{result}</pre>}
        </div>
      )}
    </ToolCard>
  );
};

export const WebFetchTool = memo(WebFetchToolInner);
