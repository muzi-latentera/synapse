import { memo } from 'react';
import toast from 'react-hot-toast';
import { GitBranch } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import { useChatContext } from '@/hooks/useChatContext';
import { useIsSplitMode } from '@/hooks/useIsSplitMode';
import { useChatStore } from '@/store/chatStore';
import { useGitBranchesQuery, useCheckoutBranchMutation } from '@/hooks/queries/useSandboxQueries';

export interface BranchSelectorProps {
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
  variant?: 'default' | 'text';
  dropdownAlign?: 'left' | 'right';
}

export const BranchSelector = memo(function BranchSelector({
  dropdownPosition = 'bottom',
  dropdownAlign,
  disabled = false,
  variant = 'default',
}: BranchSelectorProps) {
  const { sandboxId } = useChatContext();
  const worktreeCwd = useChatStore((s) => s.currentChat?.worktree_cwd) ?? undefined;
  const isSplitMode = useIsSplitMode();

  const { data: branchesData } = useGitBranchesQuery(sandboxId, !!sandboxId, worktreeCwd);
  const checkoutBranch = useCheckoutBranchMutation();

  if (!sandboxId || !branchesData?.is_git_repo || branchesData.branches.length === 0) {
    return null;
  }

  const currentBranch = branchesData.current_branch;
  const branches = branchesData.branches;

  return (
    <Dropdown
      value={currentBranch}
      items={branches}
      getItemKey={(branch) => branch}
      getItemLabel={(branch) => branch}
      onSelect={(branch) => {
        if (branch === currentBranch) return;
        checkoutBranch.mutate(
          { sandboxId, branch, cwd: worktreeCwd },
          {
            onSuccess: (data) => {
              if (data.success) {
                toast.success(`Switched to ${branch}`);
              } else {
                toast.error(data.error ?? 'Failed to switch branch');
              }
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : 'Failed to switch branch');
            },
          },
        );
      }}
      leftIcon={GitBranch}
      getItemShortLabel={(branch) => (branch.length > 16 ? branch.slice(0, 16) + '…' : branch)}
      width="w-48"
      dropdownPosition={dropdownPosition}
      disabled={disabled || checkoutBranch.isPending}
      compactOnMobile
      forceCompact={isSplitMode}
      triggerVariant={variant}
      dropdownAlign={dropdownAlign}
      searchable={branches.length >= 6}
      searchPlaceholder="Search branches..."
      itemClassName="font-mono"
    />
  );
});
