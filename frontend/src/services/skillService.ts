import { apiClient } from '@/lib/api';
import { ensureResponse, withAuth } from '@/services/base/BaseService';
import { uploadFile, UPLOAD_OPTIONS } from '@/services/base/uploadFile';
import type { CustomSkill } from '@/types/user.types';
import { validateRequired } from '@/utils/validation';

async function uploadSkill(file: File): Promise<CustomSkill> {
  return uploadFile<CustomSkill>(file, UPLOAD_OPTIONS.SKILL);
}

async function deleteSkill(skillName: string): Promise<void> {
  validateRequired(skillName, 'Skill name');

  await withAuth(async () => {
    await apiClient.delete(`/skills/${skillName}`);
  });
}

export interface SkillFileEntry {
  path: string;
  content: string;
  is_binary: boolean;
}

interface SkillFilesResponse {
  name: string;
  files: SkillFileEntry[];
}

async function getSkillFiles(skillName: string): Promise<SkillFileEntry[]> {
  validateRequired(skillName, 'Skill name');

  return withAuth(async () => {
    const response = await apiClient.get<SkillFilesResponse>(`/skills/${skillName}/files`);
    const data = ensureResponse(response, 'Invalid response from server');
    return data.files;
  });
}

async function updateSkill(skillName: string, filesJson: string): Promise<CustomSkill> {
  validateRequired(skillName, 'Skill name');
  validateRequired(filesJson, 'Files');

  const files: SkillFileEntry[] = JSON.parse(filesJson);

  return withAuth(async () => {
    const response = await apiClient.put<CustomSkill>(`/skills/${skillName}`, { files });
    return ensureResponse(response, 'Invalid response from server');
  });
}

export const skillService = {
  uploadSkill,
  deleteSkill,
  getSkillFiles,
  updateSkill,
};
