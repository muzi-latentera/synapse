import { useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';
import { useStreamStore } from '@/store/streamStore';
import type { Chat } from '@/types/chat.types';
import type { StreamMetadata } from '@/types/stream.types';
import { chatService } from '@/services/chatService';

interface UseStreamRestorationOptions {
  chats: Chat[] | undefined;
  isLoading: boolean;
  enabled?: boolean;
}

// After the chat list loads, writes StreamMetadata entries for any chat (or
// sub-thread) with an active backend task so the sidebar can show streaming
// indicators without waiting for the user to open each chat. Checks the 20
// most recent chats to keep the fan-out bounded.
export function useStreamRestoration({
  chats,
  isLoading,
  enabled = true,
}: UseStreamRestorationOptions) {
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasRestoredRef.current || isLoading || !chats || chats.length === 0) {
      return;
    }

    hasRestoredRef.current = true;

    const discoverActiveStreams = async () => {
      const chatsToCheck = chats.slice(0, 20);

      const checkAndRegister = async (chatId: string) => {
        try {
          const status = await chatService.checkChatStatus(chatId);
          if (status?.has_active_task && status.message_id) {
            const metadata: StreamMetadata = {
              chatId,
              messageId: status.message_id,
              startTime: Date.now(),
            };
            useStreamStore.getState().addStreamMetadata(metadata);
          }
        } catch (error) {
          logger.error('Failed to check chat status', 'useStreamRestoration', {
            chatId,
            error,
          });
        }
      };

      const chatCheckPromises = chatsToCheck
        .filter((chat) => chat?.id)
        .map((chat) => checkAndRegister(chat.id));

      // Fetch sub-threads for parents that have them and check each for active
      // streams. This fans out into N additional requests per parent — acceptable
      // for a single-user app. A bulk active-streams endpoint would reduce this.
      const subThreadPromises = chatsToCheck
        .filter((chat) => chat?.id && (chat.sub_thread_count ?? 0) > 0)
        .map(async (chat) => {
          try {
            const subThreads = await chatService.getSubThreads(chat.id);
            await Promise.allSettled(subThreads.map((sub) => checkAndRegister(sub.id)));
          } catch (error) {
            logger.error('Failed to restore sub-thread streams', 'useStreamRestoration', {
              chatId: chat.id,
              error,
            });
          }
        });

      await Promise.allSettled([...chatCheckPromises, ...subThreadPromises]);
    };

    discoverActiveStreams().catch((error) => {
      logger.error('Stream restoration failed', 'useStreamRestoration', error);
    });
  }, [chats, isLoading, enabled]);

  return { hasRestored: hasRestoredRef.current };
}
