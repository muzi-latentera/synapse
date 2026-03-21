import { FileArchive } from 'lucide-react';
import { skillService } from '@/services/skillService';
import { FileResourceSection } from '@/components/settings/sections/FileResourceSection';
import { lazyNamed } from '@/utils/lazyNamed';

const SkillsSettingsTab = lazyNamed(
  () => import('@/components/settings/tabs/SkillsSettingsTab'),
  'SkillsSettingsTab',
);
const SkillEditDialog = lazyNamed(
  () => import('@/components/settings/dialogs/SkillEditDialog'),
  'SkillEditDialog',
);

export function SkillsSection() {
  return (
    <FileResourceSection
      settingsKey="custom_skills"
      itemName="Skill"
      uploadFn={skillService.uploadSkill}
      deleteFn={skillService.deleteSkill}
      updateFn={skillService.updateSkill}
      uploadTitle="Upload Skill"
      acceptedExtension=".zip"
      uploadIcon={FileArchive}
      uploadHint="The ZIP must contain a SKILL.md file with YAML frontmatter including name and description fields."
      renderTab={({ items, onAdd, onEdit, onDelete }) => (
        <SkillsSettingsTab
          skills={items}
          onAddSkill={onAdd}
          onEditSkill={onEdit}
          onDeleteSkill={onDelete}
        />
      )}
      renderEditDialog={({ isOpen, item, error, saving, onClose, onSave }) => (
        <SkillEditDialog
          isOpen={isOpen}
          skill={item}
          error={error}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    />
  );
}
