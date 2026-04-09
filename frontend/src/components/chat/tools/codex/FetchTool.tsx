import { memo, useMemo } from 'react';
import { Globe, Search } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { extractDomain, formatResult } from '@/utils/format';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';
import { SourceChip } from '../common/SourceChip';
import { SearchLoadingDots } from '../common/SearchLoadingDots';

interface FetchAction {
  type: 'search' | 'open_page' | 'find_in_page';
  query?: string;
  queries?: string[];
  url?: string;
  pattern?: string;
}

interface FetchInput {
  query?: string;
  action?: FetchAction;
}

interface PageSource {
  title: string;
  url: string;
}

const getActionType = (input: FetchInput | undefined): FetchAction['type'] => {
  return input?.action?.type ?? 'search';
};

const extractSources = (input: FetchInput | undefined): PageSource[] => {
  const action = input?.action;
  if (!action) return [];

  if (action.type === 'open_page' && action.url) {
    return [{ title: extractDomain(action.url) || action.url, url: action.url }];
  }

  return [];
};

const FetchToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as FetchInput | undefined;
  const actionType = getActionType(input);
  const query = input?.action?.query ?? input?.query ?? '';
  const url = input?.action?.url ?? '';
  const pattern = input?.action?.pattern ?? '';
  const domain = extractDomain(url) || 'content';
  const result = formatResult(tool.result);
  const isSearch = actionType === 'search';

  const sources = useMemo(() => extractSources(input), [input]);
  const hasExpandableContent = isSearch
    ? sources.length > 0 && tool.status === 'completed'
    : url.length > 0 || (result.length > 0 && tool.status === 'completed');

  return (
    <ToolCard
      icon={
        isSearch ? (
          <Search className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
        ) : (
          <Globe className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
        )
      }
      status={tool.status}
      title={(status) => {
        if (isSearch) {
          switch (status) {
            case 'completed':
              return `Searched: ${query}`;
            case 'failed':
              return `Search failed: ${query}`;
            default:
              return `Searching: ${query}`;
          }
        }

        const fetchLabel = pattern || domain;
        switch (status) {
          case 'completed':
            return `Fetched: ${fetchLabel}`;
          case 'failed':
            return `Failed to fetch: ${fetchLabel}`;
          default:
            return `Fetching: ${fetchLabel}`;
        }
      }}
      loadingContent={isSearch ? <SearchLoadingDots /> : 'Fetching content...'}
      error={tool.error}
      expandable={hasExpandableContent}
    >
      {hasExpandableContent && (
        <div className={isSearch ? 'flex flex-wrap gap-1' : 'space-y-1.5'}>
          {isSearch ? (
            sources.map((source, index) => (
              <SourceChip key={`${index}-${source.url}`} source={source} index={index} />
            ))
          ) : (
            <>
              {url && (
                <div className="truncate font-mono text-2xs text-text-tertiary dark:text-text-dark-quaternary">
                  {url}
                </div>
              )}
              {pattern && (
                <p className="text-2xs text-text-tertiary dark:text-text-dark-tertiary">
                  {pattern}
                </p>
              )}
              {result.length > 0 && tool.status === 'completed' && (
                <pre className={TOOL_OUTPUT_PRE_CLASS}>{result}</pre>
              )}
            </>
          )}
        </div>
      )}
    </ToolCard>
  );
};

export const FetchTool = memo(FetchToolInner);
