export type WorkspaceSourceType = 'git';

export interface WorkspaceBootstrapRequest {
  source_type: WorkspaceSourceType;
  git_url: string;
}

export interface WorkspaceBootstrapResponse {
  source_type: WorkspaceSourceType;
  workspace_path: string;
}
