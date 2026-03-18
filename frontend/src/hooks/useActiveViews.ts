import { useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { getLeaves } from '@/utils/mosaicHelpers';
import type { ViewType } from '@/types/ui.types';

function arraysEqual(a: ViewType[], b: ViewType[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useActiveViews(): ViewType[] {
  const prevRef = useRef<ViewType[]>([]);

  return useUIStore((state) => {
    const { mosaicLayout, currentView } = state;
    let next: ViewType[];
    if (!mosaicLayout) {
      next = [currentView];
    } else if (typeof mosaicLayout === 'string') {
      next = [mosaicLayout as ViewType];
    } else {
      next = getLeaves(mosaicLayout);
    }
    if (arraysEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  });
}
