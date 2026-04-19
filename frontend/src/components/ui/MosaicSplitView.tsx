import { useCallback, useMemo, ReactNode } from 'react';
import { Button } from '@/components/ui/primitives/Button';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import { X, SplitSquareHorizontal } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { mosaicLayoutToLibrary, libraryToMosaicLayout, getLeaves } from '@/utils/mosaicHelpers';
import type { ViewType, MosaicLayoutNode } from '@/types/ui.types';

import 'react-mosaic-component/react-mosaic-component.css';
import '@/styles/mosaic-theme.css';

const VIEW_LABELS: Record<ViewType, string> = {
  agent: 'Agent',
  diff: 'Diff',
  editor: 'Editor',
  prReview: 'PR Review Inbox',
  terminal: 'Terminal',
  secrets: 'Secrets',
};

interface MosaicSplitViewProps {
  mosaicLayout: MosaicLayoutNode;
  renderView: (view: ViewType, slot: string) => ReactNode;
}

export function MosaicSplitView({ mosaicLayout, renderView }: MosaicSplitViewProps) {
  const handleMosaicChange = useCallback((newNode: Parameters<typeof libraryToMosaicLayout>[0]) => {
    const layout = libraryToMosaicLayout(newNode);
    useUIStore.getState().setMosaicLayout(layout);
  }, []);

  const leaves = useMemo(() => getLeaves(mosaicLayout), [mosaicLayout]);
  const libraryValue = useMemo(() => mosaicLayoutToLibrary(mosaicLayout), [mosaicLayout]);

  return (
    <div className="mosaic-agentrove flex h-full flex-1 overflow-hidden">
      <Mosaic<string>
        value={libraryValue}
        onChange={handleMosaicChange}
        className=""
        renderTile={(id, path) => (
          <MosaicWindow<string>
            path={path}
            title={VIEW_LABELS[id as ViewType] ?? id}
            toolbarControls={
              <div className="flex items-center gap-0.5 pr-0.5">
                {leaves.length > 1 && (
                  <Button
                    variant="unstyled"
                    onClick={() => useUIStore.getState().removeTileFromMosaic(id as ViewType)}
                    className={cn(
                      'flex items-center justify-center',
                      'h-5 w-5 rounded-md',
                      'text-text-tertiary dark:text-text-dark-tertiary',
                      'hover:text-text-primary dark:hover:text-text-dark-primary',
                      'transition-colors duration-200',
                    )}
                    title="Close tile"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            }
            renderToolbar={(props) => (
              <div
                className={cn(
                  'flex h-7 items-center justify-between px-2',
                  'bg-surface-secondary dark:bg-surface-dark-secondary',
                  'border-b border-border/50 dark:border-border-dark/50',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <SplitSquareHorizontal className="h-3 w-3 text-text-quaternary dark:text-text-dark-quaternary" />
                  <span className="text-2xs font-medium text-text-secondary dark:text-text-dark-secondary">
                    {props.title}
                  </span>
                </div>
                <div className="flex items-center">{props.toolbarControls}</div>
              </div>
            )}
          >
            <div className="flex h-full w-full overflow-hidden">
              {renderView(id as ViewType, `tile-${id}`)}
            </div>
          </MosaicWindow>
        )}
        resize={{ minimumPaneSizePercentage: 15 }}
      />
    </div>
  );
}
