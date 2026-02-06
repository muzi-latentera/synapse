import { apiClient } from '@/lib/api';
import { ensureResponse, withAuth } from '@/services/base';

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  has_oauth_client: boolean;
}

interface OAuthClientResponse {
  success: boolean;
  message: string;
}

interface OAuthUrlResponse {
  url: string;
}

async function uploadGmailOAuthClient(clientConfig: object): Promise<OAuthClientResponse> {
  return withAuth(async () => {
    const response = await apiClient.post<OAuthClientResponse>('/integrations/gmail/oauth-client', {
      client_config: clientConfig,
    });
    return ensureResponse(response, 'Failed to upload OAuth client');
  });
}

async function deleteGmailOAuthClient(): Promise<OAuthClientResponse> {
  return withAuth(async () => {
    const response = await apiClient.delete<OAuthClientResponse>(
      '/integrations/gmail/oauth-client',
    );
    return ensureResponse(response, 'Failed to delete OAuth client');
  });
}

async function getGmailOAuthUrl(): Promise<string> {
  return withAuth(async () => {
    const response = await apiClient.get<OAuthUrlResponse>('/integrations/gmail/oauth-url');
    const data = ensureResponse(response, 'Failed to get OAuth URL');
    return data.url;
  });
}

async function getGmailStatus(): Promise<GmailStatus> {
  return withAuth(async () => {
    const response = await apiClient.get<GmailStatus>('/integrations/gmail/status');
    return ensureResponse(response, 'Failed to get Gmail status');
  });
}

async function disconnectGmail(): Promise<OAuthClientResponse> {
  return withAuth(async () => {
    const response = await apiClient.post<OAuthClientResponse>('/integrations/gmail/disconnect');
    return ensureResponse(response, 'Failed to disconnect Gmail');
  });
}

export interface DeviceCodeResponse {
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
  expires_in: number;
  interval: number;
}

export interface DeviceCodePollResponse {
  status: 'pending' | 'success' | 'error';
  detail: string | null;
  retry_after_seconds?: number | null;
}

export interface OpenAIStatus {
  connected: boolean;
}

async function requestOpenAIDeviceCode(): Promise<DeviceCodeResponse> {
  return withAuth(async () => {
    const response = await apiClient.post<DeviceCodeResponse>('/integrations/openai/device-code');
    return ensureResponse(response, 'Failed to request device code');
  });
}

async function pollOpenAIToken(): Promise<DeviceCodePollResponse> {
  return withAuth(async () => {
    const response = await apiClient.post<DeviceCodePollResponse>('/integrations/openai/poll-token');
    return ensureResponse(response, 'Failed to poll for token');
  });
}

async function getOpenAIStatus(): Promise<OpenAIStatus> {
  return withAuth(async () => {
    const response = await apiClient.get<OpenAIStatus>('/integrations/openai/status');
    return ensureResponse(response, 'Failed to get OpenAI status');
  });
}

async function disconnectOpenAI(): Promise<OAuthClientResponse> {
  return withAuth(async () => {
    const response = await apiClient.post<OAuthClientResponse>('/integrations/openai/disconnect');
    return ensureResponse(response, 'Failed to disconnect OpenAI');
  });
}

export const integrationsService = {
  uploadGmailOAuthClient,
  deleteGmailOAuthClient,
  getGmailOAuthUrl,
  getGmailStatus,
  disconnectGmail,
  requestOpenAIDeviceCode,
  pollOpenAIToken,
  getOpenAIStatus,
  disconnectOpenAI,
};
