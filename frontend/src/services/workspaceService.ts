import { apiClient } from '@/lib/api';
import { ensureResponse, serviceCall } from '@/services/base/BaseService';
import type {
  WorkspaceBootstrapRequest,
  WorkspaceBootstrapResponse,
} from '@/types/workspace.types';

async function bootstrapWorkspace(
  payload: WorkspaceBootstrapRequest,
): Promise<WorkspaceBootstrapResponse> {
  return serviceCall(async () => {
    const response = await apiClient.post<WorkspaceBootstrapResponse>(
      '/chat/workspaces/bootstrap',
      payload,
    );
    return ensureResponse(response, 'Failed to initialize workspace');
  });
}

export const workspaceService = {
  bootstrapWorkspace,
};
