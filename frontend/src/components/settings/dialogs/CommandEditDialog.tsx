import type { CustomCommand } from '@/types/user.types';
import { ContentEditDialog } from '@/components/settings/dialogs/ContentEditDialog';

interface CommandEditDialogProps {
  isOpen: boolean;
  command: CustomCommand | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export const CommandEditDialog: React.FC<CommandEditDialogProps> = ({ command, ...rest }) => (
  <ContentEditDialog item={command} title={`Edit Command: /${command?.name ?? ''}`} {...rest} />
);
