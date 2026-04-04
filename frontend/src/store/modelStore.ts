import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelSelectionState } from '@/types/ui.types';

export const useModelStore = create<ModelSelectionState>()(
  persist(
    (set, get) => ({
      modelByChat: {},
      selectModel: (chatId: string, modelId: string) => {
        const trimmedId = modelId?.trim();
        if (trimmedId && get().modelByChat[chatId] !== trimmedId) {
          set((state) => ({
            modelByChat: { ...state.modelByChat, [chatId]: trimmedId },
          }));
        }
      },
    }),
    { name: 'model-storage' },
  ),
);
