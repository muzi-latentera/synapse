import { apiClient } from '@/lib/api';
import { ensureResponse, withAuth } from '@/services/base/BaseService';
import { ValidationError } from '@/services/base/ServiceError';
import { MAX_UPLOAD_SIZE_BYTES } from '@/config/constants';
import { validateRequired } from '@/utils/validation';

interface UploadFileOptions {
  extension: string;
  extensionLabel: string;
  maxSize: number;
  maxSizeLabel: string;
  endpoint: string;
}

export async function uploadFile<T>(file: File, options: UploadFileOptions): Promise<T> {
  validateRequired(file, 'File');

  if (!file.name.endsWith(options.extension)) {
    throw new ValidationError(`Only ${options.extensionLabel} files are allowed`);
  }

  if (file.size > options.maxSize) {
    throw new ValidationError(`File size must be less than ${options.maxSizeLabel}`);
  }

  return withAuth(async () => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.postForm<T>(options.endpoint, formData);
    return ensureResponse(response, 'Invalid response from server');
  });
}

export const UPLOAD_OPTIONS = {
  AGENT: {
    extension: '.md',
    extensionLabel: 'markdown (.md)',
    maxSize: MAX_UPLOAD_SIZE_BYTES.AGENT,
    maxSizeLabel: '100KB',
    endpoint: '/agents/upload',
  },
  SKILL: {
    extension: '.zip',
    extensionLabel: 'ZIP',
    maxSize: MAX_UPLOAD_SIZE_BYTES.SKILL,
    maxSizeLabel: '10MB',
    endpoint: '/skills/upload',
  },
} as const;
