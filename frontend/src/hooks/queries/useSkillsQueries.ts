import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { skillService } from '@/services/skillService';
import type { CustomSkill } from '@/types/user.types';
import { queryKeys } from './queryKeys';

export const useSkillsQuery = (options?: Partial<UseQueryOptions<CustomSkill[]>>) => {
  return useQuery({
    queryKey: [queryKeys.skills],
    queryFn: () => skillService.listSkills(),
    ...options,
  });
};
