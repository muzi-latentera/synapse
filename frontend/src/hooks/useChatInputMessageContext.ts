import { ChatInputMessageContext } from '@/contexts/ChatInputMessageContextDefinition';
import { createContextHook } from '@/hooks/createContextHook';

export const useChatInputMessageContext = createContextHook(
  ChatInputMessageContext,
  'useChatInputMessageContext',
  'ChatInputMessageProvider',
);
