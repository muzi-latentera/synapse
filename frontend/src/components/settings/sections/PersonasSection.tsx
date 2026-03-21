import { Suspense } from 'react';
import { useSettingsContext } from '@/hooks/useSettingsContext';
import { useCrudForm } from '@/hooks/useCrudForm';
import { createDefaultPersonaForm, validatePersonaForm } from '@/utils/settings';
import { lazyNamed } from '@/utils/lazyNamed';

const PersonasSettingsTab = lazyNamed(
  () => import('@/components/settings/tabs/PersonasSettingsTab'),
  'PersonasSettingsTab',
);
const PersonaEditDialog = lazyNamed(
  () => import('@/components/settings/dialogs/PersonaEditDialog'),
  'PersonaEditDialog',
);

export function PersonasSection() {
  const { localSettings, persistSettings, setLocalSettings } = useSettingsContext();

  const personaCrud = useCrudForm(localSettings, persistSettings, setLocalSettings, {
    createDefault: createDefaultPersonaForm,
    validateForm: (form, editingIndex) =>
      validatePersonaForm(form, editingIndex, localSettings.personas || []),
    getArrayKey: 'personas',
    itemName: 'persona',
  });

  return (
    <>
      <PersonasSettingsTab
        personas={localSettings.personas ?? null}
        onAddPersona={personaCrud.handleAdd}
        onEditPersona={personaCrud.handleEdit}
        onDeletePersona={personaCrud.handleDelete}
      />
      {personaCrud.isDialogOpen && (
        <Suspense fallback={null}>
          <PersonaEditDialog
            isOpen={personaCrud.isDialogOpen}
            isEditing={personaCrud.editingIndex !== null}
            persona={personaCrud.form}
            error={personaCrud.formError}
            onClose={personaCrud.handleDialogClose}
            onSubmit={personaCrud.handleSave}
            onPersonaChange={personaCrud.handleFormChange}
          />
        </Suspense>
      )}
    </>
  );
}
