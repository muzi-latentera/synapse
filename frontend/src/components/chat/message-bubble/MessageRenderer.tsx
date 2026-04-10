import React, { memo, Suspense } from 'react';
import { LazyMarkDown } from '@/components/ui/LazyMarkDown';
import { ThinkingBlock } from './ThinkingBlock';
import { PromptSuggestions } from './PromptSuggestions';
import { getToolComponent } from '@/components/chat/tools/registry';
import { buildSegments } from './segmentBuilder';
import { AgentToolsContext } from '@/contexts/AgentToolsContext';
import type { AssistantStreamEvent } from '@/types/chat.types';
import type { ToolAggregate } from '@/types/tools.types';
import { Spinner } from '@/components/ui/primitives/Spinner';

interface MessageRendererProps {
  events: AssistantStreamEvent[];
  className?: string;
  isStreaming?: boolean;
  chatId?: string;
  isLastBotMessage?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
}

const MessageRendererInner: React.FC<MessageRendererProps> = ({
  events,
  className = '',
  isStreaming = false,
  chatId,
  isLastBotMessage = false,
  onSuggestionSelect,
}) => {
  const { segments, activeThinkingIndex } = React.useMemo(() => {
    const builtSegments = buildSegments(events);

    let thinkingIndex = -1;
    if (isStreaming && events.length > 0) {
      const lastEvent = events[events.length - 1];
      if (lastEvent.type === 'assistant_thinking') {
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === 'assistant_thinking') {
            thinkingIndex = i;
            break;
          }
        }
      }
    }

    return {
      segments: builtSegments,
      activeThinkingIndex: thinkingIndex,
    };
  }, [events, isStreaming]);

  const agentTools = React.useMemo(
    () =>
      segments.reduce<ToolAggregate[]>((acc, seg) => {
        if (seg.kind === 'tool' && seg.tool.name === 'Agent') acc.push(seg.tool);
        return acc;
      }, []),
    [segments],
  );

  return (
    <AgentToolsContext value={agentTools}>
      <div className={className}>
        {segments.map((segment) => {
          switch (segment.kind) {
            case 'text':
              return (
                <div
                  key={segment.id}
                  className="prose prose-sm dark:prose-invert max-w-none break-words"
                >
                  <LazyMarkDown content={segment.text} />
                </div>
              );
            case 'thinking': {
              return (
                <div key={segment.id} className="mb-2 mt-0.5">
                  <ThinkingBlock
                    content={segment.text}
                    isActiveThinking={segment.eventIndex === activeThinkingIndex}
                  />
                </div>
              );
            }
            case 'tool': {
              const Component = getToolComponent(segment.tool.name);
              return (
                <div key={segment.id} className="mb-2 mt-1">
                  <Suspense
                    fallback={
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 dark:border-border-dark/50">
                        <Spinner
                          size="sm"
                          className="text-text-quaternary dark:text-text-dark-quaternary"
                        />
                        <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
                          Loading tool output...
                        </span>
                      </div>
                    }
                  >
                    <Component tool={segment.tool} chatId={chatId} />
                  </Suspense>
                </div>
              );
            }
            case 'suggestions': {
              if (!isLastBotMessage || !onSuggestionSelect) {
                return null;
              }
              return (
                <PromptSuggestions
                  key={segment.id}
                  suggestions={segment.suggestions}
                  onSelect={onSuggestionSelect}
                />
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </AgentToolsContext>
  );
};

export const MessageRenderer = memo(MessageRendererInner);
