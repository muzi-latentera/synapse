import { useEffect } from 'react';
import { ExternalLink, Check, X, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui';
import { useOpenAIAuth } from '@/hooks/useOpenAIAuth';

interface OpenAIAuthButtonProps {
  connected: boolean;
  onConnected: () => void;
  onDisconnected: () => void;
}

export const OpenAIAuthButton: React.FC<OpenAIAuthButtonProps> = ({
  connected,
  onConnected,
  onDisconnected,
}) => {
  const {
    state,
    startDeviceFlow,
    cancel,
    reset,
    disconnectOpenAI,
    isDisconnecting,
  } = useOpenAIAuth();

  useEffect(() => {
    if (state.status === 'success') {
      onConnected();
      reset();
    }
  }, [state.status, onConnected, reset]);

  const handleDisconnect = () => {
    disconnectOpenAI(undefined, {
      onSuccess: () => onDisconnected(),
    });
  };

  if (connected && state.status === 'idle') {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-surface-tertiary p-3 dark:border-border-dark dark:bg-surface-dark-tertiary">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success-600" />
          <span className="text-sm text-text-primary dark:text-text-dark-primary">
            ChatGPT authenticated
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={startDeviceFlow}
            type="button"
          >
            Re-authenticate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === 'polling' && state.userCode) {
    return (
      <div className="mt-2 space-y-3">
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
          <p className="mb-2 text-sm text-text-secondary dark:text-text-dark-secondary">
            Enter this code at the link below:
          </p>
          <div className="mb-3 select-all rounded-md bg-surface-primary px-4 py-2 text-center font-mono text-2xl font-bold tracking-widest text-text-primary dark:bg-surface-dark-primary dark:text-text-dark-primary">
            {state.userCode}
          </div>
          <a
            href={state.verificationUriComplete || state.verificationUri || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open {state.verificationUri}
          </a>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-tertiary dark:text-text-dark-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for authorization...
          </div>
          <Button variant="ghost" size="sm" onClick={cancel} type="button">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === 'requesting') {
    return (
      <div className="mt-2">
        <Button variant="outline" size="sm" disabled type="button">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Starting login...
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={startDeviceFlow}
        type="button"
      >
        <LogIn className="mr-2 h-4 w-4" />
        Login with ChatGPT
      </Button>
      {state.status === 'error' && state.error && (
        <p className="text-xs text-error-600 dark:text-error-400">{state.error}</p>
      )}
    </div>
  );
};
