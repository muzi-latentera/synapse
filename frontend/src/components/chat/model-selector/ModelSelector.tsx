import { memo, useEffect, useMemo, ComponentType, SVGProps } from 'react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import type { DropdownItemType } from '@/components/ui/primitives/Dropdown';
import { useAuthStore } from '@/store/authStore';
import { useModelSelection } from '@/hooks/queries/useModelQueries';
import { useIsSplitMode } from '@/hooks/useIsSplitMode';
import { ClaudeIcon } from '@/components/ui/icons/ClaudeIcon';
import { CodexIcon } from '@/components/ui/icons/CodexIcon';
import { formatNumberCompact } from '@/utils/format';
import type { AgentKind, Model } from '@/types/chat.types';

const AGENT_LABELS: Record<AgentKind, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

const AGENT_ICONS: Record<AgentKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  claude: ClaudeIcon,
  codex: CodexIcon,
};

export interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  chatId?: string;
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
  compact?: boolean;
  lockedAgentKind?: AgentKind | null;
  variant?: 'default' | 'text';
  dropdownAlign?: 'left' | 'right';
}

export const ModelSelector = memo(function ModelSelector({
  selectedModelId,
  onModelChange,
  chatId,
  dropdownPosition = 'bottom',
  dropdownAlign,
  disabled = false,
  compact,
  lockedAgentKind,
  variant = 'default',
}: ModelSelectorProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSplitMode = useIsSplitMode();
  const { models, isLoading } = useModelSelection({ enabled: isAuthenticated, chatId });

  const filteredModels = useMemo(
    () => (lockedAgentKind ? models.filter((m) => m.agent_kind === lockedAgentKind) : models),
    [models, lockedAgentKind],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<AgentKind, Model[]>();
    filteredModels.forEach((model) => {
      const list = groups.get(model.agent_kind) ?? [];
      list.push(model);
      groups.set(model.agent_kind, list);
    });

    const items: DropdownItemType<Model>[] = [];
    groups.forEach((agentModels, kind) => {
      items.push({ type: 'header', label: AGENT_LABELS[kind] ?? kind });
      agentModels.forEach((model) => {
        items.push({ type: 'item', data: model });
      });
    });
    return items;
  }, [filteredModels]);

  const selectedModel = filteredModels.find((m) => m.model_id === selectedModelId);

  useEffect(() => {
    if (!selectedModel && filteredModels.length > 0) {
      onModelChange(filteredModels[0].model_id);
    }
  }, [selectedModel, filteredModels, onModelChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
        <div className="h-3.5 w-16 animate-pulse rounded-full bg-text-quaternary/20" />
      </div>
    );
  }

  if (filteredModels.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
        <span className="text-xs text-text-quaternary">No models</span>
      </div>
    );
  }

  const activeModel = selectedModel || filteredModels[0];
  const activeIcon = AGENT_ICONS[activeModel.agent_kind];

  return (
    <Dropdown
      value={activeModel}
      items={groupedItems}
      getItemKey={(model) => model.model_id}
      getItemLabel={(model) => model.name}
      onSelect={(model) => onModelChange(model.model_id)}
      leftIcon={activeIcon}
      width="w-64"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile={compact ?? true}
      forceCompact={compact ?? isSplitMode}
      searchable
      searchPlaceholder="Filter..."
      searchVariant="underline"
      selectionStyle="accent"
      triggerVariant={variant}
      dropdownAlign={dropdownAlign}
      renderItem={(model, isSelected) => (
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-2xs font-medium ${isSelected ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary dark:text-text-dark-secondary'}`}
          >
            {model.name}
          </span>
          {model.context_window != null && model.context_window > 0 && (
            <span className="flex-shrink-0 rounded-md bg-surface-tertiary px-1.5 py-0.5 text-2xs font-medium text-text-quaternary dark:bg-surface-dark-tertiary dark:text-text-dark-quaternary">
              {formatNumberCompact(model.context_window)}
            </span>
          )}
        </div>
      )}
    />
  );
});
