import { useEffect, useMemo, useCallback, useRef, ReactNode, lazy, Suspense } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { useLayoutSidebar } from '@/components/layout/layoutState';
import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { SplitViewContainer } from '@/components/ui/SplitViewContainer';
import { CommandMenu } from '@/components/ui/CommandMenu';
import { useCommandMenu } from '@/hooks/useCommandMenu';
import { useActiveViews } from '@/hooks/useActiveViews';
import { Spinner } from '@/components/ui/primitives/Spinner';
import type { ViewType } from '@/types/ui.types';
import { Chat as ChatComponent } from '@/components/chat/chat-window/Chat';
import { ChatSessionOrchestrator } from '@/components/chat/chat-window/ChatSessionOrchestrator';
import { useEditorState } from '@/hooks/useEditorState';
import { useChatData } from '@/hooks/useChatData';
import { useSandboxFiles } from '@/hooks/useSandboxFiles';
import {
  useWorkspacesQuery,
  useWorkspaceResourcesQuery,
} from '@/hooks/queries/useWorkspaceQueries';
import { useSettingsQuery } from '@/hooks/queries/useSettingsQueries';
import { mergeAgents, mergeByName, mergeCommands } from '@/utils/settings';
import { findFileByToolPath } from '@/utils/file';
import { ChatProvider } from '@/contexts/ChatContext';
import { CreateSubThreadDialog } from '@/components/chat/sub-threads/CreateSubThreadDialog';

const Editor = lazy(() =>
  import('@/components/editor/editor-core/Editor').then((m) => ({ default: m.Editor })),
);
const IDEView = lazy(() =>
  import('@/components/views/IDEView').then((m) => ({ default: m.IDEView })),
);
const SecretsView = lazy(() =>
  import('@/components/views/SecretsView').then((m) => ({ default: m.SecretsView })),
);
const WebPreviewView = lazy(() =>
  import('@/components/views/WebPreviewView').then((m) => ({ default: m.WebPreviewView })),
);
const MobilePreviewView = lazy(() =>
  import('@/components/views/MobilePreviewView').then((m) => ({ default: m.MobilePreviewView })),
);
const BrowserView = lazy(() =>
  import('@/components/views/BrowserView').then((m) => ({ default: m.BrowserView })),
);
const DiffView = lazy(() =>
  import('@/components/views/DiffView').then((m) => ({ default: m.DiffView })),
);
const TerminalContainer = lazy(() =>
  import('@/components/sandbox/terminal/Container').then((m) => ({ default: m.Container })),
);

const viewLoadingFallback = (
  <div className="flex h-full w-full items-center justify-center bg-surface-secondary dark:bg-surface-dark-secondary">
    <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
  </div>
);

