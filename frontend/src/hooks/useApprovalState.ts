import { useState, useCallback } from 'react';

export interface ApprovalState {
  showRejectInput: boolean;
  alternativeInstruction: string;
  setAlternativeInstruction: (value: string) => void;
  handleRejectClick: () => void;
  handleJustReject: () => void;
}

export function useApprovalState(
  onReject: (alternativeInstruction?: string) => void,
): ApprovalState {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [alternativeInstruction, setAlternativeInstruction] = useState('');

  const handleRejectClick = useCallback(() => {
    if (showRejectInput && alternativeInstruction.trim()) {
      onReject(alternativeInstruction.trim());
      setAlternativeInstruction('');
      setShowRejectInput(false);
    } else {
      setShowRejectInput(true);
    }
  }, [showRejectInput, alternativeInstruction, onReject]);

  const handleJustReject = useCallback(() => {
    onReject();
    setShowRejectInput(false);
    setAlternativeInstruction('');
  }, [onReject]);

  return {
    showRejectInput,
    alternativeInstruction,
    setAlternativeInstruction,
    handleRejectClick,
    handleJustReject,
  };
}
