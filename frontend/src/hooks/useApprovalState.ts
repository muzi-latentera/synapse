import { useState, useCallback } from 'react';

export interface ApprovalState {
  showRejectInput: boolean;
  alternativeInstruction: string;
  selectedRejectOptionId: string;
  setAlternativeInstruction: (value: string) => void;
  handleRejectClick: (optionId: string) => void;
  handleJustReject: () => void;
}

export function useApprovalState(
  onReject: (optionId: string, alternativeInstruction?: string) => void,
): ApprovalState {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [alternativeInstruction, setAlternativeInstruction] = useState('');
  const [selectedRejectOptionId, setSelectedRejectOptionId] = useState('');

  const handleRejectClick = useCallback(
    (optionId: string) => {
      if (showRejectInput && selectedRejectOptionId === optionId && alternativeInstruction.trim()) {
        onReject(selectedRejectOptionId, alternativeInstruction.trim());
        setAlternativeInstruction('');
        setShowRejectInput(false);
        setSelectedRejectOptionId('');
      } else {
        setSelectedRejectOptionId(optionId);
        setShowRejectInput(true);
      }
    },
    [showRejectInput, selectedRejectOptionId, alternativeInstruction, onReject],
  );

  const handleJustReject = useCallback(() => {
    onReject(selectedRejectOptionId);
    setShowRejectInput(false);
    setAlternativeInstruction('');
    setSelectedRejectOptionId('');
  }, [onReject, selectedRejectOptionId]);

  return {
    showRejectInput,
    alternativeInstruction,
    selectedRejectOptionId,
    setAlternativeInstruction,
    handleRejectClick,
    handleJustReject,
  };
}
