import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { modelService } from '@/services/modelService';
import type { Model } from '@/types/chat.types';
import { useModelStore } from '@/store/modelStore';
import { queryKeys } from './queryKeys';

const EMPTY_MODEL_MAP = new Map<string, Model>();

export const useModelsQuery = (options?: Partial<UseQueryOptions<Model[]>>) => {
  return useQuery({
    queryKey: [queryKeys.models],
    queryFn: () => modelService.getModels(),
    ...options,
  });
};

export const useModelSelection = (options?: { enabled?: boolean }) => {
  const { data: models = [], isLoading } = useModelsQuery({
    enabled: options?.enabled,
  });
  const selectedModelId = useModelStore((state) => state.selectedModelId);

  useEffect(() => {
    if (models.length === 0) return;
    const selectedExists = models.some((m) => m.model_id === selectedModelId);
    if (!selectedExists) {
      useModelStore.getState().selectModel(models[0].model_id);
    }
  }, [models, selectedModelId]);

  const selectedModel = useMemo(
    () => models.find((m) => m.model_id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const selectModel = useCallback(
    (modelId: string) => useModelStore.getState().selectModel(modelId),
    [],
  );

  return { models, selectedModelId, selectedModel, selectModel, isLoading };
};

export function useModelMap(): Map<string, Model> {
  const { data: models } = useModelsQuery();
  return useMemo(
    () => (models ? new Map(models.map((m) => [m.model_id, m])) : EMPTY_MODEL_MAP),
    [models],
  );
}
