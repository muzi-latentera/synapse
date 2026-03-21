import { useState, useEffect, lazy, Suspense } from 'react';

const Editor = lazy(() => import('@monaco-editor/react'));
import { BaseModal } from '@/components/ui/shared/BaseModal';
import { DialogFooter } from '@/components/ui/shared/DialogFooter';
import { DialogError } from '@/components/ui/shared/DialogError';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { MONACO_EDITOR_OPTIONS } from '@/config/constants';

interface ContentEditDialogProps {
  isOpen: boolean;
  item: { name: string; content: string } | null;
  title: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export const ContentEditDialog: React.FC<ContentEditDialogProps> = ({
  isOpen,
  item,
  title,
  error,
  saving,
  onClose,
  onSave,
}) => {
  const [editedContent, setEditedContent] = useState('');
  const theme = useResolvedTheme();

  useEffect(() => {
    if (item) {
      setEditedContent(item.content);
    }
  }, [item]);

  const handleSave = async () => {
    if (!editedContent.trim()) {
      return;
    }
    await onSave(editedContent);
  };

  const handleClose = () => {
    setEditedContent('');
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} size="4xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3 dark:border-border-dark">
        <h3 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
          {title}
        </h3>
        <button
          onClick={handleClose}
          aria-label="Close dialog"
          className="text-text-quaternary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-quaternary/30 dark:text-text-dark-quaternary dark:hover:text-text-dark-secondary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="h-[600px] p-4">
        <Suspense
          fallback={
            <div className="h-full animate-pulse rounded-lg bg-surface-secondary dark:bg-surface-dark-secondary" />
          }
        >
          <Editor
            height="100%"
            language="markdown"
            value={editedContent}
            onChange={(value) => setEditedContent(value || '')}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            options={MONACO_EDITOR_OPTIONS}
            loading={
              <div className="flex h-full items-center justify-center text-text-quaternary dark:text-text-dark-quaternary">
                Loading editor...
              </div>
            }
          />
        </Suspense>
      </div>

      <DialogError error={error} />

      <DialogFooter
        onCancel={handleClose}
        onSave={handleSave}
        saveLabel="Save Changes"
        saving={saving}
        disabled={!editedContent.trim()}
        bordered
      />
    </BaseModal>
  );
};
