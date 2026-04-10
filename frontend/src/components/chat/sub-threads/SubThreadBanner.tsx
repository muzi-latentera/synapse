import { useNavigate } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { useChatContext } from '@/hooks/useChatContext';
import { useChatQuery } from '@/hooks/queries/useChatQueries';
import { useChatSettingsStore } from '@/store/chatSettingsStore';

export function SubThreadBanner() {
  const navigate = useNavigate();
  const { chatId, parentChatId } = useChatContext();

  const { data: parentChat, isError } = useChatQuery(parentChatId, {
    enabled: !!parentChatId,
  });

  const persona = useChatSettingsStore((s) => (chatId ? s.personaByChat[chatId] : undefined));

  if (!parentChatId) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border/50 bg-surface-secondary px-4 py-1.5 text-2xs text-text-tertiary dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-tertiary">
      <GitBranch className="h-3 w-3 flex-shrink-0" />
      <span>Sub-thread of</span>
      <button
        type="button"
        onClick={() => !isError && navigate(`/chat/${parentChatId}`)}
        disabled={isError}
        className={
          isError
            ? 'font-medium text-text-quaternary dark:text-text-dark-quaternary'
            : 'font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
        }
      >
        {isError ? 'Parent unavailable' : (parentChat?.title ?? 'Loading...')}
      </button>
      {persona && persona !== 'Default' && (
        <span className="rounded-md bg-surface-tertiary px-1.5 py-0.5 font-mono text-2xs dark:bg-surface-dark-tertiary">
          {persona}
        </span>
      )}
    </div>
  );
}
