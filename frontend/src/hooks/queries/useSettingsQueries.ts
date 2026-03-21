import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { settingsService } from '@/services/settingsService';
import type { UserSettings, UserSettingsUpdate } from '@/types/user.types';
import { createMutation } from './createMutation';
import { queryKeys } from './queryKeys';

export const useSettingsQuery = (options?: Partial<UseQueryOptions<UserSettings>>) => {
  return useQuery({
    queryKey: [queryKeys.settings],
    queryFn: () => settingsService.getSettings(),
    ...options,
  });
};

export const useUpdateSettingsMutation = createMutation<UserSettings, Error, UserSettingsUpdate>(
  (data) => settingsService.updateSettings(data),
  (queryClient, data) => {
    queryClient.setQueryData([queryKeys.settings], data);
  },
);
