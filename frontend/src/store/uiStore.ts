import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ThemeState,
  UIState,
  UIActions,
  SplitViewState,
  SplitViewActions,
  ViewType,
} from '@/types/ui.types';
import { MOBILE_BREAKPOINT } from '@/config/constants';
import { getLeaves, isMosaicSplitNode, removeTileFromLayout } from '@/utils/mosaicHelpers';

type UIStoreState = ThemeState &
  Pick<UIState, 'sidebarOpen'> &
  Pick<UIActions, 'setSidebarOpen'> &
  SplitViewState &
  SplitViewActions & {
    commandMenuOpen: boolean;
    setCommandMenuOpen: (open: boolean) => void;
    pendingFilePath: string | null;
    openFileInEditor: (path: string) => void;
  };

const getInitialSidebarState = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= MOBILE_BREAKPOINT;
};

export const useUIStore = create<UIStoreState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((state) => {
          const next =
            state.theme === 'dark' ? 'light' : state.theme === 'light' ? 'system' : 'dark';
          return { theme: next };
        }),
      setTheme: (theme) => set({ theme }),
      sidebarOpen: getInitialSidebarState(),
      setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),

      commandMenuOpen: false,
      setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),

      pendingFilePath: null,
      openFileInEditor: (path) => {
        set({ pendingFilePath: path });
        const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
        if (isMobile) {
          set({ currentView: 'editor', mosaicLayout: 'editor' });
        } else {
          const state = get();
          const layout = state.mosaicLayout;
          if (layout && isMosaicSplitNode(layout)) {
            const leaves = getLeaves(layout);
            if (!leaves.includes('editor')) {
              set({ mosaicLayout: { direction: 'row', first: layout, second: 'editor' } });
            }
          } else {
            const currentView = (layout ?? state.currentView) as ViewType;
            if (currentView !== 'editor') {
              set({
                mosaicLayout: {
                  direction: 'row',
                  first: currentView,
                  second: 'editor',
                },
              });
            }
          }
        }
      },

      currentView: 'agent',
      splitDirection: 'row',
      mosaicLayout: null,

      setCurrentView: (view) =>
        set({
          currentView: view,
          mosaicLayout: view,
        }),

      exitSplitMode: () => {
        const state = get();
        set({ mosaicLayout: state.currentView });
      },

      setSplitDirection: (direction) => set({ splitDirection: direction }),

      setMosaicLayout: (layout) => {
        if (layout === null) {
          set({ mosaicLayout: null });
          return;
        }
        if (typeof layout === 'string') {
          set({
            mosaicLayout: layout,
            currentView: layout as ViewType,
          });
        } else {
          const leaves = getLeaves(layout);
          set({
            mosaicLayout: layout,
            currentView: leaves[0] as ViewType,
          });
        }
      },

      addTileToMosaic: (view, direction) => {
        const state = get();
        const currentLayout = state.mosaicLayout ?? state.currentView;

        const leaves = typeof currentLayout === 'string' ? [currentLayout] : getLeaves(currentLayout);
        if (leaves.includes(view)) return;

        set({
          mosaicLayout: {
            direction,
            first: currentLayout,
            second: view,
          },
          currentView: leaves[0] as ViewType,
        });
      },

      removeTileFromMosaic: (view) => {
        const layout = get().mosaicLayout;
        if (!layout || typeof layout === 'string') return;
        const remaining = getLeaves(layout).filter((v) => v !== view);
        if (remaining.length === 0) return;
        if (remaining.length === 1) {
          set({ currentView: remaining[0], mosaicLayout: remaining[0] });
        } else {
          const newLayout = removeTileFromLayout(layout, view);
          if (newLayout) get().setMosaicLayout(newLayout);
        }
      },

      handleViewClick: (view, isShiftClick) => {
        if (
          isShiftClick &&
          typeof window !== 'undefined' &&
          window.innerWidth >= MOBILE_BREAKPOINT
        ) {
          get().addTileToMosaic(view, get().splitDirection);
        } else {
          set({
            currentView: view,
            mosaicLayout: view,
          });
        }
      },
    }),
    {
      name: 'ui-storage',
      version: 6,
      partialize: (state) => ({
        theme: state.theme,
        currentView: state.currentView,
        splitDirection: state.splitDirection,
        sidebarOpen: state.sidebarOpen,
      }),
      migrate: (persisted) => {
        const state = persisted as Record<string, unknown>;
        delete state.isSplitMode;
        delete state.secondaryView;
        delete state.permissionMode;
        delete state.thinkingMode;
        delete state.mosaicLayout;
        if (state.splitDirection === 'horizontal') state.splitDirection = 'row';
        if (state.splitDirection === 'vertical') state.splitDirection = 'column';
        return state;
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
      }),
    },
  ),
);
