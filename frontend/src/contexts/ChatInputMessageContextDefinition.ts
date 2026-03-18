import { createContext } from 'react';

interface ChatInputMessageContextValue {
  inputMessage: string;
  setInputMessage: (msg: string) => void;
}

export const ChatInputMessageContext = createContext<ChatInputMessageContextValue | null>(null);
