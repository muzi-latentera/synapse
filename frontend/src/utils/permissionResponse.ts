import { usePermissionStore } from '@/store/permissionStore';
import { addResolvedRequestId } from '@/utils/permissionStorage';

type ApiError = Error & { status?: number };

function isExpiredRequestError(error: unknown): boolean {
  return (error as ApiError)?.status === 404;
}

// Wraps a permission service call with standard loading/error/cleanup behavior:
// on success or 404 (expired), marks the request resolved and clears the pending
// state; on other errors, sets the provided error message.
export async function executePermissionResponse(
  requestId: string,
  serviceFn: () => Promise<void>,
  opts: {
    setIsLoading: (v: boolean) => void;
    setError: (v: string | null) => void;
    errorMessage: string;
    clearRequest: () => void;
  },
): Promise<'success' | 'expired' | 'error'> {
  opts.setIsLoading(true);
  opts.setError(null);
  try {
    await serviceFn();
    addResolvedRequestId(requestId);
    opts.clearRequest();
    return 'success';
  } catch (err) {
    if (isExpiredRequestError(err)) {
      // This request is already gone on the backend (timeout/session moved on),
      // so clear the local pending state but let the caller decide whether any
      // success-only UI transitions should still happen.
      addResolvedRequestId(requestId);
      opts.clearRequest();
      return 'expired';
    } else {
      opts.setError(err instanceof Error ? err.message : opts.errorMessage);
    }
  } finally {
    opts.setIsLoading(false);
  }
  return 'error';
}

export function clearPermissionRequestForChat(chatId: string): void {
  usePermissionStore.getState().clearPermissionRequest(chatId);
}
