import { FileText } from 'lucide-react';
import { commandService } from '@/services/commandService';
import { FileResourceSection } from '@/components/settings/sections/FileResourceSection';
import { lazyNamed } from '@/utils/lazyNamed';

const CommandsSettingsTab = lazyNamed(
  () => import('@/components/settings/tabs/CommandsSettingsTab'),
  'CommandsSettingsTab',
);
const CommandEditDialog = lazyNamed(
  () => import('@/components/settings/dialogs/CommandEditDialog'),
  'CommandEditDialog',
);

export function CommandsSection() {
  return (
    <FileResourceSection
      settingsKey="custom_slash_commands"
      itemName="Command"
      uploadFn={commandService.uploadCommand}
      deleteFn={commandService.deleteCommand}
      updateFn={commandService.updateCommand}
      uploadTitle="Upload Slash Command"
      acceptedExtension=".md"
      uploadIcon={FileText}
      uploadHint="The .md file must include YAML frontmatter with name and description fields. Optional fields: argument-hint, allowed-tools, model."
      renderTab={({ items, onAdd, onEdit, onDelete }) => (
        <CommandsSettingsTab
          commands={items}
          onAddCommand={onAdd}
          onEditCommand={onEdit}
          onDeleteCommand={onDelete}
        />
      )}
      renderEditDialog={({ isOpen, item, error, saving, onClose, onSave }) => (
        <CommandEditDialog
          isOpen={isOpen}
          command={item}
          error={error}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    />
  );
}
