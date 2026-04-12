import { Loader2 } from 'lucide-react';
import { DesktopDragRegion } from '@/components/layout/TitleBar';

export function LoadingScreen() {
  return (
    <div className="min-h-viewport flex flex-col bg-surface dark:bg-surface-dark">
      <DesktopDragRegion />
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-text-quaternary dark:text-text-dark-quaternary" />
          <p className="text-text-dark-quaternary">Loading...</p>
        </div>
      </div>
    </div>
  );
}
