import { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useToggleSet } from '@/hooks/useToggleSet';
import {
  AlertCircle,
  ChevronRight,
  ChevronsUpDown,
  GitCompareArrows,
  MoreHorizontal,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import { FileIcon } from '@/components/editor/file-tree/FileIcon';
import { Button } from '@/components/ui/primitives/Button';
import { SegmentedControl } from '@/components/ui/primitives/SegmentedControl';
import { Spinner } from '@/components/ui/primitives/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  useGitDiffQuery,
  useGitRestoreAllMutation,
  useGitRestoreFileMutation,
} from '@/hooks/queries/useSandboxQueries';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { FileDiffMetadata, FileContents } from '@pierre/diffs';
import type { DiffMode } from '@/types/sandbox.types';
import { cn } from '@/utils/cn';

const DIFF_THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const;

const DIFF_MODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'staged', label: 'Staged' },
  { value: 'unstaged', label: 'Unstaged' },
  { value: 'branch', label: 'Branch' },
] satisfies { value: DiffMode; label: string }[];

const DIFF_STYLE_OPTIONS = [
  { value: 'unified', label: 'Unified' },
  { value: 'split', label: 'Split' },
] satisfies { value: 'unified' | 'split'; label: string }[];

const DIFF_EMPTY_LABELS: Record<DiffMode, string> = {
  all: 'No changes',
  staged: 'No staged changes',
  unstaged: 'No unstaged changes',
  branch: 'No changes from base branch',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  deleted: 'Deleted',
  'rename-pure': 'Renamed',
  'rename-changed': 'Renamed',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-success-600/15 text-success-600 dark:bg-success-400/15 dark:text-success-400',
  deleted: 'bg-error-600/15 text-error-600 dark:bg-error-400/15 dark:text-error-400',
  'rename-pure': 'bg-warning-600/15 text-warning-600 dark:bg-warning-400/15 dark:text-warning-400',
  'rename-changed':
    'bg-warning-600/15 text-warning-600 dark:bg-warning-400/15 dark:text-warning-400',
};

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text-secondary transition-colors duration-200 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover';

const isRenameFileType = (type?: string) => type === 'rename-pure' || type === 'rename-changed';

// Extract old/new file contents from a full-context parsed diff. The hunk lines
// include trailing '\n' (from parsePatchFiles's SPLIT_WITH_NEWLINES split), so
// joining without separator reconstructs the original file content.
function extractContents(
  file: FileDiffMetadata,
): { oldContent: string; newContent: string } | null {
  if (file.hunks.length === 0) return null;
  const oldParts: string[] = [];
  const newParts: string[] = [];
  for (const hunk of file.hunks) {
    for (const content of hunk.hunkContent) {
      if (content.type === 'context') {
        for (const line of content.lines) {
          oldParts.push(line);
          newParts.push(line);
        }
      } else {
        for (const line of content.deletions) oldParts.push(line);
        for (const line of content.additions) newParts.push(line);
      }
    }
  }
  if (oldParts.length === 0 && newParts.length === 0) return null;
  return { oldContent: oldParts.join(''), newContent: newParts.join('') };
}

// Re-diff full-context file data with limited context so the library produces
// hunk gaps (collapsedBefore > 0) that enable the incremental expand UI.
function rebuildWithCollapsedContext(
  fullFile: FileDiffMetadata,
  parseDiffFromFile: (old: FileContents, cur: FileContents) => FileDiffMetadata,
): FileDiffMetadata {
  const contents = extractContents(fullFile);
  if (!contents) return fullFile;
  const rebuilt = parseDiffFromFile(
    { name: fullFile.prevName ?? fullFile.name, contents: contents.oldContent },
    { name: fullFile.name, contents: contents.newContent },
  );
  rebuilt.type = fullFile.type;
  rebuilt.prevName = fullFile.prevName;
  if (fullFile.mode) rebuilt.mode = fullFile.mode;
  if (fullFile.oldMode) rebuilt.oldMode = fullFile.oldMode;
  return rebuilt;
}

type FileDiffComponent = React.ComponentType<{
  fileDiff: FileDiffMetadata;
  options?: Record<string, unknown>;
}>;

