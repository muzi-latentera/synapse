import { memo } from 'react';
import { Terminal } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { formatResult } from '@/utils/format';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';

interface BashInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
}

const BashToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as BashInput | undefined;
  const command = input?.command ?? '';
  const description = input?.description;

  const output = formatResult(tool.result);

  return (
    <ToolCard
      icon={<Terminal className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        if (description) {
          return status === 'failed' ? `Failed: ${description}` : description;
        }
        if (!command) return status === 'completed' ? 'Ran command' : 'Run command';
        switch (status) {
          case 'completed':
            return `Ran: ${command}`;
          case 'failed':
            return `Failed: ${command}`;
          default:
            return `Running: ${command}`;
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
          {output.length > 0 && <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>}
        </div>
      )}
    </ToolCard>
  );
};

export const BashTool = memo(BashToolInner);
