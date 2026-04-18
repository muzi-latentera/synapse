import { memo, useMemo, useState, useRef } from 'react';
import { Bot } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { TOOL_OUTPUT_PRE_CLASS } from '@/utils/toolStyles';
import { AgentToolsContext } from '@/contexts/AgentToolsContext';
import { ToolCard } from '../common/ToolCard';
import { CollapsibleButton } from '../common/CollapsibleButton';
import { getToolComponent } from '../registry';
import type { OpencodeTaskInput, OpencodeOutput } from './opencodePayload';

const TaskToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const prevToolIdRef = useRef(tool.id);

  if (prevToolIdRef.current !== tool.id) {
    prevToolIdRef.current = tool.id;
    setPromptExpanded(false);
    setResultExpanded(false);
    setToolsExpanded(false);
  }

  const input = tool.input as OpencodeTaskInput | undefined;
  const result = tool.result as OpencodeOutput | undefined;

  const description = input?.description?.trim() || tool.title?.trim() || '';
  const agentType = input?.subagent_type?.trim();
  const prompt = input?.prompt;
  const output = result?.output?.trim();

  // Scope the sibling context to nested task tools so an expanded view sees
  // siblings at its own level, not the parent message's top-level list.
  const childTaskTools = useMemo(
    () => tool.children.filter((c) => c.name === 'task'),
    [tool.children],
  );

  return (
    <ToolCard
      icon={<Bot className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
      status={tool.status}
      title={(status) => {
        const label = description || agentType || 'agent task';
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
      {(agentType || prompt || output || tool.children.length > 0) && (
        <div className="space-y-2">
          {agentType && (
            <div className="text-2xs text-text-tertiary dark:text-text-dark-tertiary">
              <span className="text-text-quaternary dark:text-text-dark-quaternary">type: </span>
              <span className="font-mono">{agentType}</span>
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

          {output && (
            <div className="space-y-2">
              <CollapsibleButton
                label="Result"
                isExpanded={resultExpanded}
                onToggle={() => setResultExpanded((v) => !v)}
                fullWidth
              />
              {resultExpanded && <pre className={TOOL_OUTPUT_PRE_CLASS}>{output}</pre>}
            </div>
          )}

          {tool.children.length > 0 && (
            <div className="space-y-2">
              <CollapsibleButton
                label="Tools Used"
                isExpanded={toolsExpanded}
                onToggle={() => setToolsExpanded((v) => !v)}
                count={tool.children.length}
                fullWidth
              />
              {toolsExpanded && (
                <AgentToolsContext value={childTaskTools}>
                  <div className="space-y-2">
                    {tool.children.map((childTool) => {
                      const Component = getToolComponent(childTool.name, 'opencode');
                      return (
                        <div
                          key={childTool.id}
                          className="border-l border-border pl-2 dark:border-border-dark"
                        >
                          <Component tool={childTool} />
                        </div>
                      );
                    })}
                  </div>
                </AgentToolsContext>
              )}
            </div>
          )}
        </div>
      )}
    </ToolCard>
  );
};

export const TaskTool = memo(TaskToolInner);
