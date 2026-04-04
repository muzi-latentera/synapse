import { memo, useEffect, useMemo } from 'react';
import { Cpu } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import type { DropdownItemType } from '@/components/ui/primitives/Dropdown';
import { useAuthStore } from '@/store/authStore';
import { useModelSelection } from '@/hooks/queries/useModelQueries';
import { useIsSplitMode } from '@/hooks/useIsSplitMode';
import type { AgentKind, Model } from '@/types/chat.types';

const AGENT_LABELS: Record<AgentKind, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

export interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  chatId?: string;
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
  compact?: boolean;
  lockedAgentKind?: AgentKind | null;
}

export const ModelSelector = memo(function ModelSelector({
  selectedModelId,
  onModelChange,
  chatId,
  dropdownPosition = 'bottom',
  disabled = false,
  compact,
  lockedAgentKind,
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

  return (
    <Dropdown
      value={selectedModel || filteredModels[0]}
      items={groupedItems}
      getItemKey={(model) => model.model_id}
      getItemLabel={(model) => model.name}
      getItemShortLabel={(model) => model.name}
      onSelect={(model) => onModelChange(model.model_id)}
      leftIcon={Cpu}
      width="w-64"
      dropdownPosition={dropdownPosition}
      disabled={disabled}
      compactOnMobile={compact ?? true}
      forceCompact={compact ?? isSplitMode}
      searchable
      searchPlaceholder="Search models..."
      renderItem={(model, isSelected) => (
        <span
          className={`truncate text-2xs font-medium ${isSelected ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary dark:text-text-dark-secondary'}`}
        >
          {model.name}
        </span>
      )}
    />
  );
});
