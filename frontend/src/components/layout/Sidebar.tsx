import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ChevronRight, MoreHorizontal, SquarePen } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Chat } from '@/types/chat.types';
import type { Workspace } from '@/types/workspace.types';
import { Button } from '@/components/ui/primitives/Button';
import { Spinner } from '@/components/ui/primitives/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RenameModal } from '@/components/ui/RenameModal';
import {
  useDeleteChatMutation,
  useUpdateChatMutation,
  usePinChatMutation,
  useInfiniteChatsQuery,
} from '@/hooks/queries/useChatQueries';
import {
  useDeleteWorkspaceMutation,
  useUpdateWorkspaceMutation,
} from '@/hooks/queries/useWorkspaceQueries';
import { useToggleSet } from '@/hooks/useToggleSet';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/store/uiStore';
import { useStreamStore } from '@/store/streamStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SidebarChatItem } from './SidebarChatItem';
import { SubThreadList } from './SubThreadList';
import { ChatDropdown } from './ChatDropdown';
import { DROPDOWN_WIDTH, DROPDOWN_HEIGHT, DROPDOWN_MARGIN } from '@/config/constants';

const CHATS_PER_WORKSPACE = 5;

async function mutateWithToast<T>(
  mutateFn: () => Promise<T>,
  successMessage: string,
  failureMessage: string,
): Promise<T> {
  try {
    const result = await mutateFn();
    toast.success(successMessage);
    return result;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : failureMessage);
    throw error;
  }
}

function calculateDropdownPosition(buttonRect: DOMRect): { top: number; left: number } {
  const isMobile = window.innerWidth < 640;
  const spaceBelow = window.innerHeight - buttonRect.bottom;
  const spaceRight = window.innerWidth - buttonRect.right;

  let top: number;
  let left: number;

  if (isMobile) {
    top =
      spaceBelow >= DROPDOWN_HEIGHT + DROPDOWN_MARGIN
        ? buttonRect.bottom + 4
        : buttonRect.top - DROPDOWN_HEIGHT - 4;
    left = buttonRect.right - DROPDOWN_WIDTH;
  } else {
    top =
      spaceBelow >= DROPDOWN_HEIGHT + DROPDOWN_MARGIN
        ? buttonRect.top
        : buttonRect.top - DROPDOWN_HEIGHT + buttonRect.height;
    left =
      spaceRight >= DROPDOWN_WIDTH + DROPDOWN_MARGIN
        ? buttonRect.right + 4
        : buttonRect.left - DROPDOWN_WIDTH - 4;
  }

  top = Math.max(
    DROPDOWN_MARGIN,
    Math.min(top, window.innerHeight - DROPDOWN_HEIGHT - DROPDOWN_MARGIN),
  );
  left = Math.max(
    DROPDOWN_MARGIN,
    Math.min(left, window.innerWidth - DROPDOWN_WIDTH - DROPDOWN_MARGIN),
  );

  return { top, left };
}

interface WorkspaceGroupProps {
  workspace: Workspace;
  selectedChatId: string | null;
  dropdownChatId: string | null;
  streamingChatIdSet: Set<string>;
  isCollapsed: boolean;
  onToggleCollapse: (workspaceId: string) => void;
  onChatSelect: (chatId: string) => void;
  onDropdownClick: (e: React.MouseEvent<HTMLButtonElement>, chat: Chat) => void;
  onNewThread: (e: React.MouseEvent, workspaceId: string) => void;
  onWorkspaceContextMenu: (e: React.MouseEvent<HTMLButtonElement>, workspaceId: string) => void;
  expandedSubThreads: Set<string>;
  onToggleSubThreads: (chatId: string) => void;
}

