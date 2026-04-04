import { useState, useCallback } from 'react';
import { permissionService } from '@/services/permissionService';
import { usePermissionStore } from '@/store/permissionStore';
import { useChatSettingsStore } from '@/store/chatSettingsStore';
import {
  executePermissionResponse,
  clearPermissionRequestForChat,
} from '@/utils/permissionResponse';

export function useExitPlanMode(chatId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingRequests = usePermissionStore((state) => state.pendingRequests);

  const pendingRequest = chatId ? (pendingRequests.get(chatId) ?? null) : null;
  const isExitPlanModeRequest = pendingRequest?.tool_name === 'ExitPlanMode';

  const handleApprove = useCallback(
    async (optionId: string) => {
      if (!chatId || !pendingRequest || !isExitPlanModeRequest) return;

      const result = await executePermissionResponse(
        pendingRequest.request_id,
        () => permissionService.respondToPermission(chatId, pendingRequest.request_id, optionId),
        {
          setIsLoading,
          setError,
          errorMessage: 'Failed to approve plan',
          clearRequest: () => clearPermissionRequestForChat(chatId),
        },
      );
      if (result === 'success' || result === 'expired') {
        const nextPermissionMode =
          pendingRequest.options.find((option) => option.option_id === optionId)?.permission_mode ??
          null;
        if (result === 'success' && nextPermissionMode) {
          useChatSettingsStore.getState().setPermissionMode(chatId, nextPermissionMode);
        }
        useChatSettingsStore.getState().setPlanMode(chatId, false);
      }
    },
    [chatId, pendingRequest, isExitPlanModeRequest],
  );

  const handleReject = useCallback(
    async (optionId: string, alternativeInstruction?: string) => {
      if (!chatId || !pendingRequest || !isExitPlanModeRequest) return;

      await executePermissionResponse(
        pendingRequest.request_id,
        () =>
          permissionService.respondToPermission(
            chatId,
            pendingRequest.request_id,
            optionId,
            alternativeInstruction,
          ),
        {
          setIsLoading,
          setError,
          errorMessage: 'Failed to reject plan',
          clearRequest: () => clearPermissionRequestForChat(chatId),
        },
      );
    },
    [chatId, pendingRequest, isExitPlanModeRequest],
  );

  return {
    pendingRequest: isExitPlanModeRequest ? pendingRequest : null,
    isLoading,
    error,
    handleApprove,
    handleReject,
  };
}
