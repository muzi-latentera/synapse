import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export const OpenInEditorButton: React.FC<{ filePath: string }> = ({ filePath }) => (
  <button
    type="button"
    onClick={() => useUIStore.getState().openFileInEditor(filePath)}
    className="rounded-sm opacity-0 transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-text-quaternary/30 group-hover/tool:opacity-100"
    title="Open in editor"
  >
    <ExternalLink className="h-3 w-3 text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary" />
  </button>
);
