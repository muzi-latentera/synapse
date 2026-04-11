import { memo } from 'react';
import { Shield } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import { Button } from '@/components/ui/primitives/Button';
import { useIsSplitMode } from '@/hooks/useIsSplitMode';
import {
  useChatSettingsStore,
  DEFAULT_CHAT_SETTINGS_KEY,
  DEFAULT_PERMISSION_MODE,
  DEFAULT_PLAN_MODE,
} from '@/store/chatSettingsStore';
import type { PermissionMode } from '@/store/chatSettingsStore';
import type { AgentKind } from '@/types/chat.types';

interface PermissionModeOption {
  value: PermissionMode;
  label: string;
  description: string;
}

export const CLAUDE_PERMISSION_MODES: PermissionModeOption[] = [
  { value: 'default', label: 'Default', description: 'Ask before edits and shell actions' },
  {
    value: 'acceptEdits',
    label: 'Accept Edits',
    description: 'Auto-accept edits during the session',
  },
  { value: 'plan', label: 'Plan', description: 'Review steps before running' },
  {
    value: 'bypassPermissions',
    label: 'Bypass Permissions',
    description: 'Skip all permission checks',
  },
];

export const CODEX_PERMISSION_MODES: PermissionModeOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Read and write in workspace, ask for higher-risk actions',
  },
  { value: 'read-only', label: 'Read Only', description: 'Read access, ask to write' },
  { value: 'full-access', label: 'Full Access', description: 'Full read and write access' },
];

export const MODES_BY_AGENT: Record<AgentKind, PermissionModeOption[]> = {
  claude: CLAUDE_PERMISSION_MODES,
  codex: CODEX_PERMISSION_MODES,
};

const DEFAULT_BY_AGENT: Record<AgentKind, PermissionMode> = {
  claude: 'acceptEdits',
  codex: 'auto',
};

export function coercePermissionModeForAgent(
  permissionMode: PermissionMode,
  agentKind: AgentKind,
): PermissionMode {
  const modes = MODES_BY_AGENT[agentKind];
  const defaultMode = DEFAULT_BY_AGENT[agentKind];
  return modes.find((mode) => mode.value === permissionMode) ? permissionMode : defaultMode;
}

export function getPermissionModeOption(
  permissionMode: PermissionMode,
  agentKind: AgentKind,
): PermissionModeOption {
  const modes = MODES_BY_AGENT[agentKind];
  const effectiveMode = coercePermissionModeForAgent(permissionMode, agentKind);
  const selectedMode = modes.find((mode) => mode.value === effectiveMode);

  if (!selectedMode) {
    throw new Error(`Missing permission mode option for ${agentKind}: ${effectiveMode}`);
  }

  return selectedMode;
}

export interface PermissionModeSelectorProps {
  chatId?: string;
  agentKind?: AgentKind;
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
}

function renderPermissionItem(mode: PermissionModeOption, isSelected: boolean) {
  return (
    <>
      <span
        className={`text-2xs font-medium text-text-primary ${isSelected ? 'dark:text-text-dark-primary' : 'dark:text-text-dark-secondary'}`}
      >
        {mode.label}
      </span>
      <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
        {mode.description}
      </span>
    </>
  );
}

export const PermissionModeSelector = memo(function PermissionModeSelector({
  chatId,
  agentKind,
  dropdownPosition = 'bottom',
  disabled = false,
}: PermissionModeSelectorProps) {
  const resolvedAgentKind = agentKind ?? 'claude';
  const showPlanMode = resolvedAgentKind === 'codex';
  const key = chatId ?? DEFAULT_CHAT_SETTINGS_KEY;
  const permissionMode = useChatSettingsStore(
    (state) => state.permissionModeByChat[key] ?? DEFAULT_PERMISSION_MODE,
  );
  // Only subscribe to planMode changes for Codex — Claude never uses it
  const planMode = useChatSettingsStore((state) =>
    showPlanMode ? (state.planModeByChat[key] ?? DEFAULT_PLAN_MODE) : false,
  );
  const isSplitMode = useIsSplitMode();

  const modes = MODES_BY_AGENT[resolvedAgentKind];
  const selectedMode = getPermissionModeOption(permissionMode, resolvedAgentKind);

  const shortLabelFn = showPlanMode
    ? (mode: PermissionModeOption) => (planMode ? `${mode.label} (Plan)` : mode.label)
    : undefined;

  return (
    <Dropdown
      value={selectedMode}
      items={modes}
      getItemKey={(mode) => mode.value}
      getItemLabel={(mode) => mode.label}
      getItemShortLabel={shortLabelFn}
      onSelect={(mode) => useChatSettingsStore.getState().setPermissionMode(key, mode.value)}
      leftIcon={Shield}
      width="w-52"
      itemClassName="flex flex-col gap-0.5"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile
      forceCompact={isSplitMode}
      renderItem={renderPermissionItem}
      renderFooter={
        showPlanMode
          ? () => (
              <div className="border-t border-border/50 px-1 py-1 dark:border-border-dark/50">
                <Button
                  type="button"
                  variant="unstyled"
                  onClick={() => {
                    useChatSettingsStore.getState().setPlanMode(key, !planMode);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-surface-hover/50 dark:hover:bg-surface-dark-hover/50"
                >
                  <div className="h-3 w-3 flex-shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <span
                      className={`text-2xs font-medium ${planMode ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary dark:text-text-dark-secondary'}`}
                    >
                      Plan Mode
                    </span>
                    <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                      Review steps before executing
                    </span>
                  </div>
                  <div
                    className={`h-3.5 w-6 rounded-full transition-colors duration-200 ${planMode ? 'bg-text-primary dark:bg-text-dark-primary' : 'bg-text-quaternary/40 dark:bg-text-dark-quaternary/40'}`}
                  >
                    <div
                      className={`h-2.5 w-2.5 translate-y-0.5 rounded-full transition-transform duration-200 ${planMode ? 'translate-x-3 bg-surface dark:bg-surface-dark' : 'translate-x-0.5 bg-white dark:bg-text-dark-tertiary'}`}
                    />
                  </div>
                </Button>
              </div>
            )
          : undefined
      }
    />
  );
});
