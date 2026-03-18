import { SecretsView as SecretsComponent } from '../sandbox/secrets/SecretsView';

interface SecretsViewProps {
  sandboxId?: string;
}

export function SecretsView({ sandboxId }: SecretsViewProps) {
  return (
    <div className="h-full w-full">
      <SecretsComponent sandboxId={sandboxId} />
    </div>
  );
}
