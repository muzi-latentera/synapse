import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { CodeSidebar } from '../code-sidebar/CodeSidebar';
import type { SidebarTab } from '../code-sidebar/CodeSidebar';
import { View } from '../editor-view/View';
import type { FileStructure } from '@/types/file-system.types';
import { cn } from '@/utils/cn';
import { findFileInStructure, getAncestorFolderPaths } from '@/utils/file';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMountEffect } from '@/hooks/useMountEffect';

const IS_MAC = navigator.platform.toUpperCase().startsWith('MAC');

export interface CodeViewProps {
  files: FileStructure[];
  selectedFile: FileStructure | null;
  expandedFolders: Record<string, boolean>;
  onFileSelect: (file: FileStructure | null) => void;
  toggleFolder: (path: string) => void;
  theme: string;
  sandboxId?: string;
  chatId?: string;
  cwd?: string;
  onDownload?: () => void;
  isDownloading?: boolean;
  isSandboxSyncing?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const scrollSelectedFileIntoView = (container: HTMLElement | null, path: string) => {
  if (!container) return;
  // Two rAFs: first for React to flush folder-expansion state, second for the layout to settle.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(`[data-file-path="${CSS.escape(path)}"]`);
      el?.scrollIntoView({ block: 'center' });
    });
  });
};

