export interface User {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
  email_verification_required: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CustomAgent {
  name: string;
  description: string;
  content: string;
  allowed_tools?: string[] | null;
  [key: string]: unknown;
}

export interface CustomMcp {
  name: string;
  description: string;
  command_type: 'npx' | 'bunx' | 'uvx' | 'http';
  package?: string;
  url?: string;
  env_vars?: Record<string, string>;
  args?: string[];
  enabled: boolean;
  [key: string]: unknown;
}

export interface CustomEnvVar {
  key: string;
  value: string;
  [key: string]: unknown;
}

export interface CustomSkill {
  name: string;
  description: string;
  size_bytes: number;
  file_count: number;
}

export interface CustomCommand {
  name: string;
  description: string;
  content: string;
  argument_hint?: string | null;
  allowed_tools?: string[] | null;
}

export interface Persona {
  name: string;
  content: string;
}

export type SandboxProviderType = 'docker' | 'host';

export interface UserSettings {
  id: string;
  user_id: string;
  github_personal_access_token: string | null;
  sandbox_provider: SandboxProviderType | null;
  custom_instructions: string | null;
  custom_agents: CustomAgent[] | null;
  custom_mcps: CustomMcp[] | null;
  custom_env_vars: CustomEnvVar[] | null;
  custom_skills: CustomSkill[] | null;
  custom_slash_commands: CustomCommand[] | null;
  personas: Persona[] | null;
  notifications_enabled?: boolean;
  auto_compact_disabled?: boolean;
  attribution_disabled?: boolean;
  created_at: string;
  updated_at: string;
}

export type UserSettingsUpdate = Partial<
  Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;