function FileDiffRenderer({
  file,
  options,
}: {
  file: FileDiffMetadata;
  options: Record<string, unknown>;
}) {
  const [FileDiff, setFileDiff] = useState<FileDiffComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('@pierre/diffs/react');
      if (!cancelled) setFileDiff(() => mod.FileDiff as FileDiffComponent);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!FileDiff) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="px-3 py-4 text-xs text-error-600 dark:text-error-400">
          Failed to render diff for this file
        </div>
      }
    >
      <FileDiff fileDiff={file} options={options} />
    </ErrorBoundary>
  );
}

function FileStats({ file }: { file: FileDiffMetadata }) {
  const { hunks } = file;
  if (hunks.length === 0) return null;

  let additions = 0;
  let deletions = 0;
  for (const h of hunks) {
    additions += h.additionLines;
    deletions += h.deletionLines;
  }

  if (additions === 0 && deletions === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1.5 pr-3 font-mono text-2xs">
      {additions > 0 && (
        <span className="text-success-600 dark:text-success-400">+{additions}</span>
      )}
      {deletions > 0 && (
        <span className="text-error-600 dark:text-error-400">&minus;{deletions}</span>
      )}
    </span>
  );
}

function FileStatusBadge({ type }: { type?: string }) {
  if (!type || type === 'change') return null;
  const label = STATUS_LABELS[type];
  const colors = STATUS_COLORS[type];
  if (!label || !colors) return null;

  return (
    <span
      className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none', colors)}
    >
      {label}
    </span>
  );
}

interface DiffViewProps {
  sandboxId?: string;
  cwd?: string;
}

