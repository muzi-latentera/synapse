import { memo } from 'react';
import { Terminal, FolderSearch, FileSearch } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';

type ParsedCmdType = 'list_files' | 'search' | 'read' | 'unknown';

const ICON_CLASS = 'h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary';

const ICON_BY_TYPE: Record<ParsedCmdType, React.ReactNode> = {
  list_files: <FolderSearch className={ICON_CLASS} />,
  search: <FileSearch className={ICON_CLASS} />,
  read: <FileSearch className={ICON_CLASS} />,
  unknown: <Terminal className={ICON_CLASS} />,
};

interface ShellInput {
  command?: string[];
  cwd?: string;
  parsed_cmd?: Array<{ type: ParsedCmdType; cmd: string; path?: string | null }>;
  source?: string;
}

interface ShellOutput {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  formatted_output?: string;
  duration?: { secs: number; nanos: number };
}

const extractCommand = (input: ShellInput | undefined): string => {
  if (!input?.command) return '';
  const args = input.command;
  if (args.length >= 3 && args[0] === '/bin/bash' && args[1] === '-lc') {
    return args[2];
  }
  return args.join(' ');
};

const ShellToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as ShellInput | undefined;
  const result = tool.result as ShellOutput | undefined;

  const command = extractCommand(input);
  const toolType: ParsedCmdType = input?.parsed_cmd?.[0]?.type ?? 'unknown';
  const title = tool.title;

  const output = result?.formatted_output || result?.stdout || '';
  const hasExpandableContent =
    command.length > 50 || (output.length > 0 && tool.status === 'completed');

  return (
    <ToolCard
      icon={ICON_BY_TYPE[toolType]}
      status={tool.status}
      title={(status) => {
        if (title) {
          return status === 'failed' ? `Failed: ${title}` : title;
        }
        if (!command) return status === 'completed' ? 'Ran command' : 'Running command';
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
      expandable={hasExpandableContent}
    >
      {hasExpandableContent && (
        <div className="space-y-1">
          {command.length > 50 && (
            <pre className="whitespace-pre-wrap break-all font-mono text-2xs leading-relaxed text-text-secondary dark:text-text-dark-tertiary">
              <span className="select-none text-text-quaternary dark:text-text-dark-quaternary">
                ${' '}
              </span>
              {command}
            </pre>
          )}
          {output.length > 0 && tool.status === 'completed' && (
            <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>
          )}
        </div>
      )}
    </ToolCard>
  );
};

export const ShellTool = memo(ShellToolInner);
