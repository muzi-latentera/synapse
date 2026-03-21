import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { schedulerService } from '@/services/schedulerService';
import type {
  ScheduledTask,
  CreateScheduledTaskRequest,
  UpdateScheduledTaskRequest,
  TaskToggleResponse,
} from '@/types/scheduler.types';
import { createMutation } from './createMutation';
import { queryKeys } from './queryKeys';

export const useScheduledTasksQuery = (options?: Partial<UseQueryOptions<ScheduledTask[]>>) => {
  return useQuery({
    queryKey: queryKeys.scheduler.tasks,
    queryFn: () => schedulerService.getTasks(),
    ...options,
  });
};

interface UpdateScheduledTaskParams {
  taskId: string;
  data: UpdateScheduledTaskRequest;
}

export const useCreateScheduledTaskMutation = createMutation<
  ScheduledTask,
  Error,
  CreateScheduledTaskRequest
>(
  (data) => schedulerService.createTask(data),
  (queryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.tasks });
  },
);

export const useUpdateScheduledTaskMutation = createMutation<
  ScheduledTask,
  Error,
  UpdateScheduledTaskParams
>(
  ({ taskId, data }) => schedulerService.updateTask(taskId, data),
  async (queryClient, _data, variables) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.task(variables.taskId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.tasks }),
    ]);
  },
);

export const useDeleteScheduledTaskMutation = createMutation<void, Error, string>(
  (taskId) => schedulerService.deleteTask(taskId),
  (queryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.tasks });
  },
);

export const useToggleScheduledTaskMutation = createMutation<TaskToggleResponse, Error, string>(
  (taskId) => schedulerService.toggleTask(taskId),
  async (queryClient, _data, taskId) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.tasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.task(taskId) }),
    ]);
  },
);
