import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { sandboxService } from '@/services/sandboxService';
import type {
  DiffMode,
  FileContent,
  FileMetadata,
  GitCreateBranchResult,
  GitDiffData,
  GitPushPullResult,
  PortInfo,
  Secret,
  UpdateFileResult,
} from '@/types/sandbox.types';
import { createMutation } from './createMutation';
import { queryKeys } from './queryKeys';

export const usePreviewLinksQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<PortInfo[]>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.previewLinks(sandboxId),
    queryFn: () => sandboxService.getPreviewLinks(sandboxId),
    enabled: !!sandboxId,
    ...options,
  });
};

export const useIDEUrlQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<string | null>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.ideUrl(sandboxId),
    queryFn: () => sandboxService.getIDEUrl(sandboxId),
    enabled: !!sandboxId,
    ...options,
  });
};

export const useFileContentQuery = (
  sandboxId: string,
  filePath: string,
  options?: Partial<UseQueryOptions<FileContent>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.fileContent(sandboxId, filePath),
    queryFn: () => sandboxService.getFileContent(sandboxId, filePath),
    enabled: !!sandboxId && !!filePath,
    ...options,
  });
};

export const useFilesMetadataQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<FileMetadata[]>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.filesMetadata(sandboxId),
    queryFn: () => sandboxService.getSandboxFilesMetadata(sandboxId),
    enabled: !!sandboxId,
    ...options,
  });
};

export const useSecretsQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<Secret[]>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.secrets(sandboxId),
    queryFn: () => sandboxService.getSecrets(sandboxId),
    enabled: !!sandboxId,
    ...options,
  });
};

interface UpdateFileParams {
  sandboxId: string;
  filePath: string;
  content: string;
}

export const useUpdateFileMutation = createMutation<UpdateFileResult, Error, UpdateFileParams>(
  ({ sandboxId, filePath, content }) => sandboxService.updateFile(sandboxId, filePath, content),
  async (queryClient, _data, { sandboxId, filePath }) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.fileContent(sandboxId, filePath),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.filesMetadata(sandboxId),
      }),
    ]);
  },
);

type SecretMutationVariables = { sandboxId: string; key: string; value?: string };

function createSecretMutation<TVariables extends { sandboxId: string }>(
  mutationFn: (variables: TVariables) => Promise<void>,
) {
  return createMutation<void, Error, TVariables>(mutationFn, (queryClient, _data, variables) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sandbox.secrets(variables.sandboxId) });
  });
}

export const useAddSecretMutation = createSecretMutation<SecretMutationVariables>(
  ({ sandboxId, key, value }) => sandboxService.addSecret(sandboxId, key, value!),
);

export const useUpdateSecretMutation = createSecretMutation<SecretMutationVariables>(
  ({ sandboxId, key, value }) => sandboxService.updateSecret(sandboxId, key, value!),
);

export const useDeleteSecretMutation = createSecretMutation<{ sandboxId: string; key: string }>(
  ({ sandboxId, key }) => sandboxService.deleteSecret(sandboxId, key),
);

export const useGitBranchesQuery = (sandboxId: string, enabled: boolean, cwd?: string) => {
  return useQuery({
    queryKey: queryKeys.sandbox.gitBranches(sandboxId, cwd),
    queryFn: () => sandboxService.getGitBranches(sandboxId, cwd),
    enabled: !!sandboxId && enabled,
    staleTime: 30_000,
  });
};

export const useCheckoutBranchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sandboxId, branch, cwd }: { sandboxId: string; branch: string; cwd?: string }) =>
      sandboxService.checkoutGitBranch(sandboxId, branch, cwd),
    onSuccess: async (data, variables) => {
      if (!data.success) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sandbox.gitBranchesAll(variables.sandboxId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sandbox.filesMetadata(variables.sandboxId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sandbox.gitDiffAll(variables.sandboxId),
        }),
      ]);
    },
  });
};

export const useGitDiffQuery = (
  sandboxId: string,
  mode: DiffMode = 'all',
  fullContext: boolean = false,
  cwd?: string,
  options?: Partial<UseQueryOptions<GitDiffData>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.gitDiff(sandboxId, mode, fullContext, cwd),
    queryFn: () => sandboxService.getGitDiff(sandboxId, mode, fullContext, cwd),
    enabled: !!sandboxId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

interface BrowserStatus {
  running: boolean;
  current_url?: string;
}

export const useVNCUrlQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<string | null>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.vncUrl(sandboxId),
    queryFn: () => sandboxService.getVNCUrl(sandboxId),
    enabled: !!sandboxId,
    ...options,
  });
};

export const useBrowserStatusQuery = (
  sandboxId: string,
  options?: Partial<UseQueryOptions<BrowserStatus>>,
) => {
  return useQuery({
    queryKey: queryKeys.sandbox.browserStatus(sandboxId),
    queryFn: () => sandboxService.getBrowserStatus(sandboxId),
    enabled: !!sandboxId,
    refetchInterval: 5000,
    ...options,
  });
};

interface StartBrowserParams {
  sandboxId: string;
  url?: string;
}

export const useStartBrowserMutation = createMutation<BrowserStatus, Error, StartBrowserParams>(
  ({ sandboxId, url }) => sandboxService.startBrowser(sandboxId, url),
  async (queryClient, _data, variables) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.browserStatus(variables.sandboxId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.vncUrl(variables.sandboxId),
      }),
    ]);
  },
);

export const useStopBrowserMutation = createMutation<void, Error, { sandboxId: string }>(
  ({ sandboxId }) => sandboxService.stopBrowser(sandboxId),
  async (queryClient, _data, variables) => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.sandbox.browserStatus(variables.sandboxId),
    });
  },
);

export const useGitRemoteUrlQuery = (sandboxId: string, enabled: boolean, cwd?: string) => {
  return useQuery({
    queryKey: queryKeys.sandbox.gitRemoteUrl(sandboxId, cwd),
    queryFn: () => sandboxService.getGitRemoteUrl(sandboxId, cwd),
    enabled: !!sandboxId && enabled,
    staleTime: 300_000,
  });
};

export const useGitPushMutation = createMutation<
  GitPushPullResult,
  Error,
  { sandboxId: string; cwd?: string }
>(
  ({ sandboxId, cwd }) => sandboxService.gitPush(sandboxId, cwd),
  async (queryClient, _data, variables) => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.sandbox.gitBranchesAll(variables.sandboxId),
    });
  },
);

export const useGitPullMutation = createMutation<
  GitPushPullResult,
  Error,
  { sandboxId: string; cwd?: string }
>(
  ({ sandboxId, cwd }) => sandboxService.gitPull(sandboxId, cwd),
  async (queryClient, _data, variables) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.gitBranchesAll(variables.sandboxId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.filesMetadata(variables.sandboxId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.gitDiffAll(variables.sandboxId),
      }),
    ]);
  },
);

export const useGitCreateBranchMutation = createMutation<
  GitCreateBranchResult,
  Error,
  { sandboxId: string; name: string; baseBranch?: string; cwd?: string }
>(
  ({ sandboxId, name, baseBranch, cwd }) =>
    sandboxService.gitCreateBranch(sandboxId, name, baseBranch, cwd),
  async (queryClient, _data, variables) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.gitBranchesAll(variables.sandboxId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.filesMetadata(variables.sandboxId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sandbox.gitDiffAll(variables.sandboxId),
      }),
    ]);
  },
);
