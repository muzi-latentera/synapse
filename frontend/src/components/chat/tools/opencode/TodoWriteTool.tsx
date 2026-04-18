import { memo } from 'react';
import { ListTodo, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import type { ToolAggregate } from '@/types/tools.types';
import { ToolCard } from '../common/ToolCard';
import type { OpencodeTodoInfo, OpencodeTodoWriteInput } from './opencodePayload';

const ICON = <ListTodo className="h-3.5 w-3.5 text-text-secondary dark:text-text-dark-tertiary" />;

const STATUS_ICON: Record<NonNullable<OpencodeTodoInfo['status']>, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-success-600 dark:text-success-400" />,
  in_progress: <Clock className="h-4 w-4 text-text-secondary dark:text-text-dark-secondary" />,
  pending: <Circle className="h-4 w-4 text-text-quaternary dark:text-text-dark-quaternary" />,
  cancelled: <XCircle className="h-4 w-4 text-text-quaternary dark:text-text-dark-quaternary" />,
};

const TODO_TEXT_DONE = 'text-xs text-text-tertiary line-through dark:text-text-dark-tertiary';
const TODO_TEXT_ACTIVE = 'text-xs text-text-primary dark:text-text-dark-primary';

const TodoWriteToolInner: React.FC<{ tool: ToolAggregate }> = ({ tool }) => {
  const input = tool.input as OpencodeTodoWriteInput | undefined;
  const todos = input?.todos ?? [];

  const counts = todos.reduce(
    (acc, t) => {
      if (t.status === 'completed') acc.completed++;
      else if (t.status === 'in_progress') acc.inProgress++;
      else if (t.status === 'pending') acc.pending++;
      return acc;
    },
    { completed: 0, inProgress: 0, pending: 0 },
  );
  const total = todos.length;

  return (
    <ToolCard
      icon={ICON}
      status={tool.status}
      title={(status) => {
        switch (status) {
          case 'completed':
            return `Updated todos (${total} item${total !== 1 ? 's' : ''})`;
          case 'failed':
            return 'Failed to update todos';
          default:
            return 'Updating todos';
        }
      }}
      loadingContent="Updating todo list..."
      error={tool.error}
    >
      {total > 0 && (
        <div>
          <div className="mb-2 flex gap-3 text-2xs">
            {counts.completed > 0 && (
              <span className="text-success-600 dark:text-success-400">
                {counts.completed} done
              </span>
            )}
            {counts.inProgress > 0 && (
              <span className="text-text-secondary dark:text-text-dark-secondary">
                {counts.inProgress} active
              </span>
            )}
            {counts.pending > 0 && (
              <span className="text-text-tertiary dark:text-text-dark-tertiary">
                {counts.pending} pending
              </span>
            )}
          </div>
          <div className="space-y-1">
            {todos.map((todo, idx) => {
              const status = todo.status ?? 'pending';
              return (
                <div
                  key={todo.id ?? `${idx}-${todo.content}`}
                  className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-surface-hover dark:hover:bg-surface-dark-hover"
                >
                  <div className="flex-shrink-0">{STATUS_ICON[status]}</div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        status === 'completed' || status === 'cancelled'
                          ? TODO_TEXT_DONE
                          : TODO_TEXT_ACTIVE
                      }
                    >
                      {todo.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ToolCard>
  );
};

export const TodoWriteTool = memo(TodoWriteToolInner);
