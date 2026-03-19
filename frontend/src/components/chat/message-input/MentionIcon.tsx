import { Bot } from 'lucide-react';
import { FileIcon } from '@/components/editor/file-tree/FileIcon';
import type { MentionItem } from '@/types/ui.types';

export function MentionIcon({
  type,
  name,
  className = 'h-3.5 w-3.5',
}: Pick<MentionItem, 'type' | 'name'> & { className?: string }) {
  if (type === 'agent') {
    return (
      <Bot className={`${className} shrink-0 text-text-tertiary dark:text-text-dark-tertiary`} />
    );
  }
  return <FileIcon name={name} className={className} />;
}
