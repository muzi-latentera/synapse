import { apiClient } from '@/lib/api';
import { ensureResponse, withAuth } from '@/services/base/BaseService';
import type { CustomSkill } from '@/types/user.types';
import { validateRequired } from '@/utils/validation';

async function listSkills(): Promise<CustomSkill[]> {
  return withAuth(async () => {
    const response = await apiClient.get<CustomSkill[]>('/skills');
    return ensureResponse(response, 'Failed to fetch skills');
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
    const data = ensureResponse(response, 'Failed to fetch skill files');
    return data.files;
  });
}

async function updateSkill(skillName: string, filesJson: string): Promise<CustomSkill> {
  validateRequired(skillName, 'Skill name');
  validateRequired(filesJson, 'Files');

  const files: SkillFileEntry[] = JSON.parse(filesJson);

  return withAuth(async () => {
    const response = await apiClient.put<CustomSkill>(`/skills/${skillName}`, { files });
    return ensureResponse(response, 'Failed to update skill');
  });
}

export const skillService = {
  listSkills,
  getSkillFiles,
  updateSkill,
};
