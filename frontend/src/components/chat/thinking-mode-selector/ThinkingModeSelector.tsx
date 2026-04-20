import { memo } from 'react';
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

const CLAUDE_THINKING_MODES: ThinkingModeOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];
const CLAUDE_OPUS_THINKING_MODES: ThinkingModeOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
  { value: 'max', label: 'Max' },
];

const CODEX_THINKING_MODES: ThinkingModeOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

// Cursor bakes reasoning effort into the model ID; OpenCode delegates to the
// per-model provider. Neither exposes a uniform thinking-mode dial via ACP,
// so an empty list hides the selector.
const EMPTY_THINKING_MODES: ThinkingModeOption[] = [];

export const THINKING_MODES_BY_AGENT: Record<AgentKind, ThinkingModeOption[]> = {
  claude: CLAUDE_THINKING_MODES,
  codex: CODEX_THINKING_MODES,
  copilot: CODEX_THINKING_MODES,
  cursor: EMPTY_THINKING_MODES,
  opencode: EMPTY_THINKING_MODES,
};

const DEFAULT_BY_AGENT: Record<AgentKind, string> = {
  claude: 'medium',
  codex: 'medium',
  copilot: 'medium',
  cursor: 'medium',
  opencode: 'medium',
};

export function getThinkingModesForAgent(
  agentKind: AgentKind,
  modelId?: string,
): ThinkingModeOption[] {
  // Claude exposes `xhigh` only for the Opus alias we map to Opus 4.7.
  if (agentKind === 'claude' && modelId === 'opus[1m]') {
    return CLAUDE_OPUS_THINKING_MODES;
  }

  return THINKING_MODES_BY_AGENT[agentKind];
}

export function coerceThinkingModeForAgent(
  thinkingMode: string,
  agentKind: AgentKind,
  modelId?: string,
): string {
  const modes = getThinkingModesForAgent(agentKind, modelId);
  const defaultMode = DEFAULT_BY_AGENT[agentKind];
  return modes.find((mode) => mode.value === thinkingMode)?.value ?? defaultMode;
}

function getThinkingModeOption(
  thinkingMode: string,
  agentKind: AgentKind,
  modelId?: string,
): ThinkingModeOption | null {
  const modes = getThinkingModesForAgent(agentKind, modelId);
  if (modes.length === 0) return null;
  const effectiveMode = coerceThinkingModeForAgent(thinkingMode, agentKind, modelId);
  const selectedMode = modes.find((mode) => mode.value === effectiveMode);

  if (!selectedMode) {
    throw new Error(`Missing thinking mode option for ${agentKind}: ${effectiveMode}`);
  }

  return selectedMode;
}

export interface ThinkingModeSelectorProps {
  chatId?: string;
  agentKind?: AgentKind;
  modelId?: string;
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
  variant?: 'default' | 'text';
  dropdownAlign?: 'left' | 'right';
}

export const ThinkingModeSelector = memo(function ThinkingModeSelector({
  chatId,
  agentKind,
  modelId,
  dropdownPosition = 'bottom',
  dropdownAlign,
  disabled = false,
  variant = 'default',
}: ThinkingModeSelectorProps) {
  const key = chatId ?? DEFAULT_CHAT_SETTINGS_KEY;
  const resolvedAgentKind = agentKind ?? 'claude';
  const thinkingMode = useChatSettingsStore(
    (state) => state.thinkingModeByChat[key] ?? DEFAULT_THINKING_MODE,
  );
  const isSplitMode = useIsSplitMode();

  const modes = getThinkingModesForAgent(resolvedAgentKind, modelId);
  const selectedMode = getThinkingModeOption(thinkingMode, resolvedAgentKind, modelId);

  // Some agents (e.g. Cursor) don't expose a thinking-mode control because
  // reasoning effort is chosen at the model level. Hide the selector entirely.
  if (!selectedMode || modes.length === 0) return null;

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
      triggerVariant={variant}
      dropdownAlign={dropdownAlign}
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
