import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  memo,
  useMemo,
  type ReactNode,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { isBrowserObjectUrl } from '@/utils/attachmentUrl';
import { UserMessage, AssistantMessage } from '@/components/chat/message-bubble/Message';
import { QueueMessageCard } from './QueueMessageCard';
import { Input } from '@/components/chat/message-input/Input';
import { ChatSkeleton } from './ChatSkeleton';
import { ScrollButton } from './ScrollButton';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ErrorMessage } from './ErrorMessage';
import { Spinner } from '@/components/ui/primitives/Spinner';
import { useStreamStore } from '@/store/streamStore';
import { useMessageQueueStore, EMPTY_QUEUE } from '@/store/messageQueueStore';
import { ToolPermissionInline } from '@/components/chat/tools/ToolPermissionInline';
import { useChatContext } from '@/hooks/useChatContext';
import {
  useChatSessionContext,
  useChatSessionState,
  useChatSessionActions,
} from '@/hooks/useChatSessionContext';
import { useChatInputMessageContext } from '@/hooks/useChatInputMessageContext';

const AT_BOTTOM_THRESHOLD_PX = 200;
const INITIAL_FIRST_ITEM_INDEX = 1_000_000;
const TOP_PAGINATION_ARM_VIEWPORT_MULTIPLIER = 1.5;

const MessageInlinePermission = memo(function MessageInlinePermission() {
  const state = useChatSessionState();
  const actions = useChatSessionActions();

  if (
    !state.pendingPermissionRequest ||
    state.pendingPermissionRequest.tool_name === 'AskUserQuestion' ||
    state.pendingPermissionRequest.tool_name === 'ExitPlanMode'
  ) {
    return null;
  }

  return (
    <div className="px-4 sm:px-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="h-8 w-8 flex-shrink-0" />
        <div className="mb-3 mt-1 min-w-0 flex-1">
          <ToolPermissionInline
            request={state.pendingPermissionRequest}
            onApprove={actions.onPermissionApprove}
            onReject={actions.onPermissionReject}
            isLoading={state.isPermissionLoading}
            error={state.permissionError}
          />
        </div>
      </div>
    </div>
  );
});

interface VirtuosoContextValue {
  header: ReactNode;
  footer: ReactNode;
}

