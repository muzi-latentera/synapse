import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { ToolCard } from '../common/ToolCard';
import type { OpencodeSkillInput, OpencodeOutput } from './opencodePayload';

const ICON = <Sparkles className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const SkillToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeSkillInput | undefined;
  const result = tool.result as OpencodeOutput | undefined;

  const name = input?.name ?? tool.title?.trim() ?? 'skill';
  const output = result?.output ?? '';

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Loaded skill: ${name}`;
          case 'failed':
            return `Failed to load skill: ${name}`;
          default:
            return `Loading skill: ${name}...`;
        }
      }}
      loadingContent="Loading skill..."
      error={tool.error}
    >
      {output && <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>}
    </ToolCard>
  );
};

export const SkillTool = memo(SkillToolInner);
