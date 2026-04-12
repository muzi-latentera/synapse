import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/primitives/Button';
import { useUIStore } from '@/store/uiStore';

export const OpenInEditorButton: React.FC<{ filePath: string }> = ({ filePath }) => (
  <Button
    type="button"
    onClick={() => useUIStore.getState().openFileInEditor(filePath)}
    variant="unstyled"
    className="rounded-sm opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/tool:opacity-100"
    title="Open in editor"
    aria-label="Open in editor"
  >
    <ExternalLink className="h-3 w-3 text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary" />
  </Button>
);