export const DiffView = memo(function DiffView({ sandboxId, cwd }: DiffViewProps) {
  const theme = useResolvedTheme();
  const [expandedFiles, toggleFile, setExpandedFiles] = useToggleSet<number>();
  const [parsedFiles, setParsedFiles] = useState<FileDiffMetadata[]>([]);
  const [parsingDone, setParsingDone] = useState(false);
  const [mode, setMode] = useState<DiffMode>('all');
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified');
  const [discardTarget, setDiscardTarget] = useState<FileDiffMetadata | null>(null);
  const [discardAllOpen, setDiscardAllOpen] = useState(false);

  const {
    data: diffData,
    isFetching,
    isError,
    isPlaceholderData,
    refetch,
  } = useGitDiffQuery(sandboxId, mode, true, cwd, { enabled: !!sandboxId });

  const restoreFile = useGitRestoreFileMutation();
  const restoreAll = useGitRestoreAllMutation();

  // Portal + fixed-position menu — the toolbar's `overflow-x-auto` creates a
  // clip region on both axes (per CSS spec), so an absolute-positioned menu
  // inside it gets hidden. Portaling to <body> with fixed coords escapes it.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleDiscard = useCallback(async () => {
    if (!sandboxId || !discardTarget) return;
    const file = discardTarget;
    try {
      const result = await restoreFile.mutateAsync({
        sandboxId,
        filePath: file.name,
        oldPath: isRenameFileType(file.type) ? file.prevName : undefined,
        cwd,
      });
      if (result.success) {
        toast.success('Changes discarded');
      } else {
        toast.error(result.error || 'Failed to discard changes');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to discard changes');
    }
  }, [sandboxId, discardTarget, cwd, restoreFile]);

  const handleDiscardAll = useCallback(async () => {
    if (!sandboxId) return;
    try {
      const result = await restoreAll.mutateAsync({ sandboxId, cwd });
      if (result.success) {
        toast.success('All changes discarded');
      } else {
        toast.error(result.error || 'Failed to discard all changes');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to discard all changes');
    }
  }, [sandboxId, cwd, restoreAll]);

  const diffContent = diffData?.diff ?? '';
  const prevFileNamesRef = useRef<string>('');

  useEffect(() => {
    setParsedFiles([]);
    setParsingDone(false);
    if (!diffContent) {
      setParsingDone(true);
      setExpandedFiles(new Set());
      prevFileNamesRef.current = '';
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { parsePatchFiles, parseDiffFromFile } = await import('@pierre/diffs');
        const patches = parsePatchFiles(diffContent);
        if (!cancelled) {
          const files = patches
            .flatMap((p) => p.files)
            .map((f) => rebuildWithCollapsedContext(f, parseDiffFromFile));
          const fileNames = files.map((f) => f.name).join('\0');
          if (fileNames !== prevFileNamesRef.current) {
            setExpandedFiles(new Set());
            prevFileNamesRef.current = fileNames;
          }
          setParsedFiles(files);
        }
      } finally {
        if (!cancelled) setParsingDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diffContent, setExpandedFiles]);

  const options = useMemo(
    () => ({
      theme: DIFF_THEMES,
      themeType: theme,
      diffStyle,
      expandUnchanged: false,
      disableFileHeader: true,
    }),
    [theme, diffStyle],
  );

  const allExpanded = parsedFiles.length > 0 && expandedFiles.size === parsedFiles.length;

  const toggleAll = useCallback(() => {
    setExpandedFiles((prev) => {
      if (prev.size === parsedFiles.length && parsedFiles.length > 0) {
        return new Set();
      }
      return new Set(parsedFiles.map((_, i) => i));
    });
  }, [parsedFiles, setExpandedFiles]);

  if (!sandboxId) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-secondary text-xs text-text-quaternary dark:bg-surface-dark-secondary dark:text-text-dark-quaternary">
        No sandbox connected
      </div>
    );
  }

  const isLoading = isFetching && !diffData;
  const isGitRepo = diffData?.is_git_repo ?? false;
  const hasChanges = diffData?.has_changes ?? false;
  const diffError = diffData?.error ?? null;
  const showFiles = !isLoading && !isError && isGitRepo && hasChanges && parsedFiles.length > 0;
  // Discard restores against HEAD, which only matches what the user sees in
  // `all` mode. In staged/unstaged it would wipe the other side too, and in
  // branch mode it wouldn't touch the committed diff at all.
  // `!isPlaceholderData` guards the window where `keepPreviousData` still
  // shows rows from the previous mode while the `all`-mode fetch is pending.
  const canDiscardAll =
    !isLoading && !isError && isGitRepo && hasChanges && mode === 'all' && !isPlaceholderData;

  return (
    <div className="flex h-full w-full flex-col bg-surface-secondary dark:bg-surface-dark-secondary">
      <div className="flex h-9 items-center gap-1.5 overflow-x-auto border-b border-border/50 px-3 [scrollbar-width:none] dark:border-border-dark/50 [&::-webkit-scrollbar]:hidden">
        <Button
          onClick={() => refetch()}
          variant="unstyled"
          className="shrink-0 rounded-md p-1 text-text-quaternary transition-colors duration-200 hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
          title="Refresh diff"
          aria-label="Refresh diff"
        >
          <RotateCcw
            className={cn('h-3 w-3', isFetching && 'animate-spin motion-reduce:animate-none')}
          />
        </Button>

        <SegmentedControl
          options={DIFF_MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          size="sm"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1" />

        {(showFiles || canDiscardAll) && (
          <>
            <Button
              ref={triggerRef}
              onClick={toggleMenu}
              variant="unstyled"
              className="shrink-0 rounded-md p-1 text-text-quaternary transition-colors duration-200 hover:text-text-secondary dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
            {menuOpen &&
              createPortal(
                <div
                  ref={menuPanelRef}
                  role="menu"
                  style={{ top: menuPos.top, right: menuPos.right }}
                  className="fixed z-50 min-w-[180px] animate-fade-in space-y-px rounded-xl border border-border bg-surface-secondary/95 p-1 shadow-medium backdrop-blur-xl backdrop-saturate-150 dark:border-border-dark dark:bg-surface-dark-secondary/95"
                >
                  {showFiles && (
                    <Button
                      variant="unstyled"
                      role="menuitem"
                      onClick={() => {
                        toggleAll();
                        setMenuOpen(false);
                      }}
                      className={MENU_ITEM_CLASS}
                    >
                      <ChevronsUpDown className="h-3 w-3 text-text-tertiary dark:text-text-dark-tertiary" />
                      {allExpanded ? 'Collapse all files' : 'Expand all files'}
                    </Button>
                  )}
                  {showFiles && canDiscardAll && (
                    <div className="my-1 h-px bg-border/50 dark:bg-border-dark/50" />
                  )}
                  {canDiscardAll && (
                    <Button
                      variant="unstyled"
                      role="menuitem"
                      disabled={restoreAll.isPending}
                      onClick={() => {
                        setDiscardAllOpen(true);
                        setMenuOpen(false);
                      }}
                      className={MENU_ITEM_CLASS}
                    >
                      <Undo2 className="h-3 w-3 text-text-tertiary dark:text-text-dark-tertiary" />
                      Discard all changes
                    </Button>
                  )}
                </div>,
                document.body,
              )}
            <div className="h-3 w-px shrink-0 bg-border/50 dark:bg-border-dark/50" />
          </>
        )}

        <SegmentedControl
          options={DIFF_STYLE_OPTIONS}
          value={diffStyle}
          onChange={setDiffStyle}
          size="sm"
          className="shrink-0"
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <AlertCircle className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
            <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
              Failed to load diff
            </span>
            <Button
              onClick={() => refetch()}
              variant="unstyled"
              className="text-2xs text-text-tertiary underline transition-colors duration-200 hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary"
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && !isGitRepo && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
            <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
              Not a git repository
            </span>
          </div>
        )}

        {!isLoading && !isError && isGitRepo && diffError && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
            <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
              {diffError}
            </span>
          </div>
        )}

        {!isLoading && !isError && isGitRepo && !diffError && !hasChanges && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
            <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
              {DIFF_EMPTY_LABELS[mode]}
            </span>
          </div>
        )}

        {showFiles && (
          <div className="divide-y divide-border/30 dark:divide-border-dark/30">
            {parsedFiles.map((file, i) => {
              const isExpanded = expandedFiles.has(i);
              const isRenamed = isRenameFileType(file.type);
              return (
                <div key={i}>
                  <div className="group flex w-full items-center transition-colors duration-200 hover:bg-surface-hover dark:hover:bg-surface-dark-hover">
                    <Button
                      variant="unstyled"
                      type="button"
                      onClick={() => toggleFile(i)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left"
                    >
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 shrink-0 text-text-quaternary transition-transform duration-200 dark:text-text-dark-quaternary',
                          isExpanded && 'rotate-90',
                        )}
                      />
                      <FileIcon name={file.name} className="h-3 w-3" />
                      <span className="min-w-0 truncate font-mono text-2xs text-text-secondary dark:text-text-dark-secondary">
                        {isRenamed && file.prevName ? (
                          <>
                            <span className="text-text-quaternary dark:text-text-dark-quaternary">
                              {file.prevName}
                            </span>
                            <span className="mx-1 text-text-quaternary dark:text-text-dark-quaternary">
                              &rarr;
                            </span>
                            {file.name}
                          </>
                        ) : (
                          file.name
                        )}
                      </span>
                      <FileStatusBadge type={file.type} />
                    </Button>
                    {canDiscardAll && (
                      <Button
                        variant="unstyled"
                        type="button"
                        onClick={() => setDiscardTarget(file)}
                        disabled={restoreFile.isPending}
                        className="mr-1 shrink-0 rounded-md p-1 text-text-quaternary opacity-0 transition-opacity duration-200 hover:text-text-primary focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100 dark:text-text-dark-quaternary dark:hover:text-text-dark-primary"
                        title="Discard changes"
                        aria-label={`Discard changes for ${file.name}`}
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    )}
                    <FileStats file={file} />
                  </div>
                  {isExpanded && <FileDiffRenderer file={file} options={options} />}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading &&
          !isError &&
          isGitRepo &&
          hasChanges &&
          parsedFiles.length === 0 &&
          !parsingDone && (
            <div className="flex h-full items-center justify-center">
              <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
            </div>
          )}

        {!isLoading &&
          !isError &&
          isGitRepo &&
          hasChanges &&
          parsedFiles.length === 0 &&
          parsingDone && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-text-quaternary dark:text-text-dark-quaternary" />
              <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
                Changes detected but diff cannot be displayed
              </span>
              <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                Binary or unsupported file formats
              </span>
            </div>
          )}
      </div>

      <ConfirmDialog
        isOpen={discardTarget !== null}
        onClose={() => setDiscardTarget(null)}
        onConfirm={handleDiscard}
        title="Discard changes?"
        message={
          discardTarget
            ? `All changes to ${discardTarget.name} will be reverted to the last committed version. This cannot be undone.`
            : ''
        }
        confirmLabel="Discard"
      />

      <ConfirmDialog
        isOpen={discardAllOpen}
        onClose={() => setDiscardAllOpen(false)}
        onConfirm={handleDiscardAll}
        title="Discard all changes?"
        message="All modified, staged, and untracked files in the workspace will be reverted to the last committed version. This cannot be undone."
        confirmLabel="Discard all"
      />
    </div>
  );
});
