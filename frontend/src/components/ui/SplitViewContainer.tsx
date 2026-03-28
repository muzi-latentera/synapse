import { memo, lazy, Suspense, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Spinner } from '@/components/ui/primitives/Spinner';
import { isMosaicSplitNode } from '@/utils/mosaicHelpers';
import type { ViewType } from '@/types/ui.types';

const MosaicSplitView = lazy(() =>
  import('@/components/ui/MosaicSplitView').then((m) => ({ default: m.MosaicSplitView })),
);

const mosaicFallback = (
  <div className="flex h-full w-full items-center justify-center bg-surface-secondary dark:bg-surface-dark-secondary">
    <Spinner size="md" className="text-text-quaternary dark:text-text-dark-quaternary" />
  </div>
);

interface SplitViewContainerProps {
  renderView: (view: ViewType, slot: string) => ReactNode;
}

export const SplitViewContainer = memo(function SplitViewContainer({
  renderView,
}: SplitViewContainerProps) {
  const currentView = useUIStore((state) => state.currentView);
  const mosaicLayout = useUIStore((state) => state.mosaicLayout);
  const isMobile = useIsMobile();

  const isSingleView = isMobile || !mosaicLayout || !isMosaicSplitNode(mosaicLayout);

  if (isSingleView) {
    const view: ViewType = typeof mosaicLayout === 'string' ? mosaicLayout : currentView;
    return <div className="flex h-full flex-1 overflow-hidden">{renderView(view, 'single')}</div>;
  }

  return (
    <Suspense fallback={mosaicFallback}>
      <MosaicSplitView mosaicLayout={mosaicLayout} renderView={renderView} />
    </Suspense>
  );
});
