import { memo } from 'react';
import { Download, Loader2, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { RefreshButton } from '@/components/ui/shared/RefreshButton';
import { Tree } from '../file-tree/Tree';
import { SearchPanel } from '../file-search/SearchPanel';
import type { FileStructure } from '@/types/file-system.types';
import { cn } from '@/utils/cn';

export type SidebarTab = 'files' | 'search';

export interface CodeSidebarProps {
  files: FileStructure[];
  selectedFile: FileStructure | null;
  expandedFolders: Record<string, boolean>;
  onFileSelect: (file: FileStructure) => void;
  onToggleFolder: (path: string) => void;
  onOpenResult: (path: string, lineNumber: number) => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  isSandboxSyncing?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onClose?: () => void;
  modifiedPaths?: Set<string>;
  sandboxId: string | undefined;
  cwd?: string;
  activeTab: SidebarTab;
  onActiveTabChange: (tab: SidebarTab) => void;
}

export const CodeSidebar = memo(function CodeSidebar({
  files,
  selectedFile,
  expandedFolders,
  onFileSelect,
  onToggleFolder,
  onOpenResult,
  onDownload,
  isDownloading = false,
  isSandboxSyncing = false,
  onRefresh,
  isRefreshing = false,
  onClose,
  modifiedPaths,
  sandboxId,
  cwd,
  activeTab,
  onActiveTabChange,
}: CodeSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-surface-secondary dark:bg-surface-dark-secondary">
      <div className="flex flex-none items-center justify-between border-b border-border/50 px-2 py-1 dark:border-border-dark/50">
        <div className="flex items-center gap-0.5" role="tablist" aria-label="Sidebar sections">
          <TabButton
            label="Files"
            isActive={activeTab === 'files'}
            onClick={() => onActiveTabChange('files')}
          />
          <TabButton
            label="Search"
            isActive={activeTab === 'search'}
            onClick={() => onActiveTabChange('search')}
          />
        </div>

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
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* Both panels stay mounted so the user's search query and scroll
            position survive tab switches. Inactive tab is hidden via CSS. */}
        <div className={cn('h-full', activeTab !== 'files' && 'hidden')}>
          <Tree
            files={files}
            selectedFile={selectedFile}
            expandedFolders={expandedFolders}
            onFileSelect={onFileSelect}
            onToggleFolder={onToggleFolder}
            isSandboxSyncing={isSandboxSyncing}
            modifiedPaths={modifiedPaths}
          />
        </div>
        <div className={cn('h-full', activeTab !== 'search' && 'hidden')}>
          <SearchPanel sandboxId={sandboxId} cwd={cwd} onOpenResult={onOpenResult} />
        </div>
      </div>
    </div>
  );
});

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <Button
      variant="unstyled"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-2xs font-medium uppercase tracking-wider transition-colors duration-150',
        isActive
          ? 'bg-surface-active text-text-primary dark:bg-surface-dark-active dark:text-text-dark-primary'
          : 'text-text-quaternary hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary',
      )}
    >
      {label}
    </Button>
  );
}
