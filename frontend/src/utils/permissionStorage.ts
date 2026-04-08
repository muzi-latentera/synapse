import type { PermissionOption } from '@/types/chat.types';

export function filterOptions(
  options: PermissionOption[],
  prefix: 'allow' | 'reject',
): PermissionOption[] {
  return options.filter((o) => o.kind.startsWith(prefix));
}

// Tracks recently resolved permission request IDs in localStorage so that
// duplicate SSE permission_request envelopes (e.g., after reconnection) are
// silently ignored instead of re-showing the approval dialog. Capped at 100
// entries to bound storage usage.
const RESOLVED_REQUESTS_KEY = 'agentrove_resolved_permission_requests';
const MAX_RESOLVED_REQUESTS = 100;

function getResolvedRequestIds(): Set<string> {
  try {
    const stored = localStorage.getItem(RESOLVED_REQUESTS_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function addResolvedRequestId(requestId: string): void {
  try {
    const resolved = getResolvedRequestIds();
    resolved.add(requestId);
    const arr = Array.from(resolved);
    if (arr.length > MAX_RESOLVED_REQUESTS) {
      arr.splice(0, arr.length - MAX_RESOLVED_REQUESTS);
    }
    localStorage.setItem(RESOLVED_REQUESTS_KEY, JSON.stringify(arr));
  } catch {
    // Ignore localStorage errors
  }
}

export function isRequestResolved(requestId: string): boolean {
  return getResolvedRequestIds().has(requestId);
}
