import { Suspense, type ReactNode, type ComponentType } from 'react';
import { useSettingsContext } from '@/hooks/useSettingsContext';
import { useFileResourceManagement } from '@/hooks/useFileResourceManagement';
import { SettingsUploadModal } from '@/components/ui/SettingsUploadModal';

type SettingsArrayKey = 'custom_agents' | 'custom_skills' | 'custom_slash_commands';

interface FileResourceSectionProps<T extends { name: string }> {
  settingsKey: SettingsArrayKey;
  itemName: string;
  uploadFn: (file: File) => Promise<T>;
  deleteFn: (name: string) => Promise<void>;
  updateFn: (name: string, content: string) => Promise<T>;
  uploadTitle: string;
  acceptedExtension: string;
  uploadIcon: ComponentType<{ className?: string }>;
  uploadHint: string;
  renderTab: (props: {
    items: T[] | null;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void | Promise<void>;
  }) => ReactNode;
  renderEditDialog: (props: {
    isOpen: boolean;
    item: T | null;
    error: string | null;
    saving: boolean;
    onClose: () => void;
    onSave: (content: string) => Promise<void>;
  }) => ReactNode;
}

export function FileResourceSection<T extends { name: string }>({
  settingsKey,
  itemName,
  uploadFn,
  deleteFn,
  updateFn,
  uploadTitle,
  acceptedExtension,
  uploadIcon,
  uploadHint,
  renderTab,
  renderEditDialog,
}: FileResourceSectionProps<T>) {
  const { localSettings, setLocalSettings } = useSettingsContext();

  const management = useFileResourceManagement(localSettings, setLocalSettings, {
    settingsKey,
    itemName,
    uploadFn,
    deleteFn,
    updateFn,
  });

  return (
    <>
      {renderTab({
        items: (localSettings[settingsKey] as T[] | undefined) ?? null,
        onAdd: management.handleAdd,
        onEdit: management.handleEdit,
        onDelete: management.handleDelete,
      })}
      <SettingsUploadModal
        isOpen={management.isDialogOpen}
        error={management.uploadError}
        uploading={management.isUploading}
        onClose={management.handleDialogClose}
        onUpload={management.handleUpload}
        title={uploadTitle}
        acceptedExtension={acceptedExtension}
        icon={uploadIcon}
        hintText={uploadHint}
      />
      {management.isEditDialogOpen && (
        <Suspense fallback={null}>
          {renderEditDialog({
            isOpen: management.isEditDialogOpen,
            item: management.editingItem,
            error: management.editError,
            saving: management.isSavingEdit,
            onClose: management.handleEditDialogClose,
            onSave: management.handleSaveEdit,
          })}
        </Suspense>
      )}
    </>
  );
}
