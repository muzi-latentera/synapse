import { useUIStore } from '@/store/uiStore';

export function useIsSplitMode(): boolean {
  return useUIStore(
    (state) => state.mosaicLayout !== null && typeof state.mosaicLayout !== 'string',
  );
}
