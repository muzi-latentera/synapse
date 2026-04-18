import { memo } from 'react';
import { HelpCircle } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { ToolCard } from '../common/ToolCard';
import type { OpencodeQuestionInput, OpencodeQuestionOutput } from './opencodePayload';

const ICON = (
  <HelpCircle className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />
);

const QuestionToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeQuestionInput | undefined;
  const result = tool.result as OpencodeQuestionOutput | undefined;

  const questions = input?.questions ?? [];
  const answers = result?.metadata?.answers ?? [];
  const count = questions.length;

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        const noun = `${count} question${count === 1 ? '' : 's'}`;
        switch (status) {
          case 'completed':
            return `Answered ${noun}`;
          case 'failed':
            return `Failed to ask ${noun}`;
          default:
            return `Waiting on ${noun}...`;
        }
      }}
      loadingContent="Waiting for answer..."
      error={tool.error}
    >
      {count > 0 && (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const answer = answers[idx];
            const answerText = answer && answer.length > 0 ? answer.join(', ') : 'Unanswered';
            return (
              <div key={idx} className="space-y-0.5">
                <div className="text-xs text-text-primary dark:text-text-dark-primary">
                  {q.question ?? q.header ?? ''}
                </div>
                <div className="text-2xs text-text-tertiary dark:text-text-dark-tertiary">
                  <span className="text-text-quaternary dark:text-text-dark-quaternary">
                    answer:{' '}
                  </span>
                  {answerText}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToolCard>
  );
};

export const QuestionTool = memo(QuestionToolInner);
