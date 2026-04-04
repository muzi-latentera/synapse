import { memo, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
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

const extractSources = (input: FetchInput | undefined): PageSource[] => {
  const action = input?.action;
  if (!action) return [];

  if (action.type === 'open_page' && action.url) {
    let domain = action.url;
    try {
      domain = new URL(action.url).hostname.replace('www.', '');
    } catch {
      // keep raw url
    }
    return [{ title: domain, url: action.url }];
  }

  return [];
};

const FetchToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as FetchInput | undefined;
  const title = tool.title;

  const sources = useMemo(() => extractSources(input), [input]);
  const canShowSources = sources.length > 0 && tool.status === 'completed';

  return (
    <ToolCard
      icon={<Search className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        if (title && title !== 'Searching the Web') {
          switch (status) {
            case 'completed':
              return title.replace(/^(Searching for|Opening|Finding):?\s*/, 'Searched: ');
            case 'failed':
              return `Search failed: ${title}`;
            default:
              return title;
          }
        }
        switch (status) {
          case 'completed':
            return 'Web search completed';
          case 'failed':
            return 'Web search failed';
          default:
            return 'Searching the web';
        }
      }}
      loadingContent={<SearchLoadingDots />}
      error={tool.error}
      expandable={canShowSources}
    >
      {canShowSources && (
        <div className="flex flex-wrap gap-1">
          {sources.map((source, index) => (
            <SourceChip key={`${index}-${source.url}`} source={source} index={index} />
          ))}
        </div>
      )}
    </ToolCard>
  );
};

export const FetchTool = memo(FetchToolInner);
