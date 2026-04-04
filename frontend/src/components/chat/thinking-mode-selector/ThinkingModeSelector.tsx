import { memo, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import {
  useChatSettingsStore,
  DEFAULT_CHAT_SETTINGS_KEY,
  DEFAULT_THINKING_MODE,
} from '@/store/chatSettingsStore';
import { useIsSplitMode } from '@/hooks/useIsSplitMode';
import type { AgentKind } from '@/types/chat.types';

export interface ThinkingModeOption {
  value: string;
  label: string;
}

export const CLAUDE_THINKING_MODES: ThinkingModeOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

export const CODEX_THINKING_MODES: ThinkingModeOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

const MODES_BY_AGENT: Record<AgentKind, ThinkingModeOption[]> = {
  claude: CLAUDE_THINKING_MODES,
  codex: CODEX_THINKING_MODES,
};

const DEFAULT_BY_AGENT: Record<AgentKind, string> = {
  claude: 'medium',
  codex: 'medium',
};

export function coerceThinkingModeForAgent(thinkingMode: string, agentKind: AgentKind): string {
  const modes = MODES_BY_AGENT[agentKind];
  const defaultMode = DEFAULT_BY_AGENT[agentKind];
  return modes.find((mode) => mode.value === thinkingMode)?.value ?? defaultMode;
}

export interface ThinkingModeSelectorProps {
  chatId?: string;
  agentKind?: AgentKind;
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
}

export const ThinkingModeSelector = memo(function ThinkingModeSelector({
  chatId,
  agentKind,
  dropdownPosition = 'bottom',
  disabled = false,
}: ThinkingModeSelectorProps) {
  const key = chatId ?? DEFAULT_CHAT_SETTINGS_KEY;
  const resolvedAgentKind = agentKind ?? 'claude';
  const syncFallback = agentKind !== undefined;
  const thinkingMode = useChatSettingsStore(
    (state) => state.thinkingModeByChat[key] ?? DEFAULT_THINKING_MODE,
  );
  const isSplitMode = useIsSplitMode();

  const modes = MODES_BY_AGENT[resolvedAgentKind];
  const selectedMode =
    modes.find((m) => m.value === coerceThinkingModeForAgent(thinkingMode, resolvedAgentKind)) ??
    modes[0];

  useEffect(() => {
    if (!syncFallback || selectedMode.value === thinkingMode) return;
    useChatSettingsStore.getState().setThinkingMode(key, selectedMode.value);
  }, [key, selectedMode.value, syncFallback, thinkingMode]);

  return (
    <Dropdown
      value={selectedMode}
      items={modes}
      getItemKey={(mode) => mode.value}
      getItemLabel={(mode) => mode.label}
      onSelect={(mode) => useChatSettingsStore.getState().setThinkingMode(key, mode.value)}
      leftIcon={Brain}
      width="w-32"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile
      forceCompact={isSplitMode}
      renderItem={(mode, isSelected) => (
        <span
          className={`text-2xs font-medium ${isSelected ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary dark:text-text-dark-secondary'}`}
        >
          {mode.label}
        </span>
      )}
    />
  );
});
