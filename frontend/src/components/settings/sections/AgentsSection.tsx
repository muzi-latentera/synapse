import { FileText } from 'lucide-react';
import { agentService } from '@/services/agentService';
import { FileResourceSection } from '@/components/settings/sections/FileResourceSection';
import { lazyNamed } from '@/utils/lazyNamed';

const AgentsSettingsTab = lazyNamed(
  () => import('@/components/settings/tabs/AgentsSettingsTab'),
  'AgentsSettingsTab',
);
const AgentEditDialog = lazyNamed(
  () => import('@/components/settings/dialogs/AgentEditDialog'),
  'AgentEditDialog',
);

export function AgentsSection() {
  return (
    <FileResourceSection
      settingsKey="custom_agents"
      itemName="Agent"
      uploadFn={agentService.uploadAgent}
      deleteFn={agentService.deleteAgent}
      updateFn={agentService.updateAgent}
      uploadTitle="Upload Agent"
      acceptedExtension=".md"
      uploadIcon={FileText}
      uploadHint="The .md file must include YAML frontmatter with name and description fields. Optional fields: allowed_tools."
      renderTab={({ items, onAdd, onEdit, onDelete }) => (
        <AgentsSettingsTab
          agents={items}
          onAddAgent={onAdd}
          onEditAgent={onEdit}
          onDeleteAgent={onDelete}
        />
      )}
      renderEditDialog={({ isOpen, item, error, saving, onClose, onSave }) => (
        <AgentEditDialog
          isOpen={isOpen}
          agent={item}
          error={error}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    />
  );
}
