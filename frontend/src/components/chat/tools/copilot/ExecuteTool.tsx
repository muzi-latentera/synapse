import { memo } from 'react';
import { Terminal } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';
import type { CopilotExecuteInput, CopilotToolOutput } from './copilotPayload';

const ICON = <Terminal className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const ExecuteToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as CopilotExecuteInput | undefined;
  const result = tool.result as CopilotToolOutput | undefined;

  const command = input?.command ?? '';
  const description = input?.description?.trim();
  const output = result?.content ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        const label = description || command || 'command';
        switch (status) {
          case 'completed':
            return `Ran: ${label}`;
          case 'failed':
            return `Failed: ${label}`;
          default:
            return `Running: ${label}`;
        }
      }}
      loadingContent="Running command..."
      error={tool.error}
    >
      {(command || output) && (
        <div className="space-y-1">
          {command && (
            <pre className="whitespace-pre-wrap break-all font-mono text-2xs leading-relaxed text-text-secondary dark:text-text-dark-tertiary">
              <span className="select-none text-text-quaternary dark:text-text-dark-quaternary">
                ${' '}
              </span>
              {command}
            </pre>
          )}
          {output && <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>}
        </div>
      )}
    </ToolCard>
  );
};

export const ExecuteTool = memo(ExecuteToolInner);