export const CodeView = memo(function CodeView({
  files,
  selectedFile,
  expandedFolders,
  onFileSelect,
  toggleFolder,
  theme,
  sandboxId,
  chatId,
  cwd,
  onDownload,
  isDownloading,
  isSandboxSyncing = false,
  onRefresh,
  isRefreshing = false,
}: CodeViewProps) {
  const backgroundClass = theme === 'light' ? 'bg-surface-secondary' : 'bg-surface-dark-secondary';
  const isMobile = useIsMobile();
  const [showMobileTree, setShowMobileTree] = useState(false);
  const fileTreePanelRef = useRef<ImperativePanelHandle>(null);
  const fileTreeContainerRef = useRef<HTMLDivElement>(null);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const [focusSignal, setFocusSignal] = useState(0);
  const [targetLine, setTargetLine] = useState<{
    path: string;
    line: number;
    nonce: number;
  } | null>(null);

  useMountEffect(() => {
    // Sync the flag with the panel's actual restored state: autoSaveId can override defaultSize,
    // so a returning user's saved-expanded layout would otherwise leave isFileTreeCollapsed=true
    // and desync the View's toggle button from reality.
    const panel = fileTreePanelRef.current;
    if (panel && !panel.isCollapsed()) {
      setIsFileTreeCollapsed(false);
    }
  });

  const handleToggleFileTree = useCallback(() => {
    const panel = fileTreePanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);

  const handleFileTreeExpand = useCallback(() => {
    setIsFileTreeCollapsed(false);
    if (!selectedFile || selectedFile.type !== 'file') return;

    // Expand any collapsed ancestor folders so the selected file renders in the DOM before scrolling.
    // Editor.tsx normalizes expandedFolders so unknown paths default to `true`; `=== false` matches
    // only explicitly-collapsed folders and avoids toggling implicit-true defaults closed.
    for (const ancestorPath of getAncestorFolderPaths(selectedFile.path)) {
      if (expandedFolders[ancestorPath] === false) {
        toggleFolder(ancestorPath);
      }
    }

    scrollSelectedFileIntoView(fileTreeContainerRef.current, selectedFile.path);
  }, [selectedFile, expandedFolders, toggleFolder]);

  const handleMobileFileSelect = useCallback(
    (file: FileStructure | null) => {
      onFileSelect(file);
      if (file && file.type === 'file') {
        setShowMobileTree(false);
      }
    },
    [onFileSelect],
  );

  // Read the latest file tree through a ref so handleOpenResult stays
  // stable across file-tree refreshes — keeps the memo'd CodeSidebar from
  // re-rendering every time files change.
  const filesRef = useRef(files);
  filesRef.current = files;

  const handleOpenResult = useCallback(
    (path: string, lineNumber: number) => {
      const file = findFileInStructure(filesRef.current, path);
      if (!file) return;
      onFileSelect(file);
      // Each click re-navigates even when path+line match the last one,
      // so re-clicking a result re-reveals it after the user scrolls away.
      setTargetLine((prev) => ({
        path,
        line: lineNumber,
        nonce: (prev?.nonce ?? 0) + 1,
      }));
      if (isMobile) setShowMobileTree(false);
    },
    [onFileSelect, isMobile],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modifier = IS_MAC ? e.metaKey : e.ctrlKey;
      if (!modifier || !e.shiftKey || e.key.toLowerCase() !== 'f') return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable;
      // Skip when typing in an unrelated field so we don't hijack the
      // browser's own find dialog mid-edit; re-focus when already inside
      // the sidebar input so the shortcut still works as a "jump here".
      if (inInput && !active?.closest('[data-code-sidebar]')) return;
      e.preventDefault();
      if (isMobile) setShowMobileTree(true);
      else if (fileTreePanelRef.current?.isCollapsed()) fileTreePanelRef.current.expand();
      setActiveTab('search');
      setFocusSignal((n) => n + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile]);

  // Shared sidebar props — mobile and desktop differ only in the file-select
  // handler and close callback, so everything else is hoisted once here.
  const sharedSidebarProps = {
    files,
    selectedFile,
    expandedFolders,
    onToggleFolder: toggleFolder,
    onOpenResult: handleOpenResult,
    onDownload,
    isDownloading,
    isSandboxSyncing,
    onRefresh,
    isRefreshing,
    sandboxId,
    cwd,
    activeTab,
    onActiveTabChange: setActiveTab,
    focusSignal,
  };

  if (isMobile) {
    return (
      <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', backgroundClass)}>
        {showMobileTree && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/50"
              onClick={() => setShowMobileTree(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowMobileTree(false);
              }}
              role="presentation"
            />
            <div
              data-code-sidebar
              className={cn(
                'absolute left-0 top-0 z-30 h-full w-72',
                'border-r border-border dark:border-border-dark',
                backgroundClass,
              )}
            >
              <CodeSidebar
                {...sharedSidebarProps}
                onFileSelect={handleMobileFileSelect}
                onClose={() => setShowMobileTree(false)}
              />
            </div>
          </>
        )}

        <div className={cn('min-h-0 flex-1 overflow-hidden', backgroundClass)}>
          <View
            selectedFile={selectedFile}
            fileStructure={files}
            sandboxId={sandboxId}
            chatId={chatId}
            onToggleFileTree={() => setShowMobileTree(true)}
            targetLine={targetLine}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <PanelGroup direction="horizontal" autoSaveId="code-view-layout">
        <Panel
          ref={fileTreePanelRef}
          defaultSize={0}
          minSize={15}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsFileTreeCollapsed(true)}
          onExpand={handleFileTreeExpand}
        >
          <div
            ref={fileTreeContainerRef}
            data-code-sidebar
            className={`h-full overflow-hidden border-r border-border dark:border-border-dark ${backgroundClass}`}
          >
            <CodeSidebar
              {...sharedSidebarProps}
              onFileSelect={onFileSelect}
              onClose={handleToggleFileTree}
            />
          </div>
        </Panel>

        <PanelResizeHandle
          className={cn(
            'group relative w-px',
            'bg-border/50 dark:bg-border-dark/50',
            'hover:bg-text-quaternary/50 dark:hover:bg-text-dark-quaternary/50',
            'transition-colors duration-200',
          )}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
        </PanelResizeHandle>

        <Panel>
          <div className={`h-full overflow-hidden ${backgroundClass}`}>
            <View
              selectedFile={selectedFile}
              fileStructure={files}
              sandboxId={sandboxId}
              chatId={chatId}
              onToggleFileTree={isFileTreeCollapsed ? handleToggleFileTree : undefined}
              targetLine={targetLine}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
});