export const Chat = memo(function Chat() {
  const { chatId } = useChatContext();
  const { state, actions } = useChatSessionContext();

  const {
    messages,
    pendingUserMessageId,
    isLoading,
    isStreaming,
    isInitialLoading,
    error,
    attachedFiles,
    selectedModelId,
    contextUsage,
    hasNextPage,
    isFetchingNextPage,
    pendingPermissionRequest,
  } = state;

  const { onSubmit, onStopStream, onAttach, onModelChange, onDismissError, fetchNextPage } =
    actions;

  const { inputMessage, setInputMessage } = useChatInputMessageContext();

  const { activeStreams, streamIdByChatMessage } = useStreamStore(
    useShallow((s) => ({
      activeStreams: s.activeStreams,
      streamIdByChatMessage: s.streamIdByChatMessage,
    })),
  );
  const streamingMessageIdSet = useMemo(() => {
    const ids = new Set<string>();
    if (!chatId) return ids;

    for (const streamId of streamIdByChatMessage.values()) {
      const stream = activeStreams.get(streamId);
      if (stream?.chatId === chatId && stream.isActive) {
        ids.add(stream.messageId);
      }
    }

    return ids;
  }, [activeStreams, chatId, streamIdByChatMessage]);

  const pendingMessages = useMessageQueueStore((storeState) =>
    chatId ? (storeState.queues.get(chatId) ?? EMPTY_QUEUE) : EMPTY_QUEUE,
  );

  useEffect(() => {
    if (chatId) {
      void useMessageQueueStore.getState().fetchQueue(chatId);
    }
  }, [chatId]);

  const handleCancelPending = useCallback(() => {
    if (chatId) {
      useMessageQueueStore.getState().clearAndSync(chatId);
    }
  }, [chatId]);

  const handleEditPending = useCallback(
    (newContent: string) => {
      if (chatId) {
        useMessageQueueStore.getState().updateQueuedMessage(chatId, newContent);
      }
    },
    [chatId],
  );

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const hasInitializedToBottomRef = useRef(false);
  const topPaginationArmedRef = useRef(false);
  const lastScrollTopRef = useRef<number | null>(null);
  const lastPaginatedMessageIdRef = useRef<string | null>(null);
  const prependAnchorMessageIdRef = useRef<string | null>(null);

  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    hasInitializedToBottomRef.current = false;
    topPaginationArmedRef.current = false;
    lastScrollTopRef.current = null;
    lastPaginatedMessageIdRef.current = null;
    prependAnchorMessageIdRef.current = null;
    setShowScrollButton(false);
    setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
  }, [chatId]);

  useEffect(() => {
    const prependAnchorId = prependAnchorMessageIdRef.current;
    if (!prependAnchorId || isFetchingNextPage) {
      return;
    }

    if (chatId && messages.length > 0 && messages[0]?.chat_id !== chatId) {
      return;
    }

    const anchorIndexInCurrent = messages.findIndex((message) => message.id === prependAnchorId);
    if (anchorIndexInCurrent > 0) {
      setFirstItemIndex((currentIndex) => currentIndex - anchorIndexInCurrent);
    }

    prependAnchorMessageIdRef.current = null;
    lastPaginatedMessageIdRef.current = null;
  }, [chatId, isFetchingNextPage, messages]);

  const setVirtualScrollerRef = useCallback((ref: HTMLElement | null | Window) => {
    if (ref instanceof HTMLElement) {
      scrollerRef.current = ref;
      lastScrollTopRef.current = ref.scrollTop;
      setScrollerElement(ref);
      return;
    }

    scrollerRef.current = null;
    lastScrollTopRef.current = null;
    setScrollerElement(null);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollerRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;

    if (!hasInitializedToBottomRef.current) {
      lastScrollTopRef.current = scrollTop;
      return;
    }

    const isScrollingUp = lastScrollTopRef.current !== null && scrollTop < lastScrollTopRef.current;
    const isNearTop = scrollTop <= clientHeight * TOP_PAGINATION_ARM_VIEWPORT_MULTIPLIER;

    if (!topPaginationArmedRef.current && isScrollingUp && isNearTop) {
      topPaginationArmedRef.current = true;
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    if (!scrollerElement) return;

    scrollerElement.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollerElement.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, scrollerElement]);

  const scrollToBottom = useCallback(() => {
    setShowScrollButton(false);
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      align: 'end',
      behavior: 'smooth',
    });
  }, []);

  const followOutput = useCallback(
    (isAtBottom: boolean) => {
      if (isStreaming && isAtBottom) {
        return 'auto';
      }

      return false;
    },
    [isStreaming],
  );

  const handleAtBottomStateChange = useCallback((isAtBottom: boolean) => {
    setShowScrollButton(!isAtBottom);

    if (isAtBottom) {
      hasInitializedToBottomRef.current = true;
    }
  }, []);

  const handleStartReached = useCallback(() => {
    if (
      !topPaginationArmedRef.current ||
      !hasInitializedToBottomRef.current ||
      !hasNextPage ||
      isFetchingNextPage ||
      !fetchNextPage
    ) {
      return;
    }

    const firstMessageId = messages[0]?.id;
    if (!firstMessageId || lastPaginatedMessageIdRef.current === firstMessageId) {
      return;
    }

    topPaginationArmedRef.current = false;
    lastPaginatedMessageIdRef.current = firstMessageId;
    prependAnchorMessageIdRef.current = firstMessageId;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, messages]);

  const { lastBotMessage, latestUserMessageId } = useMemo(() => {
    let latestAssistantMessage: (typeof messages)[number] | undefined;
    let latestUserId: string | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const isAssistantMessage = message.is_bot ?? message.role === 'assistant';

      if (!latestAssistantMessage && isAssistantMessage) {
        latestAssistantMessage = message;
      }

      if (latestUserId === null && !isAssistantMessage) {
        latestUserId = message.id;
      }

      if (latestAssistantMessage && latestUserId !== null) {
        break;
      }
    }

    return {
      lastBotMessage: latestAssistantMessage,
      latestUserMessageId: latestUserId,
    };
  }, [messages]);

  const lastBotMessageId = lastBotMessage?.id ?? null;

  const canShowPermissionInline =
    pendingPermissionRequest &&
    pendingPermissionRequest.tool_name !== 'AskUserQuestion' &&
    pendingPermissionRequest.tool_name !== 'ExitPlanMode';
  const lastBotIsStreaming = !!lastBotMessageId && streamingMessageIdSet.has(lastBotMessageId);
  const lastBotHasContent =
    !!lastBotMessage &&
    ((lastBotMessage.content_render?.events?.length ?? 0) > 0 || !!lastBotMessage.content_text);
  const showPermissionAtEnd = canShowPermissionInline && (!lastBotMessageId || lastBotIsStreaming);

  const renderMessage = useCallback(
    (_index: number, msg: (typeof messages)[number]) => {
      const messageIsStreaming = streamingMessageIdSet.has(msg.id);
      const isBotMessage = msg.is_bot ?? msg.role === 'assistant';
      const isLastBotMessage = isBotMessage && msg.id === lastBotMessageId;
      const localAttachmentIds =
        msg.attachments?.reduce<string[]>((acc, attachment) => {
          if (isBrowserObjectUrl(attachment.file_url)) acc.push(attachment.id);
          return acc;
        }, []) ?? [];
      const isLatestUserMessage = !isBotMessage && msg.id === latestUserMessageId;
      const shouldShowUploadingOverlay =
        localAttachmentIds.length > 0 &&
        (pendingUserMessageId === msg.id ||
          (isLatestUserMessage && (pendingUserMessageId !== null || isLoading)));
      const uploadingAttachmentIds = shouldShowUploadingOverlay ? localAttachmentIds : undefined;

      return (
        <div className="w-full lg:mx-auto lg:max-w-3xl">
          {isBotMessage ? (
            <AssistantMessage
              id={msg.id}
              contentText={msg.content_text}
              contentRender={msg.content_render}
              attachments={msg.attachments}
              isStreaming={messageIsStreaming}
              createdAt={msg.created_at}
              modelId={msg.model_id}
              isLastBotMessageWithCommit={isLastBotMessage}
              isLastBotMessage={isLastBotMessage && !messageIsStreaming}
            />
          ) : (
            <UserMessage
              contentRender={msg.content_render}
              attachments={msg.attachments}
              uploadingAttachmentIds={uploadingAttachmentIds}
              isStreaming={messageIsStreaming}
            />
          )}
          {isLastBotMessage && !messageIsStreaming && <MessageInlinePermission />}
        </div>
      );
    },
    [isLoading, lastBotMessageId, latestUserMessageId, pendingUserMessageId, streamingMessageIdSet],
  );

  const listHeader = useMemo(() => {
    if (!hasNextPage) {
      return null;
    }

    return (
      <div className="w-full lg:mx-auto lg:max-w-3xl">
        <div className="flex h-4 items-center justify-center p-4">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-dark-secondary">
              <Spinner size="xs" />
              Loading older messages...
            </div>
          )}
        </div>
      </div>
    );
  }, [hasNextPage, isFetchingNextPage]);

  const showThinking = isLoading || (isStreaming && !lastBotHasContent);

  const listFooter = useMemo(() => {
    if (!showThinking && !showPermissionAtEnd && !error) {
      return null;
    }

    return (
      <div className="w-full lg:mx-auto lg:max-w-3xl">
        {showThinking && <ThinkingIndicator />}
        {showPermissionAtEnd && <MessageInlinePermission />}
        {error && <ErrorMessage error={error} onDismiss={onDismissError} />}
      </div>
    );
  }, [error, onDismissError, showPermissionAtEnd, showThinking]);

  const virtuosoContext = useMemo<VirtuosoContextValue>(
    () => ({ header: listHeader, footer: listFooter }),
    [listFooter, listHeader],
  );

  const virtuosoComponents = useMemo(
    () => ({
      Header: ({ context }: { context: VirtuosoContextValue }) => <>{context.header}</>,
      Footer: ({ context }: { context: VirtuosoContextValue }) => <>{context.footer}</>,
    }),
    [],
  );

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-hidden">
        {isInitialLoading && messages.length === 0 ? (
          <ChatSkeleton messageCount={3} className="py-4" />
        ) : (
          <Virtuoso
            key={chatId ?? 'chat'}
            ref={virtuosoRef}
            className="scrollbar-thin scrollbar-thumb-border-secondary dark:scrollbar-thumb-border-dark hover:scrollbar-thumb-text-quaternary dark:hover:scrollbar-thumb-border-dark-hover scrollbar-track-transparent h-full overflow-y-auto overflow-x-hidden"
            data={messages}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={{ index: 'LAST', align: 'end' }}
            atBottomThreshold={AT_BOTTOM_THRESHOLD_PX}
            context={virtuosoContext}
            computeItemKey={(_index, msg) => msg.id}
            itemContent={renderMessage}
            startReached={handleStartReached}
            followOutput={followOutput}
            atBottomStateChange={handleAtBottomStateChange}
            scrollerRef={setVirtualScrollerRef}
            components={virtuosoComponents}
          />
        )}
      </div>
      <div className="relative">
        {showScrollButton && <ScrollButton onClick={scrollToBottom} />}

        <div className="relative bg-surface pb-safe dark:bg-surface-dark">
          <div className="relative w-full py-2 lg:mx-auto lg:max-w-3xl">
            {pendingMessages.length > 0 && (
              <div className="relative z-0 -mb-6 px-10 sm:px-14">
                <div className="flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border/50 bg-surface-secondary pb-6 dark:border-border-dark/50 dark:bg-surface-dark-secondary">
                  {pendingMessages.map((pending) => (
                    <QueueMessageCard
                      key={pending.id}
                      message={pending}
                      onCancel={handleCancelPending}
                      onEdit={handleEditPending}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="relative z-10">
              <Input
                message={inputMessage}
                setMessage={setInputMessage}
                onSubmit={onSubmit}
                onAttach={onAttach}
                attachedFiles={attachedFiles}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onStopStream={onStopStream}
                selectedModelId={selectedModelId}
                onModelChange={onModelChange}
                dropdownPosition="top"
                showAttachedFilesPreview={true}
                contextUsage={contextUsage}
                showTip={false}
                chatId={chatId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
