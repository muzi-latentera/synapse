import { memo } from 'react';
import { Terminal } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';
import type { CursorExecuteOutput } from './cursorPayload';

const ICON = <Terminal className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const ExecuteToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const result = tool.result as CursorExecuteOutput | undefined;

  // Cursor leaves rawInput empty on streamed tool_call events, so the title
  // ("Terminal") is all we have for the header. Fall back to a generic label.
  const title = tool.title?.trim() || 'command';
  const stdout = result?.stdout ?? '';
  const stderr = result?.stderr ?? '';
  const exitCode = result?.exitCode;
  const failed = typeof exitCode === 'number' && exitCode !== 0;

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return failed ? `Failed (exit ${exitCode}): ${title}` : `Ran: ${title}`;
          case 'failed':
            return `Failed: ${title}`;
          default:
            return `Running: ${title}`;
        }
      }}
      loadingContent="Running command..."
      error={tool.error}
    >
      {(stdout || stderr) && (
        <div className="space-y-1">
          {stdout && <pre className={TOOL_OUTPUT_PRE_CLASS}>{stdout}</pre>}
          {stderr && (
            <pre className={`${TOOL_OUTPUT_PRE_CLASS} text-error-600 dark:text-error-400`}>
              {stderr}
            </pre>
          )}
        </div>
      )}
    </ToolCard>
  );
};

export const ExecuteTool = memo(ExecuteToolInner);
