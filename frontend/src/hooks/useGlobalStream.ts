import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';
import { useStreamStore } from '@/store/streamStore';
import { streamService } from '@/services/streamService';
import { chatService } from '@/services/chatService';

interface UseGlobalStreamOptions {
  enabled?: boolean;
  onValidationComplete?: () => void;
}

export function useGlobalStream(options?: UseGlobalStreamOptions) {
  const hasValidatedRef = useRef(false);
  const enabled = options?.enabled ?? true;
  const onValidationComplete = options?.onValidationComplete;

  useEffect(() => {
    if (!enabled) return;
    if (hasValidatedRef.current) return;
    hasValidatedRef.current = true;

    const validateStreams = async () => {
      const metadata = useStreamStore.getState().activeStreamMetadata;

      if (metadata.length === 0) return;

      const validationPromises = metadata.map(async (streamMeta) => {
        try {
          const status = await chatService.checkChatStatus(streamMeta.chatId);

          if (!status?.has_active_task) {
            useStreamStore.getState().removeStreamMetadata(streamMeta.chatId);
          }
        } catch (error) {
          logger.error('Stream validation failed', 'useGlobalStream', error);
          useStreamStore.getState().removeStreamMetadata(streamMeta.chatId);
        }
      });

      await Promise.allSettled(validationPromises);
      onValidationComplete?.();
    };

    const timeoutId = setTimeout(validateStreams, 500);

    return () => clearTimeout(timeoutId);
  }, [enabled, onValidationComplete]);

  const stopAllStreams = useCallback(async () => {
    await streamService.stopAllStreams();
  }, []);

  return {
    stopAllStreams,
  };
}
