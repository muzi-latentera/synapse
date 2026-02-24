import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { workspaceService } from '@/services/workspaceService';
import type {
  WorkspaceBootstrapRequest,
  WorkspaceBootstrapResponse,
} from '@/types/workspace.types';

export const useBootstrapWorkspaceMutation = (
  options?: UseMutationOptions<WorkspaceBootstrapResponse, Error, WorkspaceBootstrapRequest>,
) => {
  return useMutation({
    mutationFn: (payload: WorkspaceBootstrapRequest) =>
      workspaceService.bootstrapWorkspace(payload),
    ...options,
  });
};
