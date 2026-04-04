import { useState, useCallback } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store/permissionStore';
import { findOptionId, findOptionIdByKind } from '@/utils/permissionStorage';
import {
  executePermissionResponse,
  clearPermissionRequestForChat,
} from '@/utils/permissionResponse';

export function useUserQuestion(chatId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequests = usePermissionStore((state) => state.pendingRequests);

  const pendingRequest = chatId ? (pendingRequests.get(chatId) ?? null) : null;
  const isAskUserQuestion = pendingRequest?.tool_name === 'AskUserQuestion';

  const handleSubmitAnswers = useCallback(
    async (answers: Record<string, string | string[]>) => {
      if (!chatId || !pendingRequest) return;

      const allowOptionId =
        findOptionIdByKind(pendingRequest.options, 'allow_once') ||
        findOptionId(pendingRequest.options, 'allow');
      await executePermissionResponse(
        pendingRequest.request_id,
        () =>
          permissionService.respondWithAnswers(
            chatId,
            pendingRequest.request_id,
            allowOptionId,
            answers,
          ),
        {
          setIsLoading,
          setError,
          errorMessage: 'Failed to submit answers. Please try again.',
          clearRequest: () => clearPermissionRequestForChat(chatId),
        },
      );
    },
    [chatId, pendingRequest],
  );

  const handleCancel = useCallback(async () => {
    if (!chatId || !pendingRequest) return;

    const rejectOptionId = findOptionId(pendingRequest.options, 'reject');
    await executePermissionResponse(
      pendingRequest.request_id,
      () =>
        permissionService.respondToPermission(chatId, pendingRequest.request_id, rejectOptionId),
      {
        setIsLoading,
        setError,
        errorMessage: 'Failed to cancel. Please try again.',
        clearRequest: () => clearPermissionRequestForChat(chatId),
      },
    );
  }, [chatId, pendingRequest]);

  return {
    pendingRequest: isAskUserQuestion ? pendingRequest : null,
    isLoading,
    error,
    handleSubmitAnswers,
    handleCancel,
  };
}
