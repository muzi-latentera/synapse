import { EnhanceButton } from './EnhanceButton';
import { PermissionModeSelector } from '@/components/chat/permission-mode-selector/PermissionModeSelector';
import { ModelSelector } from '@/components/chat/model-selector/ModelSelector';
import { ThinkingModeSelector } from '@/components/chat/thinking-mode-selector/ThinkingModeSelector';
import { PersonaSelector } from '@/components/chat/persona-selector/PersonaSelector';
import { BranchSelector } from '@/components/chat/branch-selector/BranchSelector';
import { useInputState, useInputActions } from '@/hooks/useInputContext';
import { useModelMap } from '@/hooks/queries/useModelQueries';
import { useChatQuery } from '@/hooks/queries/useChatQueries';

export function InputControls() {
  const state = useInputState();
  const actions = useInputActions();
  const modelMap = useModelMap();
  const agentKind = modelMap.get(state.selectedModelId)?.agent_kind;
  const { data: chat } = useChatQuery(state.chatId, { enabled: !!state.chatId });
  const lockedAgentKind = chat?.session_agent_kind ?? null;

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5"
      onMouseDown={(e) => e.preventDefault()}
    >
      <EnhanceButton
        onEnhance={actions.handleEnhancePrompt}
        isEnhancing={state.isEnhancing}
        disabled={state.isLoading || !state.hasMessage}
      />

      <PermissionModeSelector
        chatId={state.chatId}
        agentKind={agentKind}
        dropdownPosition={state.dropdownPosition}
        disabled={state.isLoading}
      />

      <ThinkingModeSelector
        chatId={state.chatId}
        agentKind={agentKind}
        dropdownPosition={state.dropdownPosition}
        disabled={state.isLoading}
      />

      <PersonaSelector
        chatId={state.chatId}
        dropdownPosition={state.dropdownPosition}
        disabled={state.isLoading}
      />

      <ModelSelector
        selectedModelId={state.selectedModelId}
        onModelChange={actions.onModelChange}
        chatId={state.chatId}
        dropdownPosition={state.dropdownPosition}
        disabled={state.isLoading || state.isStreaming}
        lockedAgentKind={lockedAgentKind}
      />

      <BranchSelector dropdownPosition={state.dropdownPosition} disabled={state.isLoading} />
    </div>
  );
}
