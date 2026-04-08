import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import type { ApprovalState } from '@/hooks/useApprovalState';
import type { PermissionOption } from '@/types/chat.types';

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
        className="text-2xs font-medium uppercase tracking-wider text-text-tertiary dark:text-text-dark-tertiary"
      >
        Alternative Instructions
      </label>
      <textarea
        id={textareaId}
        value={state.alternativeInstruction}
        onChange={(e) => state.setAlternativeInstruction(e.target.value)}
        placeholder="Tell the assistant what to do instead\u2026"
        className="mt-1.5 w-full resize-none rounded-md border border-border/50 bg-surface-secondary px-2.5 py-1.5 text-xs text-text-primary placeholder-text-quaternary transition-colors focus:border-text-quaternary focus:outline-none focus:ring-1 focus:ring-text-quaternary/30 dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:placeholder-text-dark-tertiary"
        rows={2}
        disabled={isLoading}
        autoFocus
      />
    </div>
  );
}

interface PermissionApprovalButtonsProps {
  state: ApprovalState;
  allowOptions: PermissionOption[];
  rejectOptions: PermissionOption[];
  onApprove: (optionId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function PermissionApprovalButtons({
  state,
  allowOptions,
  rejectOptions,
  onApprove,
  isLoading,
  error,
}: PermissionApprovalButtonsProps) {
  return (
    <div className="border-t border-border/50 px-3 py-2 dark:border-border-dark/50">
      {error && (
        <div className="mb-2 flex items-center gap-2 text-2xs text-error-600 dark:text-error-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {state.showRejectInput ? (
          <div className="flex items-center justify-end gap-2">
            <Button onClick={state.handleJustReject} variant="ghost" size="sm" disabled={isLoading}>
              <XCircle className="h-3.5 w-3.5" />
              Just Reject
            </Button>
            <Button
              onClick={() => state.handleRejectClick(state.selectedRejectOptionId)}
              variant="primary"
              size="sm"
              disabled={isLoading || !state.alternativeInstruction.trim()}
            >
              Send
            </Button>
          </div>
        ) : (
          <>
            {allowOptions
              .filter((opt) => opt.kind === 'allow_once')
              .map((opt) => (
                <Button
                  key={opt.option_id}
                  onClick={() => onApprove(opt.option_id)}
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  disabled={isLoading}
                >
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {opt.name}
                </Button>
              ))}
            {allowOptions
              .filter((opt) => opt.kind !== 'allow_once')
              .map((opt) => (
                <Button
                  key={opt.option_id}
                  onClick={() => onApprove(opt.option_id)}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  disabled={isLoading}
                >
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {opt.name}
                </Button>
              ))}
            {rejectOptions.map((opt) => (
              <Button
                key={opt.option_id}
                onClick={() => state.handleRejectClick(opt.option_id)}
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                disabled={isLoading}
              >
                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {opt.name}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
