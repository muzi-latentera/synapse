import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import type { ApprovalState } from '@/hooks/useApprovalState';

export { useApprovalState } from '@/hooks/useApprovalState';
export type { ApprovalState } from '@/hooks/useApprovalState';

interface ApprovalTextareaProps {
  state: ApprovalState;
  textareaId: string;
  isLoading: boolean;
}

export function ApprovalTextarea({ state, textareaId, isLoading }: ApprovalTextareaProps) {
  if (!state.showRejectInput) return null;

  return (
    <div className="mt-3">
      <label
        htmlFor={textareaId}
        className="text-2xs font-medium uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary"
      >
        Alternative Instructions
      </label>
      <textarea
        id={textareaId}
        value={state.alternativeInstruction}
        onChange={(e) => state.setAlternativeInstruction(e.target.value)}
        placeholder="Tell the assistant what to do instead\u2026"
        className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder-text-quaternary transition-colors focus:border-text-quaternary focus:outline-none focus:ring-1 focus:ring-text-quaternary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark-primary dark:placeholder-text-dark-tertiary"
        rows={2}
        disabled={isLoading}
        autoFocus
      />
    </div>
  );
}

interface ApprovalButtonsProps {
  state: ApprovalState;
  onApprove: () => void;
  isLoading: boolean;
  error: string | null;
}

export function ApprovalButtons({ state, onApprove, isLoading, error }: ApprovalButtonsProps) {
  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2 dark:border-border-dark">
      <div>
        {error && (
          <div className="flex items-center gap-2 text-2xs text-error-600 dark:text-error-400">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {state.showRejectInput ? (
          <>
            <Button onClick={state.handleJustReject} variant="ghost" size="sm" disabled={isLoading}>
              <XCircle className="h-3.5 w-3.5" />
              Just Reject
            </Button>
            <Button
              onClick={state.handleRejectClick}
              variant="primary"
              size="sm"
              disabled={isLoading || !state.alternativeInstruction.trim()}
            >
              Send
            </Button>
          </>
        ) : (
          <>
            <Button onClick={state.handleRejectClick} variant="ghost" size="sm" disabled={isLoading}>
              Reject
            </Button>
            <Button onClick={onApprove} variant="primary" size="sm" disabled={isLoading}>
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
