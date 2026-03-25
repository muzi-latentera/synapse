import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';
import { useStreamStore } from '@/store/streamStore';
import { streamService } from '@/services/streamService';
import { chatService } from '@/services/chatService';

interface UseGlobalStreamOptions {
  enabled?: boolean;
  onPruneComplete?: () => void;
}

// On app mount, reconciles the in-memory stream store with the server — streams
// tracked locally (e.g., across a page refresh) but no longer active on the
// backend get pruned so the UI doesn't show stale "streaming" indicators.
export function useGlobalStream(options?: UseGlobalStreamOptions) {
  const hasPrunedRef = useRef(false);
  const enabled = options?.enabled ?? true;
  const onPruneComplete = options?.onPruneComplete;

  useEffect(() => {
    if (!enabled) return;
    if (hasPrunedRef.current) return;
    hasPrunedRef.current = true;

    const pruneStaleStreams = async () => {
      const metadata = useStreamStore.getState().activeStreamMetadata;

      if (metadata.length === 0) return;

      const prunePromises = metadata.map(async (streamMeta) => {
        try {
          const status = await chatService.checkChatStatus(streamMeta.chatId);

          if (!status?.has_active_task) {
            useStreamStore.getState().removeStreamMetadata(streamMeta.chatId);
          }
        } catch (error) {
          logger.error('Stream prune check failed', 'useGlobalStream', error);
          useStreamStore.getState().removeStreamMetadata(streamMeta.chatId);
        }
      });

      await Promise.allSettled(prunePromises);
      onPruneComplete?.();
    };

    const timeoutId = setTimeout(pruneStaleStreams, 500);

    return () => clearTimeout(timeoutId);
  }, [enabled, onPruneComplete]);

  const stopAllStreams = useCallback(async () => {
    await streamService.stopAllStreams();
  }, []);

  return {
    stopAllStreams,
  };
}