export function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  useCommandMenu();
  const subThreadDialogOpen = useUIStore((s) => s.subThreadDialogOpen);

  const activeViews = useActiveViews();

  const { currentChat, fetchedMessages, hasFetchedMessages, messagesQuery } = useChatData(chatId);

  const { fileStructure, isFileMetadataLoading, refetchFilesMetadata } = useSandboxFiles(
    currentChat,
    chatId,
  );

  const worktreeCwd = currentChat?.worktree_cwd ?? undefined;

  const prevViewsRef = useRef<{
    views: ViewType[];
    sandboxId: string | null;
  }>({
    views: [],
    sandboxId: null,
  });

  useEffect(() => {
    if (!currentChat?.sandbox_id) return;

    const prev = prevViewsRef.current;
    const editorNowActive = activeViews.includes('editor');
    const editorWasActive = prev.views.includes('editor');
    const switchedSandbox = prev.sandboxId !== currentChat.sandbox_id;

    if ((editorNowActive && !editorWasActive) || (editorNowActive && switchedSandbox)) {
      refetchFilesMetadata();
    }

    prevViewsRef.current = {
      views: activeViews,
      sandboxId: currentChat.sandbox_id,
    };
  }, [activeViews, currentChat?.sandbox_id, refetchFilesMetadata]);

  const { data: workspacesData } = useWorkspacesQuery();
  const workspaces = workspacesData?.items ?? [];

  const { data: settings } = useSettingsQuery();

  const { data: workspaceResources } = useWorkspaceResourcesQuery(currentChat?.workspace_id);

  const allAgents = useMemo(
    () => mergeByName(mergeAgents(settings?.custom_agents), workspaceResources?.agents ?? []),
    [settings?.custom_agents, workspaceResources?.agents],
  );

  const enabledSlashCommands = useMemo(
    () =>
      mergeCommands(
        settings?.custom_slash_commands,
        settings?.custom_skills,
        workspaceResources?.commands,
        workspaceResources?.skills,
      ),
    [
      settings?.custom_slash_commands,
      settings?.custom_skills,
      workspaceResources?.commands,
      workspaceResources?.skills,
    ],
  );

  const personas = useMemo(() => settings?.personas ?? [], [settings?.personas]);

  const { selectedFile, setSelectedFile, isRefreshing, handleRefresh, handleFileSelect } =
    useEditorState(refetchFilesMetadata);

  const prevChatIdForResetRef = useRef(chatId);

  useEffect(() => {
    useChatStore.getState().setCurrentChat(currentChat || null);
  }, [currentChat]);

  if (prevChatIdForResetRef.current !== chatId) {
    prevChatIdForResetRef.current = chatId;
    setSelectedFile(null);
    useUIStore.getState().setCurrentView('agent');
    useUIStore.setState({ pendingFilePath: null, subThreadDialogOpen: false });
  }

  const pendingFilePath = useUIStore((s) => s.pendingFilePath);

  useEffect(() => {
    if (!pendingFilePath || fileStructure.length === 0) return;

    const file = findFileByToolPath(fileStructure, pendingFilePath);
    setSelectedFile(file ?? { path: pendingFilePath, type: 'file', content: '' });
    useUIStore.setState({ pendingFilePath: null });
  }, [pendingFilePath, setSelectedFile, fileStructure]);

  const handleChatSelect = useCallback(
    (selectedChatId: string) => {
      navigate(`/chat/${selectedChatId}`);
    },
    [navigate],
  );

  const sidebarContent = useMemo(() => {
    if (!activeViews.includes('agent')) return null;
    return (
      <Sidebar
        workspaces={workspaces}
        selectedChatId={chatId || null}
        selectedChatWorkspaceId={currentChat?.workspace_id}
        selectedChatParentId={currentChat?.parent_chat_id}
        onChatSelect={handleChatSelect}
      />
    );
  }, [
    activeViews,
    workspaces,
    chatId,
    currentChat?.workspace_id,
    currentChat?.parent_chat_id,
    handleChatSelect,
  ]);

  useLayoutSidebar(sidebarContent);

  const renderNonTerminalView = useCallback(
    (view: ViewType): ReactNode => {
      switch (view) {
        case 'agent':
          return <ChatComponent />;
        case 'editor':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <Editor
                files={fileStructure}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                currentChat={currentChat}
                isSandboxSyncing={isFileMetadataLoading}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />
            </Suspense>
          );
        case 'ide':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <IDEView sandboxId={currentChat?.sandbox_id} isActive={true} />
            </Suspense>
          );
        case 'secrets':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <SecretsView sandboxId={currentChat?.sandbox_id} />
            </Suspense>
          );
        case 'webPreview':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <WebPreviewView sandboxId={currentChat?.sandbox_id} isActive={true} />
            </Suspense>
          );
        case 'mobilePreview':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <MobilePreviewView sandboxId={currentChat?.sandbox_id} />
            </Suspense>
          );
        case 'browser':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <BrowserView sandboxId={currentChat?.sandbox_id} isActive={true} />
            </Suspense>
          );
        case 'diff':
          return (
            <Suspense fallback={viewLoadingFallback}>
              <DiffView sandboxId={currentChat?.sandbox_id} cwd={worktreeCwd} />
            </Suspense>
          );
        default:
          return null;
      }
    },
    [
      chatId,
      currentChat,
      fileStructure,
      selectedFile,
      handleFileSelect,
      isFileMetadataLoading,
      handleRefresh,
      isRefreshing,
      worktreeCwd,
    ],
  );

  const renderView = useCallback(
    (view: ViewType, slot: string): ReactNode => {
      const isTerminal = view === 'terminal';
      return (
        <div className="relative flex h-full w-full">
          <div className={isTerminal ? 'flex h-full w-full' : 'hidden'}>
            <Suspense fallback={viewLoadingFallback}>
              <TerminalContainer
                sandboxId={currentChat?.sandbox_id}
                chatId={currentChat?.id}
                isVisible={isTerminal}
                panelKey={slot}
              />
            </Suspense>
          </div>
          <div className={isTerminal ? 'hidden' : 'flex h-full w-full'}>
            {renderNonTerminalView(view)}
          </div>
        </div>
      );
    },
    [currentChat, renderNonTerminalView],
  );

  if (!chatId) return <Navigate to="/" />;

  return (
    <ChatProvider
      chatId={chatId}
      sandboxId={currentChat?.sandbox_id}
      parentChatId={currentChat?.parent_chat_id ?? undefined}
      fileStructure={fileStructure}
      customAgents={allAgents}
      customSlashCommands={enabledSlashCommands}
      personas={personas}
    >
      <ChatSessionOrchestrator
        chatId={chatId}
        currentChat={currentChat}
        fetchedMessages={fetchedMessages}
        hasFetchedMessages={hasFetchedMessages}
        messagesQuery={messagesQuery}
        refetchFilesMetadata={refetchFilesMetadata}
      >
        <div className="relative flex h-full">
          <div className="flex h-full flex-1 overflow-hidden bg-surface text-text-primary dark:bg-surface-dark dark:text-text-dark-primary">
            <SplitViewContainer renderView={renderView} />
          </div>
          <CommandMenu />
          {subThreadDialogOpen && currentChat && !currentChat.parent_chat_id && (
            <CreateSubThreadDialog
              parentChat={currentChat}
              onClose={() => useUIStore.getState().setSubThreadDialogOpen(false)}
            />
          )}
        </div>
      </ChatSessionOrchestrator>
    </ChatProvider>
  );
}