const SidebarWorkspaceGroup = memo(function SidebarWorkspaceGroup({
  workspace,
  selectedChatId,
  dropdownChatId,
  streamingChatIdSet,
  isCollapsed,
  onToggleCollapse,
  onChatSelect,
  onDropdownClick,
  onNewThread,
  onWorkspaceContextMenu,
  expandedSubThreads,
  onToggleSubThreads,
}: WorkspaceGroupProps) {
  const [isChatsExpanded, setIsChatsExpanded] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const handleMouseEnter = useCallback((chatId: string) => setHoveredChatId(chatId), []);
  const handleMouseLeave = useCallback(() => setHoveredChatId(null), []);

  // Each non-collapsed workspace fires its own query on mount. Collapsing a
  // workspace disables its query. If N simultaneous requests becomes a problem
  // with many workspaces, default new/inactive workspaces to collapsed.
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading } = useInfiniteChatsQuery(
    {
      workspaceId: workspace.id,
      pinned: false,
      enabled: !isCollapsed,
    },
  );

  const chats = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data?.pages]);

  const visibleChats = isChatsExpanded ? chats : chats.slice(0, CHATS_PER_WORKSPACE);
  const hasMoreLocalChats = chats.length > CHATS_PER_WORKSPACE;
  const showLoadMore = isChatsExpanded && hasNextPage;

  return (
    <div className="mb-1">
      <div className="group flex items-center gap-0.5 px-1 pb-0.5 pt-2">
        <button
          type="button"
          onClick={() => onToggleCollapse(workspace.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors duration-200 hover:bg-surface-hover dark:hover:bg-surface-dark-hover"
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-text-quaternary transition-transform duration-200 dark:text-text-dark-quaternary',
              !isCollapsed && 'rotate-90',
            )}
          />
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
          <span className="truncate text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
            {workspace.name}
          </span>
        </button>
        <button
          type="button"
          title="New thread"
          onClick={(e) => onNewThread(e, workspace.id)}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-text-quaternary opacity-0 transition-all duration-200 hover:text-text-primary group-hover:opacity-100 dark:text-text-dark-quaternary dark:hover:text-text-dark-primary"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-ws-dropdown-trigger
          onClick={(e) => onWorkspaceContextMenu(e, workspace.id)}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-text-quaternary opacity-0 transition-all duration-200 hover:text-text-primary group-hover:opacity-100 dark:text-text-dark-quaternary dark:hover:text-text-dark-primary"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      {!isCollapsed && (
        <div className="space-y-px pl-6">
          {isLoading ? null : chats.length === 0 ? (
            <p className="px-2.5 py-1 text-2xs text-text-quaternary dark:text-text-dark-quaternary">
              No threads
            </p>
          ) : (
            <>
              {visibleChats.map((chat) => (
                <div key={chat.id}>
                  <SidebarChatItem
                    chat={chat}
                    isSelected={chat.id === selectedChatId}
                    isHovered={hoveredChatId === chat.id}
                    isDropdownOpen={dropdownChatId === chat.id}
                    isChatStreaming={streamingChatIdSet.has(chat.id)}
                    isSubThreadsExpanded={expandedSubThreads.has(chat.id)}
                    onSelect={onChatSelect}
                    onDropdownClick={onDropdownClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onToggleSubThreads={onToggleSubThreads}
                  />
                  {chat.sub_thread_count > 0 && expandedSubThreads.has(chat.id) && (
                    <SubThreadList
                      parentChatId={chat.id}
                      selectedChatId={selectedChatId}
                      onSelect={onChatSelect}
                      onDropdownClick={onDropdownClick}
                      streamingChatIdSet={streamingChatIdSet}
                    />
                  )}
                </div>
              ))}
              {hasMoreLocalChats && !isChatsExpanded && (
                <button
                  type="button"
                  onClick={() => setIsChatsExpanded(true)}
                  className="w-full px-2.5 py-1 text-left text-2xs text-text-tertiary transition-colors duration-200 hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary"
                >
                  Show more ({chats.length - CHATS_PER_WORKSPACE})
                </button>
              )}
              {(hasMoreLocalChats || showLoadMore) && isChatsExpanded && (
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => setIsChatsExpanded(false)}
                    className="text-2xs text-text-tertiary transition-colors duration-200 hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary"
                  >
                    Show less
                  </button>
                  {showLoadMore && (
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="flex items-center gap-1 text-2xs text-text-tertiary transition-colors duration-200 hover:text-text-primary disabled:opacity-50 dark:text-text-dark-tertiary dark:hover:text-text-dark-primary"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Spinner size="xs" />
                          Loading…
                        </>
                      ) : (
                        'Load more'
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

export interface SidebarProps {
  workspaces: Workspace[];
  selectedChatId: string | null;
  selectedChatWorkspaceId?: string | null;
  selectedChatParentId?: string | null;
  onChatSelect: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
}

export function Sidebar({
  workspaces,
  selectedChatId,
  selectedChatWorkspaceId,
  selectedChatParentId,
  onChatSelect,
  onDeleteChat,
}: SidebarProps) {
  const navigate = useNavigate();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const isMobile = useIsMobile();
  const activeStreamMetadata = useStreamStore((state) => state.activeStreamMetadata);
  const streamingChatIdSet = useMemo(
    () => new Set(activeStreamMetadata.map((meta) => meta.chatId)),
    [activeStreamMetadata],
  );
  const [collapsedWorkspaces, toggleWorkspaceCollapse, setCollapsedWorkspaces] =
    useToggleSet<string>();
  const [pinnedHoveredId, setPinnedHoveredId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [chatToRename, setChatToRename] = useState<Chat | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [dropdown, setDropdown] = useState<{
    chat: Chat;
    position: { top: number; left: number };
  } | null>(null);
  const [workspaceDropdown, setWorkspaceDropdown] = useState<{
    workspaceId: string;
    position: { top: number; left: number };
  } | null>(null);
  const [expandedSubThreads, toggleSubThreads, setExpandedSubThreads] = useToggleSet<string>();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const deleteChat = useDeleteChatMutation();
  const updateChat = useUpdateChatMutation();
  const pinChat = usePinChatMutation();
  const deleteWorkspace = useDeleteWorkspaceMutation();
  const updateWorkspace = useUpdateWorkspaceMutation();

  const { data: pinnedChatsData } = useInfiniteChatsQuery({ pinned: true });
  const pinnedChats = useMemo(() => {
    if (!pinnedChatsData?.pages) return [];
    return pinnedChatsData.pages.flatMap((page) => page.items);
  }, [pinnedChatsData?.pages]);

  const hasAnyContent = pinnedChats.length > 0 || workspaces.length > 0;

  useEffect(() => {
    if (!selectedChatWorkspaceId) return;
    setCollapsedWorkspaces((prev) => {
      if (!prev.has(selectedChatWorkspaceId)) return prev;
      const next = new Set(prev);
      next.delete(selectedChatWorkspaceId);
      return next;
    });
  }, [selectedChatWorkspaceId, setCollapsedWorkspaces]);

  useEffect(() => {
    if (!selectedChatParentId) return;
    setExpandedSubThreads((prev) => {
      if (prev.has(selectedChatParentId)) return prev;
      return new Set(prev).add(selectedChatParentId);
    });
  }, [selectedChatParentId, setExpandedSubThreads]);

  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useMountEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdown(null);
      }
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-ws-dropdown-trigger]')
      ) {
        setWorkspaceDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  const dropdownStateRef = useRef(dropdown);
  dropdownStateRef.current = dropdown;
  const wsDropdownStateRef = useRef(workspaceDropdown);
  wsDropdownStateRef.current = workspaceDropdown;

  useMountEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (dropdownStateRef.current) setDropdown(null);
      if (wsDropdownStateRef.current) setWorkspaceDropdown(null);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  });

  const handleChatSelect = useCallback(
    (chatId: string) => {
      onChatSelect(chatId);
      setPinnedHoveredId(null);
      if (isMobile) {
        useUIStore.getState().setSidebarOpen(false);
      }
    },
    [onChatSelect, isMobile],
  );

  const handleDeleteChat = useCallback((chatId: string) => {
    setChatToDelete(chatId);
    setDropdown(null);
  }, []);

  const handlePinnedMouseEnter = useCallback((chatId: string) => {
    setPinnedHoveredId(chatId);
  }, []);

  const handlePinnedMouseLeave = useCallback(() => {
    setPinnedHoveredId(null);
  }, []);

  const confirmDeleteChat = useCallback(async () => {
    if (!chatToDelete) return;
    try {
      await mutateWithToast(
        () => deleteChat.mutateAsync(chatToDelete),
        'Chat deleted successfully',
        'Failed to delete chat',
      );
      if (chatToDelete === selectedChatId || chatToDelete === selectedChatParentId) {
        navigate('/');
      }
      onDeleteChat?.(chatToDelete);
    } catch {
      // toast already shown by mutateWithToast
    } finally {
      setChatToDelete(null);
    }
  }, [chatToDelete, deleteChat, selectedChatId, selectedChatParentId, navigate, onDeleteChat]);

  const handleNewChat = useCallback(() => {
    navigate('/');
    if (isMobile) {
      useUIStore.getState().setSidebarOpen(false);
    }
  }, [navigate, isMobile]);

  const handleDropdownClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, chat: Chat) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    setPinnedHoveredId(null);

    setDropdown((prev) => {
      if (prev?.chat.id === chat.id) {
        return null;
      }

      const position = calculateDropdownPosition(rect);
      return { chat, position };
    });
  }, []);

  const handleRenameClick = useCallback((chat: Chat) => {
    setChatToRename(chat);
    setDropdown(null);
  }, []);

  const handleSaveRename = useCallback(
    async (newTitle: string) => {
      if (!chatToRename) return;
      try {
        await mutateWithToast(
          () =>
            updateChat.mutateAsync({ chatId: chatToRename.id, updateData: { title: newTitle } }),
          'Chat renamed successfully',
          'Failed to rename chat',
        );
      } catch {
        // toast already shown by mutateWithToast
      } finally {
        setChatToRename(null);
      }
    },
    [chatToRename, updateChat],
  );

  const handleTogglePin = useCallback(
    async (chat: Chat) => {
      setDropdown(null);
      const isPinned = !!chat.pinned_at;
      try {
        await mutateWithToast(
          () => pinChat.mutateAsync({ chatId: chat.id, pinned: !isPinned }),
          isPinned ? 'Chat unpinned' : 'Chat pinned',
          'Failed to update pin status',
        );
      } catch {
        // toast already shown by mutateWithToast
      }
    },
    [pinChat],
  );

  const handleNewWorkspaceThread = useCallback(
    (e: React.MouseEvent, workspaceId: string) => {
      e.stopPropagation();
      navigate('/', { state: { workspaceId } });
      if (isMobile) {
        useUIStore.getState().setSidebarOpen(false);
      }
    },
    [navigate, isMobile],
  );

  const handleWorkspaceContextMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, workspaceId: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setWorkspaceDropdown((prev) => {
        if (prev?.workspaceId === workspaceId) return null;
        const position = calculateDropdownPosition(rect);
        return { workspaceId, position };
      });
    },
    [],
  );

  const handleRenameWorkspace = useCallback((workspace: Workspace) => {
    setWorkspaceToRename(workspace);
    setWorkspaceDropdown(null);
  }, []);

  const handleSaveWorkspaceRename = useCallback(
    async (newName: string) => {
      if (!workspaceToRename) return;
      try {
        await mutateWithToast(
          () =>
            updateWorkspace.mutateAsync({
              workspaceId: workspaceToRename.id,
              data: { name: newName },
            }),
          'Workspace renamed',
          'Failed to rename workspace',
        );
      } catch {
        // toast already shown by mutateWithToast
      } finally {
        setWorkspaceToRename(null);
      }
    },
    [workspaceToRename, updateWorkspace],
  );

  const handleDeleteWorkspace = useCallback((workspaceId: string) => {
    setWorkspaceToDelete(workspaceId);
    setWorkspaceDropdown(null);
  }, []);

  const confirmDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;
    try {
      await mutateWithToast(
        () => deleteWorkspace.mutateAsync(workspaceToDelete),
        'Workspace deleted',
        'Failed to delete workspace',
      );
      if (selectedChatId && selectedChatWorkspaceId === workspaceToDelete) {
        navigate('/');
      }
    } catch {
      // toast already shown by mutateWithToast
    } finally {
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, deleteWorkspace, selectedChatId, selectedChatWorkspaceId, navigate]);

  return (
    <>
      <aside
        aria-label="Chat history"
        className={cn(
          'absolute left-0 top-0 h-full w-64',
          'border-r border-border bg-surface-secondary dark:border-border-dark dark:bg-surface-dark-secondary',
          'z-40 flex flex-col transition-transform duration-500 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-border px-3 py-3 dark:border-border-dark">
          <Button
            onClick={handleNewChat}
            variant="unstyled"
            className={cn(
              'w-full px-3 py-2',
              'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
              'border border-border dark:border-border-dark',
              'text-text-secondary dark:text-text-dark-secondary',
              'rounded-lg transition-colors duration-200',
              'flex items-center justify-center gap-1.5 text-xs font-medium',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            New thread
          </Button>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 pt-1">
          {!hasAnyContent ? (
            <p className="py-8 text-center text-xs text-text-quaternary dark:text-text-dark-quaternary">
              No chats yet
            </p>
          ) : (
            <div>
              {pinnedChats.length > 0 && (
                <div className="mb-1">
                  <div className="px-2.5 pb-1 pt-2">
                    <span className="text-2xs font-medium uppercase tracking-widest text-text-quaternary dark:text-text-dark-quaternary">
                      Pinned
                    </span>
                  </div>
                  <div className="space-y-px">
                    {pinnedChats.map((chat) => (
                      <div key={chat.id}>
                        <SidebarChatItem
                          chat={chat}
                          isSelected={chat.id === selectedChatId}
                          isHovered={pinnedHoveredId === chat.id}
                          isDropdownOpen={dropdown?.chat.id === chat.id}
                          isChatStreaming={streamingChatIdSet.has(chat.id)}
                          isSubThreadsExpanded={expandedSubThreads.has(chat.id)}
                          onSelect={handleChatSelect}
                          onDropdownClick={handleDropdownClick}
                          onMouseEnter={handlePinnedMouseEnter}
                          onMouseLeave={handlePinnedMouseLeave}
                          onToggleSubThreads={toggleSubThreads}
                        />
                        {chat.sub_thread_count > 0 && expandedSubThreads.has(chat.id) && (
                          <SubThreadList
                            parentChatId={chat.id}
                            selectedChatId={selectedChatId}
                            onSelect={handleChatSelect}
                            onDropdownClick={handleDropdownClick}
                            streamingChatIdSet={streamingChatIdSet}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workspaces.map((workspace) => (
                <SidebarWorkspaceGroup
                  key={workspace.id}
                  workspace={workspace}
                  selectedChatId={selectedChatId}
                  dropdownChatId={dropdown?.chat.id ?? null}
                  streamingChatIdSet={streamingChatIdSet}
                  isCollapsed={collapsedWorkspaces.has(workspace.id)}
                  onToggleCollapse={toggleWorkspaceCollapse}
                  onChatSelect={handleChatSelect}
                  onDropdownClick={handleDropdownClick}
                  onNewThread={handleNewWorkspaceThread}
                  onWorkspaceContextMenu={handleWorkspaceContextMenu}
                  expandedSubThreads={expandedSubThreads}
                  onToggleSubThreads={toggleSubThreads}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {dropdown && (
        <ChatDropdown
          ref={dropdownRef}
          chat={dropdown.chat}
          position={dropdown.position}
          onRename={handleRenameClick}
          onDelete={handleDeleteChat}
          onTogglePin={handleTogglePin}
          onClose={() => setDropdown(null)}
        />
      )}

      {workspaceDropdown && (
        <div
          ref={workspaceDropdownRef}
          className="fixed z-50 w-40 rounded-xl border border-border/50 bg-surface-secondary p-1 shadow-medium backdrop-blur-xl dark:border-border-dark/50 dark:bg-surface-dark-secondary"
          style={{
            top: workspaceDropdown.position.top,
            left: workspaceDropdown.position.left,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const ws = workspaces.find((w) => w.id === workspaceDropdown.workspaceId);
              if (ws) handleRenameWorkspace(ws);
            }}
            className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-text-secondary transition-colors duration-200 hover:bg-surface-hover dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => handleDeleteWorkspace(workspaceDropdown.workspaceId)}
            className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-error-500 transition-colors duration-200 hover:bg-surface-hover dark:text-error-400 dark:hover:bg-surface-dark-hover"
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirm={confirmDeleteChat}
        title="Delete Chat"
        message="Are you sure you want to delete this chat? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <ConfirmDialog
        isOpen={!!workspaceToDelete}
        onClose={() => setWorkspaceToDelete(null)}
        onConfirm={confirmDeleteWorkspace}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace and all its chats? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <RenameModal
        isOpen={!!chatToRename}
        onClose={() => setChatToRename(null)}
        onSave={handleSaveRename}
        currentTitle={chatToRename?.title || ''}
        isLoading={updateChat.isPending}
      />

      <RenameModal
        isOpen={!!workspaceToRename}
        onClose={() => setWorkspaceToRename(null)}
        onSave={handleSaveWorkspaceRename}
        currentTitle={workspaceToRename?.name || ''}
        isLoading={updateWorkspace.isPending}
      />
    </>
  );
}
