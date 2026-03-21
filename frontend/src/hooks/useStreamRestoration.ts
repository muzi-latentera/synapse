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

    const restoreStreamMetadata = async () => {
      const chatsToCheck = chats.slice(0, 20);

      const checkAndRestore = async (chatId: string) => {
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

      const checkPromises = chatsToCheck
        .filter((chat) => chat?.id)
        .map((chat) => checkAndRestore(chat.id));

      // Fetch sub-threads for parents that have them and check each for active
      // streams. This fans out into N additional requests per parent — acceptable
      // for a single-user app. A bulk active-streams endpoint would reduce this.
      const subThreadPromises = chatsToCheck
        .filter((chat) => chat?.id && (chat.sub_thread_count ?? 0) > 0)
        .map(async (chat) => {
          try {
            const subThreads = await chatService.getSubThreads(chat.id);
            await Promise.allSettled(subThreads.map((sub) => checkAndRestore(sub.id)));
          } catch (error) {
            logger.error('Failed to restore sub-thread streams', 'useStreamRestoration', {
              chatId: chat.id,
              error,
            });
          }
        });

      await Promise.allSettled([...checkPromises, ...subThreadPromises]);
    };

    restoreStreamMetadata().catch((error) => {
      logger.error('Stream restoration failed', 'useStreamRestoration', error);
    });
  }, [chats, isLoading, enabled]);

  return { hasRestored: hasRestoredRef.current };
}
