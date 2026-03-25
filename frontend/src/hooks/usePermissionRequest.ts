import { useState, useCallback, useRef } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store/permissionStore';
import { addResolvedRequestId, isRequestResolved } from '@/utils/permissionStorage';
import { notifyPermissionRequest } from '@/utils/notifications';
import { useSettingsQuery } from '@/hooks/queries/useSettingsQueries';
import type { PermissionRequest } from '@/types/chat.types';

type ApiError = Error & { status?: number };

interface UsePermissionRequestReturn {
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

// Manages the tool-permission approval flow for a single chat. Reads the
// pending request from the global permission store, sends approve/reject
// responses to the backend, and auto-dismisses 404s (expired requests where
// the backend already timed out or the stream moved on).
export function usePermissionRequest(chatId: string | undefined): UsePermissionRequestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: settings } = useSettingsQuery();

  const pendingRequests = usePermissionStore((state) => state.pendingRequests);

  const pendingRequest = chatId ? (pendingRequests.get(chatId) ?? null) : null;
  const prevRequestIdRef = useRef(pendingRequest?.request_id);

  // Clear stale error when a new permission request arrives, so errors from
  // a previous request don't bleed into the new approval dialog.
  if (prevRequestIdRef.current !== pendingRequest?.request_id) {
    prevRequestIdRef.current = pendingRequest?.request_id;
    if (error !== null) setError(null);
  }

  const handlePermissionRequest = useCallback(
    (request: PermissionRequest) => {
      if (!chatId) return;
      if (isRequestResolved(request.request_id)) return;
      const existingRequest = usePermissionStore.getState().pendingRequests.get(chatId);
      if (existingRequest?.request_id === request.request_id) {
        return;
      }

      usePermissionStore.getState().setPermissionRequest(chatId, request);
      if (settings?.notifications_enabled ?? true) {
        void notifyPermissionRequest(request);
      }
    },
    [chatId, settings?.notifications_enabled],
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
