import { ShieldAlert } from 'lucide-react';
import { LazyMarkDown } from '@/components/ui/LazyMarkDown';
import type { PermissionRequest } from '@/types/chat.types';
import { useApprovalState } from '@/hooks/useApprovalState';
import { ApprovalTextarea, PermissionApprovalButtons } from '@/components/ui/shared/ApprovalFooter';
import { filterOptions } from '@/utils/permissionStorage';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value, null, 2);
}

interface ToolPermissionInlineProps {
  request: PermissionRequest | null;
  onApprove: (optionId: string) => void;
  onReject: (optionId: string, alternativeInstruction?: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ToolPermissionInline({
  request,
  onApprove,
  onReject,
  isLoading = false,
  error = null,
}: ToolPermissionInlineProps) {
  const approvalState = useApprovalState(onReject);

  if (!request || request.tool_name === 'AskUserQuestion' || request.tool_name === 'ExitPlanMode')
    return null;

  const hasParams = request.tool_input && Object.keys(request.tool_input).length > 0;
  const allowOptions = filterOptions(request.options, 'allow');
  const rejectOptions = filterOptions(request.options, 'reject');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-tertiary dark:border-border-dark dark:bg-surface-dark-tertiary">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-black/5 p-1 dark:bg-white/5">
            <ShieldAlert className="h-3.5 w-3.5 text-text-tertiary dark:text-text-dark-tertiary" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
              Permission Required
            </span>
            <span className="ml-2 text-2xs text-text-secondary dark:text-text-dark-secondary">
              Tool:{' '}
              <code className="rounded bg-black/5 px-1 py-0.5 font-mono dark:bg-white/5">
                {request.tool_name}
              </code>
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-3">
        {hasParams ? (
          <div className="space-y-2">
            {Object.entries(request.tool_input).map(([key, value]) => (
              <div key={key} className="space-y-0.5">
                <div className="text-2xs font-medium uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                  {key}
                </div>
                <div className="overflow-auto rounded-md bg-black/5 px-2 py-1.5 text-xs text-text-primary dark:bg-white/5 dark:text-text-dark-primary">
                  <LazyMarkDown content={formatValue(value)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs italic text-text-tertiary dark:text-text-dark-tertiary">
            No parameters
          </p>
        )}

        <ApprovalTextarea
          state={approvalState}
          textareaId="permission-feedback"
          isLoading={isLoading}
        />
      </div>

      <PermissionApprovalButtons
        state={approvalState}
        allowOptions={allowOptions}
        rejectOptions={rejectOptions}
        onApprove={onApprove}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
