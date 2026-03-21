import { Download, Loader2, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { RefreshButton } from '@/components/ui/shared/RefreshButton';
import { SearchInput } from './SearchInput';

export interface HeaderProps {
  onDownload?: () => void;
  isDownloading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onClose?: () => void;
}

export function Header({
  onDownload,
  isDownloading = false,
  onRefresh,
  isRefreshing = false,
  searchQuery = '',
  onSearchChange,
  onSearchClear,
  onClose,
}: HeaderProps) {
  return (
    <div className="flex flex-none flex-col gap-2 border-b border-border/50 px-3 py-2 dark:border-border-dark/50">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
          Files
        </span>

        <div className="flex items-center gap-0.5">
          {onRefresh && (
            <RefreshButton
              onClick={onRefresh}
              isRefreshing={isRefreshing}
              ariaLabel="Refresh files"
              useLoader
            />
          )}

          {onDownload && (
            <Button
              onClick={onDownload}
              disabled={isDownloading}
              variant="unstyled"
              className="rounded-md p-1 text-text-quaternary transition-colors duration-200 hover:text-text-secondary disabled:cursor-wait disabled:opacity-50 dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
              title="Download"
              aria-label="Download files"
            >
              {isDownloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </Button>
          )}

          {onClose && (
            <Button
              onClick={onClose}
              variant="unstyled"
              className="rounded-md p-1 text-text-quaternary transition-colors duration-200 hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
              title="Close file tree"
              aria-label="Close file tree"
            >
              <PanelLeftClose className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {onSearchChange && onSearchClear && (
        <SearchInput value={searchQuery} onChange={onSearchChange} onClear={onSearchClear} />
      )}
    </div>
  );
}
