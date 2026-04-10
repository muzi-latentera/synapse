import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Brain, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { BaseModal } from '@/components/ui/shared/BaseModal';
import { Button } from '@/components/ui/primitives/Button';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import { ModelSelector } from '@/components/chat/model-selector/ModelSelector';
import {
  CLAUDE_THINKING_MODES,
  CODEX_THINKING_MODES,
  type ThinkingModeOption,
} from '@/components/chat/thinking-mode-selector/ThinkingModeSelector';
import {
  MODES_BY_AGENT,
  coercePermissionModeForAgent,
  getPermissionModeOption,
} from '@/components/chat/permission-mode-selector/PermissionModeSelector';
import type { PermissionMode } from '@/store/chatSettingsStore';
import { useModelsQuery } from '@/hooks/queries/useModelQueries';
import { useSettingsQuery } from '@/hooks/queries/useSettingsQueries';
import { useCreateSubThreadMutation } from '@/hooks/queries/useChatQueries';
import { useModelStore } from '@/store/modelStore';
import { useChatSettingsStore, DEFAULT_PERSONA } from '@/store/chatSettingsStore';
import { useAuthStore } from '@/store/authStore';
import type { Chat } from '@/types/chat.types';

// Intentional: the primary use case for sub-threads is code review against
// the current branch. The user can edit this before creating the sub-thread.
const DEFAULT_MESSAGE =
  'Review all changes in the current branch — including staged, unstaged, and all commits on this branch. Provide detailed feedback.';

interface CreateSubThreadDialogProps {
  parentChat: Chat;
  onClose: () => void;
}

export function CreateSubThreadDialog({ parentChat, onClose }: CreateSubThreadDialogProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: models = [] } = useModelsQuery({ enabled: isAuthenticated });
  const { data: settings } = useSettingsQuery({ enabled: isAuthenticated });
  const personas = settings?.personas ?? [];

  const [selectedModelId, setSelectedModelId] = useState('');
  const [personaName, setPersonaName] = useState(DEFAULT_PERSONA);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [thinkingMode, setThinkingMode] = useState<ThinkingModeOption>(CLAUDE_THINKING_MODES[1]);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('acceptEdits');

  const selectedModel = models.find((m) => m.model_id === selectedModelId);
  const agentKind = selectedModel?.agent_kind ?? 'claude';
  const permissionModes = MODES_BY_AGENT[agentKind];
  const thinkingModes = agentKind === 'codex' ? CODEX_THINKING_MODES : CLAUDE_THINKING_MODES;
  const effectivePermissionMode = coercePermissionModeForAgent(permissionMode, agentKind);
  const selectedPermissionOption = getPermissionModeOption(permissionMode, agentKind);

  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      setSelectedModelId(models[0].model_id);
    }
  }, [models, selectedModelId]);

  const createSubThread = useCreateSubThreadMutation(parentChat.id);

  const handleCreate = async () => {
    const trimmedMessage = message.trim();
    if (!selectedModelId?.trim()) {
      toast.error('Please select a model');
      return;
    }
    if (!trimmedMessage) {
      toast.error('Please enter an initial message');
      return;
    }

    try {
      const title = personaName !== DEFAULT_PERSONA ? personaName : trimmedMessage.slice(0, 80);
      const newChat = await createSubThread.mutateAsync({
        title,
        model_id: selectedModelId,
        workspace_id: parentChat.workspace_id,
        parent_chat_id: parentChat.id,
      });

      useModelStore.getState().selectModel(newChat.id, selectedModelId);
      const store = useChatSettingsStore.getState();
      store.setPersona(newChat.id, personaName);
      store.setPermissionMode(newChat.id, effectivePermissionMode);
      store.setThinkingMode(newChat.id, thinkingMode.value);

      onClose();
      navigate(`/chat/${newChat.id}`, { state: { initialPrompt: trimmedMessage } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create sub-thread');
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="sm"
      zIndex="modalHighest"
      className="overflow-visible"
    >
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <GitBranch className="h-4 w-4 text-text-tertiary dark:text-text-dark-tertiary" />
          </div>
          <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
            New sub-thread
          </h2>
        </div>

        <p className="mt-3 text-2xs text-text-tertiary dark:text-text-dark-tertiary">
          From:{' '}
          <span className="font-medium text-text-secondary dark:text-text-dark-secondary">
            {parentChat.title}
          </span>
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
              Model
            </label>
            <ModelSelector
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              dropdownPosition="bottom"
              compact={false}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
              Persona
            </label>
            <select
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-surface-secondary px-3 py-1.5 text-xs text-text-primary outline-none transition-colors duration-200 focus:border-border-hover dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:focus:border-border-dark-hover"
            >
              <option value={DEFAULT_PERSONA}>Default</option>
              {personas.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Dropdown
              value={thinkingMode}
              items={thinkingModes}
              getItemKey={(m) => m.value ?? 'off'}
              getItemLabel={(m) => m.label}
              onSelect={setThinkingMode}
              leftIcon={Brain}
              dropdownPosition="bottom"
            />
            <Dropdown
              value={selectedPermissionOption}
              items={permissionModes}
              getItemKey={(m) => m.value}
              getItemLabel={(m) => m.label}
              onSelect={(m) => setPermissionMode(m.value)}
              leftIcon={Shield}
              dropdownPosition="bottom"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
              Initial message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border/50 bg-surface-secondary px-3 py-2 text-xs text-text-primary outline-none transition-colors duration-200 focus:border-border-hover dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:focus:border-border-dark-hover"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border/50 px-5 py-3.5 dark:border-border-dark/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={createSubThread.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={createSubThread.isPending}
        >
          {createSubThread.isPending ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </BaseModal>
  );
}
