import { memo } from 'react';
import { SquareTerminal } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { formatResult } from '@/utils/format';
import { ToolCard } from '../common/ToolCard';

interface AgentOutputInput {
  task_id?: string;
  bash_id?: string;
  block?: boolean;
  timeout?: number;
}

const OutputToolInner: React.FC<{
  tool: ToolAggregate;
  idField: 'task_id' | 'bash_id';
  label: string;
}> = ({ tool, idField, label }) => {
  const input = tool.input as AgentOutputInput | undefined;
  const id = input?.[idField] ?? '';
  const truncatedId = id.length > 12 ? `${id.slice(0, 12)}\u2026` : id;
  const idSuffix = id ? `: ${truncatedId}` : '';

  const output = formatResult(tool.result);
  const hasOutput = output.length > 0 && tool.status === 'completed';

  return (
    <ToolCard
      icon={
        <SquareTerminal className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
      }
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Got ${label} output${idSuffix}`;
          case 'failed':
            return `Failed to get ${label} output${idSuffix}`;
          default:
            return `Getting ${label} output${idSuffix}`;
        }
      }}
      loadingContent={`Waiting for ${label} output\u2026`}
      error={tool.error}
      expandable={hasOutput}
    >
      {hasOutput && (
        <div className="max-h-48 overflow-auto rounded bg-black/5 px-2 py-1.5 font-mono text-xs text-text-secondary dark:bg-white/5 dark:text-text-dark-secondary">
          <pre className="whitespace-pre-wrap break-all">{output}</pre>
        </div>
      )}
    </ToolCard>
  );
};

export const AgentOutputTool = memo<{ tool: ToolAggregate }>(({ tool }) => (
  <OutputToolInner tool={tool} idField="task_id" label="agent" />
));

export const BashOutputTool = memo<{ tool: ToolAggregate }>(({ tool }) => (
  <OutputToolInner tool={tool} idField="bash_id" label="bash" />
));
