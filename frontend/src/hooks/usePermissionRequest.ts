import { useState, useCallback, useEffect } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store/permissionStore';
import { addResolvedRequestId, isRequestResolved } from '@/utils/permissionStorage';
import type { PermissionRequest } from '@/types/chat.types';

type ApiError = Error & { status?: number };

export interface UsePermissionRequestReturn {
  pendingRequest: PermissionRequest | null;
  isLoading: boolean;
  error: string | null;
  handlePermissionRequest: (request: PermissionRequest) => void;
  handleApprove: () => Promise<void>;
  handleReject: (alternativeInstruction?: string) => Promise<void>;
}

function isExpiredRequestError(error: unknown): boolean {
  return (error as ApiError)?.status === 404;
}

export function usePermissionRequest(chatId: string | undefined): UsePermissionRequestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRequests = usePermissionStore((state) => state.pendingRequests);

  const pendingRequest = chatId ? (pendingRequests.get(chatId) ?? null) : null;

  useEffect(() => {
    setError(null);
  }, [pendingRequest?.request_id]);

  const handlePermissionRequest = useCallback(
    (request: PermissionRequest) => {
      if (!chatId) return;
      if (isRequestResolved(request.request_id)) return;
      usePermissionStore.getState().setPermissionRequest(chatId, request);
    },
    [chatId],
  );

  const handleApprove = useCallback(async () => {
    if (!chatId || !pendingRequest) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await permissionService.respondToPermission(chatId, pendingRequest.request_id, true);
      addResolvedRequestId(pendingRequest.request_id);
      usePermissionStore.getState().clearPermissionRequest(chatId);
    } catch (err) {
      if (isExpiredRequestError(err)) {
        addResolvedRequestId(pendingRequest.request_id);
        usePermissionStore.getState().clearPermissionRequest(chatId);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to approve permission');
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatId, pendingRequest]);

  const handleReject = useCallback(
    async (alternativeInstruction?: string) => {
      if (!chatId || !pendingRequest) {
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        await permissionService.respondToPermission(
          chatId,
          pendingRequest.request_id,
          false,
          alternativeInstruction,
        );
        addResolvedRequestId(pendingRequest.request_id);
        usePermissionStore.getState().clearPermissionRequest(chatId);
      } catch (err) {
        if (isExpiredRequestError(err)) {
          addResolvedRequestId(pendingRequest.request_id);
          usePermissionStore.getState().clearPermissionRequest(chatId);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to reject permission');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, pendingRequest],
  );

  return {
    pendingRequest,
    isLoading,
    error,
    handlePermissionRequest,
    handleApprove,
    handleReject,
  };
}
