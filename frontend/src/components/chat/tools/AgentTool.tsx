import React, { use, useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { Bot, Maximize2 } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { ToolCard } from './common/ToolCard';
import { CollapsibleButton } from './common/CollapsibleButton';
import { getToolComponent } from './registry';
import { AgentToolsContext } from '@/components/chat/message-bubble/MessageRenderer';

const LazyExpandedModal = lazy(() => import('./AgentToolExpandedModal'));

export const extractResultText = (result: unknown): string | undefined => {
  if (typeof result === 'string') return result || undefined;
  if (Array.isArray(result)) {
    const texts = result
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === 'object' &&
          block !== null &&
          block.type === 'text' &&
          typeof block.text === 'string',
      )
      .map((block) => block.text);
    return texts.length > 0 ? texts.join('\n') : undefined;
  }
  return undefined;
};

interface AgentToolProps {
  tool: ToolAggregate;
}

export const AgentTool: React.FC<AgentToolProps> = ({ tool }) => {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const siblingAgents = use(AgentToolsContext);

  useEffect(() => {
    setPromptExpanded(false);
    setResultExpanded(false);
    setToolsExpanded(false);
    setModalOpen(false);
  }, [tool.id]);

  const prompt = tool.input?.prompt as string | undefined;
  const description = tool.input?.description as string | undefined;
  const subagentType = tool.input?.subagent_type as string | undefined;

  const result = extractResultText(tool.result);

  const hasDetails = Boolean(prompt) || Boolean(result) || tool.children.length > 0;

  // Scoped context for nested Agent tools so they see their own siblings
  const childAgentTools = useMemo(
    () => tool.children.filter((c) => c.name === 'Agent'),
    [tool.children],
  );

  const expandAction = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setModalOpen(true);
      }}
      className="rounded-sm opacity-0 transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-text-quaternary/30 group-hover/tool:opacity-100"
      title="Expand agent view"
    >
      <Maximize2 className="h-3 w-3 text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary" />
    </button>
  );

  return (
    <>
      <ToolCard
        icon={<Bot className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />}
        status={tool.status}
        title={(status) => {
          const type = subagentType || 'general-purpose';
          switch (status) {
            case 'completed':
              return `Agent completed (${type})`;
            case 'failed':
              return `Agent failed (${type})`;
            case 'started':
              return `Running agent (${type})`;
            default:
              return `Agent pending (${type})`;
          }
        }}
        error={tool.error}
        statusDetail={
          description ? (
            <p className="mt-1 text-xs text-text-tertiary dark:text-text-dark-tertiary">
              {description}
            </p>
          ) : undefined
        }
        expandable={hasDetails}
        actions={expandAction}
      >
        {hasDetails && (
          <div className="space-y-2">
            {prompt && (
              <div className="space-y-2">
                <CollapsibleButton
                  label="Prompt"
                  isExpanded={promptExpanded}
                  onToggle={() => setPromptExpanded((value) => !value)}
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
                  onToggle={() => setResultExpanded((value) => !value)}
                  fullWidth
                />
                {resultExpanded && (
                  <div className="whitespace-pre-wrap break-words rounded bg-black/5 p-2 font-mono text-2xs text-text-secondary dark:bg-white/5 dark:text-text-dark-tertiary">
                    {result}
                  </div>
                )}
              </div>
            )}

            {tool.children.length > 0 && (
              <div className="space-y-2">
                <CollapsibleButton
                  label="Tools Used"
                  isExpanded={toolsExpanded}
                  onToggle={() => setToolsExpanded((value) => !value)}
                  count={tool.children.length}
                  fullWidth
                />
                {toolsExpanded && (
                  <AgentToolsContext value={childAgentTools}>
                    <div className="space-y-2">
                      {tool.children.map((childTool) => {
                        const Component = getToolComponent(childTool.name);
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
      {modalOpen && (
        <Suspense fallback={null}>
          <LazyExpandedModal
            agents={siblingAgents}
            initialAgentId={tool.id}
            onClose={() => setModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};
