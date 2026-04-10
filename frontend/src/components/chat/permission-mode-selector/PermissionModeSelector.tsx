import { memo } from 'react';
import { Check, ChevronDown, ClipboardList, Shield } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import { Button } from '@/components/ui/primitives/Button';
import { SelectItem } from '@/components/ui/primitives/SelectItem';
import { useDropdown } from '@/hooks/useDropdown';
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

const ClaudePermissionModeSelector = memo(function ClaudePermissionModeSelector({
  chatId,
  dropdownPosition = 'bottom',
  disabled = false,
}: Omit<PermissionModeSelectorProps, 'agentKind'>) {
  const key = chatId ?? DEFAULT_CHAT_SETTINGS_KEY;
  const permissionMode = useChatSettingsStore(
    (state) => state.permissionModeByChat[key] ?? DEFAULT_PERMISSION_MODE,
  );
  const isSplitMode = useIsSplitMode();

  const modes = CLAUDE_PERMISSION_MODES;
  const selectedMode = getPermissionModeOption(permissionMode, 'claude');

  return (
    <Dropdown
      value={selectedMode}
      items={modes}
      getItemKey={(mode) => mode.value}
      getItemLabel={(mode) => mode.label}
      onSelect={(mode) => useChatSettingsStore.getState().setPermissionMode(key, mode.value)}
      leftIcon={Shield}
      width="w-52"
      itemClassName="flex flex-col gap-0.5"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile
      forceCompact={isSplitMode}
      renderItem={(mode, isSelected) => (
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
      )}
    />
  );
});

const CodexPermissionModeSelector = memo(function CodexPermissionModeSelector({
  chatId,
  dropdownPosition = 'bottom',
  disabled = false,
}: Omit<PermissionModeSelectorProps, 'agentKind'>) {
  const key = chatId ?? DEFAULT_CHAT_SETTINGS_KEY;
  const permissionMode = useChatSettingsStore(
    (state) => state.permissionModeByChat[key] ?? DEFAULT_PERMISSION_MODE,
  );
  const planMode = useChatSettingsStore((state) => state.planModeByChat[key] ?? DEFAULT_PLAN_MODE);
  const isSplitMode = useIsSplitMode();
  const { isOpen, dropdownRef, setIsOpen } = useDropdown();

  const modes = CODEX_PERMISSION_MODES;
  const selectedMode = getPermissionModeOption(permissionMode, 'codex');
  const effectiveMode = selectedMode.value;

  const triggerLabel = planMode ? `${selectedMode.label} (Plan)` : selectedMode.label;

  const showIconOnly = isSplitMode;
  const labelClasses = `${showIconOnly ? 'hidden ' : ''}truncate text-2xs font-medium text-text-primary dark:text-text-dark-secondary`;
  const chevronClasses = showIconOnly
    ? 'hidden'
    : 'h-3 w-3 flex-shrink-0 text-text-quaternary dark:text-text-dark-quaternary transition-transform duration-200';

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        variant="unstyled"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 ${isOpen && !disabled ? 'bg-surface-hover dark:bg-surface-dark-hover' : 'hover:bg-surface-hover/60 dark:hover:bg-surface-dark-hover/60'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <Shield
          className={`h-3 w-3 flex-shrink-0 text-text-tertiary dark:text-text-dark-tertiary ${!isSplitMode ? 'sm:hidden' : ''}`}
        />
        <span className={labelClasses}>{triggerLabel}</span>
        {!disabled && <ChevronDown className={`${chevronClasses} ${isOpen ? 'rotate-180' : ''}`} />}
      </Button>

      {isOpen && !disabled && (
        <div
          role="listbox"
          className={`absolute left-0 z-[60] w-52 rounded-xl border border-border bg-surface-secondary/95 shadow-medium backdrop-blur-xl backdrop-saturate-150 dark:border-border-dark dark:bg-surface-dark-secondary/95 dark:shadow-black/40 ${dropdownPosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          <div className="space-y-px p-1">
            {modes.map((mode) => {
              const isSelected = mode.value === effectiveMode;
              return (
                <SelectItem
                  key={mode.value}
                  isSelected={isSelected}
                  role="option"
                  onSelect={() => {
                    useChatSettingsStore.getState().setPermissionMode(key, mode.value);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={`h-3 w-3 flex-shrink-0 transition-opacity duration-150 ${isSelected ? 'text-text-primary opacity-100 dark:text-text-dark-primary' : 'opacity-0'}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-2xs font-medium text-text-primary ${isSelected ? 'dark:text-text-dark-primary' : 'dark:text-text-dark-secondary'}`}
                    >
                      {mode.label}
                    </span>
                    <span className="text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                      {mode.description}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </div>

          <div className="border-t border-border/50 px-1 py-1 dark:border-border-dark/50">
            <Button
              type="button"
              variant="unstyled"
              onClick={() => {
                useChatSettingsStore.getState().setPlanMode(key, !planMode);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-surface-hover/50 dark:hover:bg-surface-dark-hover/50"
            >
              <ClipboardList
                className={`h-3 w-3 flex-shrink-0 ${planMode ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-tertiary dark:text-text-dark-tertiary'}`}
              />
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
        </div>
      )}
    </div>
  );
});

export const PermissionModeSelector = memo(function PermissionModeSelector({
  agentKind,
  ...props
}: PermissionModeSelectorProps) {
  const resolvedAgentKind = agentKind ?? 'claude';

  if (resolvedAgentKind === 'codex') {
    return <CodexPermissionModeSelector {...props} />;
  }
  return <ClaudePermissionModeSelector {...props} />;
});
