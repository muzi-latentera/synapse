import { Suspense } from 'react';
import { useModelsQuery } from '@/hooks/queries/useModelQueries';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { lazyNamed } from '@/utils/lazyNamed';

const TasksSettingsTab = lazyNamed(
  () => import('@/components/settings/tabs/TasksSettingsTab'),
  'TasksSettingsTab',
);
const TaskDialog = lazyNamed(
  () => import('@/components/settings/dialogs/TaskDialog'),
  'TaskDialog',
);

interface TasksSectionProps {
  isActive: boolean;
}

export function TasksSection({ isActive }: TasksSectionProps) {
  const { data: models = [] } = useModelsQuery({ enabled: isActive });
  const defaultModelId = models.length > 0 ? models[0].model_id : '';
  const taskManagement = useTaskManagement(defaultModelId);

  return (
    <>
      <TasksSettingsTab
        onAddTask={taskManagement.handleAddTask}
        onEditTask={taskManagement.handleEditTask}
      />
      {taskManagement.isTaskDialogOpen && (
        <Suspense fallback={null}>
          <TaskDialog
            isOpen={taskManagement.isTaskDialogOpen}
            isEditing={taskManagement.editingTaskId !== null}
            task={taskManagement.taskForm}
            error={taskManagement.taskFormError}
            onClose={taskManagement.handleTaskDialogClose}
            onSubmit={taskManagement.handleSaveTask}
            onTaskChange={taskManagement.handleTaskFormChange}
          />
        </Suspense>
      )}
    </>
  );
}
