import { apiClient } from '@/lib/api';
import { ensureResponse, withAuth } from '@/services/base/BaseService';
import { ValidationError } from '@/services/base/ServiceError';
import { MAX_UPLOAD_SIZE_BYTES } from '@/config/constants';
import { uploadFile, UPLOAD_OPTIONS } from '@/services/base/uploadFile';
import type { CustomAgent } from '@/types/user.types';
import { validateRequired } from '@/utils/validation';

async function uploadAgent(file: File): Promise<CustomAgent> {
  return uploadFile<CustomAgent>(file, UPLOAD_OPTIONS.AGENT);
}

async function deleteAgent(agentName: string): Promise<void> {
  validateRequired(agentName, 'Agent name');

  await withAuth(async () => {
    await apiClient.delete(`/agents/${agentName}`);
  });
}

async function updateAgent(agentName: string, content: string): Promise<CustomAgent> {
  validateRequired(agentName, 'Agent name');
  validateRequired(content, 'Content');

  if (content.length > MAX_UPLOAD_SIZE_BYTES.AGENT) {
    throw new ValidationError('Content too large (max 100KB)');
  }

  return withAuth(async () => {
    const response = await apiClient.put<CustomAgent>(`/agents/${agentName}`, { content });
    return ensureResponse(response, 'Invalid response from server');
  });
}

export const agentService = {
  uploadAgent,
  deleteAgent,
  updateAgent,
};
