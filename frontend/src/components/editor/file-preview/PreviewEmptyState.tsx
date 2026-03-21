import { memo } from 'react';
import { PreviewContainer } from './PreviewContainer';
import { previewBackgroundClass } from './previewConstants';

interface PreviewEmptyStateProps {
  fileName: string;
  message: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const PreviewEmptyState = memo(function PreviewEmptyState({
  fileName,
  message,
  isFullscreen,
  onToggleFullscreen,
}: PreviewEmptyStateProps) {
  return (
    <PreviewContainer
      fileName={fileName}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      contentClassName={`flex items-center justify-center ${previewBackgroundClass}`}
    >
      <p className="text-text-tertiary dark:text-text-dark-tertiary">{message}</p>
    </PreviewContainer>
  );
});
