import { memo, useState, useRef } from 'react';
import { Bot } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { extractResultText } from '@/utils/agentTool';
import { ToolCard } from '../common/ToolCard';
import { CollapsibleButton } from '../common/CollapsibleButton';
import type { CopilotToolOutput } from './copilotPayload';

interface CopilotAgentInput {
  description?: string;
  agent_type?: string;
  name?: string;
  prompt?: string;
}

const AgentToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const prevToolIdRef = useRef(tool.id);

  if (prevToolIdRef.current !== tool.id) {
    prevToolIdRef.current = tool.id;
    setPromptExpanded(false);
    setResultExpanded(false);
  }

  const input = tool.input as CopilotAgentInput | undefined;
  const output = tool.result as CopilotToolOutput | undefined;
  const description = input?.description?.trim() || tool.title?.trim() || '';
  const agentType = input?.agent_type?.trim();
  const agentName = input?.name?.trim();
  const prompt = input?.prompt;
  // `output.content` is the sub-agent's summary text; fall back to the Claude
  // tool utility which handles other structured result shapes.
  const result = output?.content?.trim() || extractResultText(tool.result);

  return (
    <ToolCard
      icon={<Bot className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        const label = description || agentName || agentType || 'agent task';
        switch (status) {
          case 'completed':
            return `Agent: ${label}`;
          case 'failed':
            return `Agent failed: ${label}`;
          default:
            return `Running agent: ${label}`;
        }
      }}
      loadingContent="Running sub-agent..."
      error={tool.error}
    >
      {(agentType || agentName || prompt || result) && (
        <div className="space-y-2">
          {(agentType || agentName) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-text-tertiary dark:text-text-dark-tertiary">
              {agentType && (
                <span>
                  <span className="text-text-quaternary dark:text-text-dark-quaternary">
                    type:{' '}
                  </span>
                  <span className="font-mono">{agentType}</span>
                </span>
              )}
              {agentName && (
                <span>
                  <span className="text-text-quaternary dark:text-text-dark-quaternary">
                    name:{' '}
                  </span>
                  <span className="font-mono">{agentName}</span>
                </span>
              )}
            </div>
          )}

          {prompt && (
            <div className="space-y-2">
              <CollapsibleButton
                label="Prompt"
                isExpanded={promptExpanded}
                onToggle={() => setPromptExpanded((v) => !v)}
                fullWidth
              />
              {promptExpanded && (
                <div className="whitespace-pre-wrap break-words rounded bg-black/5 p-2 font-mono text-2xs text-text-secondary dark:bg-white/5 dark:text-text-dark-tertiary">
                  {prompt}
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <CollapsibleButton
                label="Result"
                isExpanded={resultExpanded}
                onToggle={() => setResultExpanded((v) => !v)}
                fullWidth
              />
              {resultExpanded && <pre className={TOOL_OUTPUT_PRE_CLASS}>{result}</pre>}
            </div>
          )}
        </div>
      )}
    </ToolCard>
  );
};

export const AgentTool = memo(AgentToolInner);
