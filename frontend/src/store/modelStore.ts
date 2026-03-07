import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelSelectionState } from '@/types/ui.types';

export const useModelStore = create<ModelSelectionState>()(
  persist(
    (set) => ({
      modelByChat: {},
      selectModel: (chatId: string, modelId: string) => {
        const trimmedId = modelId?.trim();
        if (trimmedId) {
          set((state) => ({
            modelByChat: { ...state.modelByChat, [chatId]: trimmedId },
          }));
        }
      },
    }),
    { name: 'model-storage' },
  ),
);
