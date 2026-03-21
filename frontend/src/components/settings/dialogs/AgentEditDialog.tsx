import type { CustomAgent } from '@/types/user.types';
import { ContentEditDialog } from '@/components/settings/dialogs/ContentEditDialog';

interface AgentEditDialogProps {
  isOpen: boolean;
  agent: CustomAgent | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export const AgentEditDialog: React.FC<AgentEditDialogProps> = ({ agent, ...rest }) => (
  <ContentEditDialog item={agent} title={`Edit Agent: ${agent?.name ?? ''}`} {...rest} />
);
