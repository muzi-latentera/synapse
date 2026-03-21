import { DeviceAuthButton, type DeviceAuthConfig } from './DeviceAuthButton';

const COPILOT_CONFIG: DeviceAuthConfig = {
  deviceCodeEndpoint: '/integrations/copilot/device-code',
  pollTokenEndpoint: '/integrations/copilot/poll-token',
  buildPollBody: (resp) => ({ device_code: resp.device_code }),
  buildResult: (pollResp) => pollResp.access_token!,
  labels: {
    login: 'Login with GitHub Copilot',
    connected: 'GitHub Copilot connected',
    helperText: 'Optional if already authenticated via CLI. Requires a GitHub Copilot subscription.',
    errorPrefix: 'GitHub',
  },
};

interface CopilotAuthButtonProps {
  value: string | null;
  onChange: (token: string | null) => void;
}

export const CopilotAuthButton: React.FC<CopilotAuthButtonProps> = ({ value, onChange }) => (
  <DeviceAuthButton value={value} onChange={onChange} config={COPILOT_CONFIG} />
);
