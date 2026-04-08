import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import type { PermissionOption } from '@/types/chat.types';

interface PermissionApprovalButtonsProps {
  allowOptions: PermissionOption[];
  rejectOptions: PermissionOption[];
  onApprove: (optionId: string) => void;
  onReject: (optionId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function PermissionApprovalButtons({
  allowOptions,
  rejectOptions,
  onApprove,
  onReject,
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
            onClick={() => onReject(opt.option_id)}
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            disabled={isLoading}
          >
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {opt.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
