import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  integrationsService,
  type DeviceCodeResponse,
} from '@/services/integrationsService';
import toast from 'react-hot-toast';

type DeviceFlowStatus = 'idle' | 'requesting' | 'polling' | 'success' | 'error';

interface DeviceFlowState {
  status: DeviceFlowStatus;
  userCode: string | null;
  verificationUri: string | null;
  verificationUriComplete: string | null;
  error: string | null;
}

const SETTINGS_KEY = ['settings'] as const;

export const useOpenAIAuth = () => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DeviceFlowState>({
    status: 'idle',
    userCode: null,
    verificationUri: null,
    verificationUriComplete: null,
    error: null,
  });
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const abortedRef = useRef(false);
  const nextDelayRef = useRef<number>(5000);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    inFlightRef.current = false;
  }, []);

  const schedulePoll = useCallback(
    (delayMs: number) => {
      pollingRef.current = setTimeout(async () => {
        if (abortedRef.current || inFlightRef.current) {
          pollingRef.current = null;
          return;
        }
        inFlightRef.current = true;

        try {
          const result = await integrationsService.pollOpenAIToken();

          if (result.status === 'success') {
            stopPolling();
            setState((prev) => ({ ...prev, status: 'success' }));
            toast.success('ChatGPT connected');
            queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
            return;
          }

          if (result.status === 'error') {
            stopPolling();
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: result.detail || 'Authentication failed',
            }));
            toast.error(result.detail || 'Authentication failed');
            return;
          }

          if (result.retry_after_seconds && result.retry_after_seconds > 0) {
            nextDelayRef.current = result.retry_after_seconds * 1000;
          }

          inFlightRef.current = false;
          if (!abortedRef.current) {
            schedulePoll(nextDelayRef.current);
          }
        } catch (err) {
          stopPolling();
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Connection error during polling',
          }));
        }
      }, delayMs);
    },
    [queryClient, stopPolling],
  );

  const startDeviceFlow = useCallback(async () => {
    stopPolling();
    abortedRef.current = false;
    nextDelayRef.current = 5000;
    setState({
      status: 'requesting',
      userCode: null,
      verificationUri: null,
      verificationUriComplete: null,
      error: null,
    });

    let deviceCode: DeviceCodeResponse;
    try {
      deviceCode = await integrationsService.requestOpenAIDeviceCode();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to start login flow',
      }));
      return;
    }

    setState({
      status: 'polling',
      userCode: deviceCode.user_code,
      verificationUri: deviceCode.verification_uri,
      verificationUriComplete: deviceCode.verification_uri_complete,
      error: null,
    });

    nextDelayRef.current = Math.max(deviceCode.interval, 5) * 1000;
    schedulePoll(nextDelayRef.current);
  }, [schedulePoll, stopPolling]);

  const cancel = useCallback(() => {
    abortedRef.current = true;
    stopPolling();
    setState({
      status: 'idle',
      userCode: null,
      verificationUri: null,
      verificationUriComplete: null,
      error: null,
    });
  }, [stopPolling]);

  const disconnectMutation = useMutation({
    mutationFn: integrationsService.disconnectOpenAI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast.success('OpenAI disconnected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect OpenAI');
    },
  });

  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: 'idle',
      userCode: null,
      verificationUri: null,
      verificationUriComplete: null,
      error: null,
    });
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    state,
    startDeviceFlow,
    cancel,
    reset,
    disconnectOpenAI: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
};
