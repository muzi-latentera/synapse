import { memo, useEffect, ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ViewType } from '@/types/ui.types';

interface SplitViewContainerProps {
  renderView: (view: ViewType, slot: 'single' | 'primary' | 'secondary') => ReactNode;
}

export const SplitViewContainer = memo(function SplitViewContainer({
  renderView,
}: SplitViewContainerProps) {
  const currentView = useUIStore((state) => state.currentView);
  const secondaryView = useUIStore((state) => state.secondaryView);
  const isSplitMode = useUIStore((state) => state.isSplitMode);
  const splitDirection = useUIStore((state) => state.splitDirection);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && useUIStore.getState().isSplitMode) {
        useUIStore.getState().exitSplitMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isMobile || !isSplitMode || !secondaryView) {
    return (
      <div className="flex h-full flex-1 overflow-hidden">{renderView(currentView, 'single')}</div>
    );
  }

  return (
    <PanelGroup
      direction={splitDirection}
      autoSaveId={`split-view-${splitDirection}`}
      className="flex-1"
    >
      <Panel defaultSize={50} minSize={20}>
        <div className="flex h-full w-full flex-1 overflow-hidden">
          {renderView(currentView, 'primary')}
        </div>
      </Panel>

      <PanelResizeHandle
        className={cn(
          'group relative',
          splitDirection === 'horizontal' ? 'w-px' : 'h-px',
          'bg-border dark:bg-border-dark',
          'hover:bg-text-primary dark:hover:bg-text-dark-primary',
          'transition-colors duration-150',
        )}
      >
        <div
          className={cn(
            'absolute',
            splitDirection === 'horizontal'
              ? 'inset-y-0 -left-2 -right-2 cursor-col-resize'
              : 'inset-x-0 -bottom-2 -top-2 cursor-row-resize',
          )}
        />
      </PanelResizeHandle>

      <Panel minSize={20}>
        <div className="relative flex h-full w-full flex-1 overflow-hidden">
          {renderView(secondaryView, 'secondary')}
          <button
            onClick={() => useUIStore.getState().exitSplitMode()}
            className={cn(
              'absolute z-10 flex items-center justify-center',
              'h-5 w-5 rounded-md',
              'bg-surface-secondary/90 dark:bg-surface-dark-secondary/90',
              'border border-border/50 dark:border-border-dark/50',
              'text-text-tertiary dark:text-text-dark-tertiary',
              'hover:text-text-primary dark:hover:text-text-dark-primary',
              'hover:bg-surface-hover dark:hover:bg-surface-dark-hover',
              'transition-colors duration-200',
              'right-2 top-2',
            )}
            title="Close split view (Esc)"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </Panel>
    </PanelGroup>
  );
});
