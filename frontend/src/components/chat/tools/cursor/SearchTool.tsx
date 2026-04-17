import { memo } from 'react';
import { FileSearch, FolderSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { ToolCard } from '../common/ToolCard';
import { SearchLoadingDots } from '../common/SearchLoadingDots';
import type { CursorSearchOutput } from './cursorPayload';

const SearchToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const result = tool.result as CursorSearchOutput | undefined;
  // Cursor uses the same `search` kind for grep-style content search (title
  // "grep") and file-name glob search (title "Find"). totalMatches is present
  // for grep, totalFiles for Find — use whichever is defined.
  const title = tool.title?.trim() || 'search';
  const isGlob = /^find$/i.test(title);
  const count = result?.totalMatches ?? result?.totalFiles;
  const truncated = result?.truncated ?? false;

  const icon = isGlob ? (
    <FolderSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
  ) : (
    <FileSearch className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
  );

  return (
    <ToolCard
      icon={icon}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed': {
            if (typeof count !== 'number') return `Searched with ${title}`;
            const noun = isGlob ? 'file' : 'match';
            const plural = count === 1 ? '' : 'es';
            const suffix = truncated ? '+' : '';
            return `Found ${count}${suffix} ${noun}${isGlob ? (count === 1 ? '' : 's') : plural}`;
          }
          case 'failed':
            return `Search failed: ${title}`;
          default:
            return `Searching with ${title}...`;
        }
      }}
      loadingContent={<SearchLoadingDots label={isGlob ? 'Finding files' : 'Searching files'} />}
      error={tool.error}
    />
  );
};

export const SearchTool = memo(SearchToolInner);
