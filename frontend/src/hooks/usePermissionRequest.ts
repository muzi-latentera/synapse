import { useState, useCallback, useRef } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store/permissionStore';
import { isRequestResolved } from '@/utils/permissionStorage';
import { notifyPermissionRequest } from '@/utils/notifications';
import { useSettingsQuery } from '@/hooks/queries/useSettingsQueries';
import {
  executePermissionResponse,
  clearPermissionRequestForChat,
} from '@/utils/permissionResponse';
import type { PermissionRequest } from '@/types/chat.types';

interface UsePermissionRequestReturn {
  pendingRequest: PermissionRequest | null;
  isLoading: boolean;
  error: string | null;
  handlePermissionRequest: (request: PermissionRequest) => void;
  handleApprove: (optionId: string) => Promise<void>;
  handleReject: (optionId: string) => Promise<void>;
}

// Manages the tool-permission approval flow for a single chat. Reads the
// pending request from the global permission store, sends approve/reject
// responses to the backend, and auto-dismisses 404s (expired requests where
// the backend already timed out or the stream moved on).
export function usePermissionRequest(chatId: string | undefined): UsePermissionRequestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: settings } = useSettingsQuery();

  // Select only this chat's request to avoid re-renders from other chats' permission changes
  const pendingRequest = usePermissionStore((state) =>
    chatId ? (state.pendingRequests.get(chatId) ?? null) : null,
  );
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

  const handleApprove = useCallback(
    async (optionId: string) => {
      if (!chatId || !pendingRequest) return;

      await executePermissionResponse(
        pendingRequest.request_id,
        () => permissionService.respondToPermission(chatId, pendingRequest.request_id, optionId),
        {
          setIsLoading,
          setError,
          errorMessage: 'Failed to approve permission',
          clearRequest: () => clearPermissionRequestForChat(chatId),
        },
      );
    },
    [chatId, pendingRequest],
  );

  const handleReject = useCallback(
    async (optionId: string) => {
      if (!chatId || !pendingRequest) return;

      await executePermissionResponse(
        pendingRequest.request_id,
        () => permissionService.respondToPermission(chatId, pendingRequest.request_id, optionId),
        {
          setIsLoading,
          setError,
          errorMessage: 'Failed to reject permission',
          clearRequest: () => clearPermissionRequestForChat(chatId),
        },
      );
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
