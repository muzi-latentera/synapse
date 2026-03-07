import { memo } from 'react';
import toast from 'react-hot-toast';
import { GitBranch } from 'lucide-react';
import { Dropdown } from '@/components/ui/primitives/Dropdown';
import { useUIStore } from '@/store/uiStore';
import { useChatContext } from '@/hooks/useChatContext';
import { useGitBranchesQuery, useCheckoutBranchMutation } from '@/hooks/queries/useSandboxQueries';

export interface BranchSelectorProps {
  dropdownPosition?: 'top' | 'bottom';
  disabled?: boolean;
}

export const BranchSelector = memo(function BranchSelector({
  dropdownPosition = 'bottom',
  disabled = false,
}: BranchSelectorProps) {
  const { sandboxId } = useChatContext();
  const isSplitMode = useUIStore((state) => state.isSplitMode);

  const { data: branchesData } = useGitBranchesQuery(sandboxId ?? '', !!sandboxId);
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
          { sandboxId, branch },
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
      width="w-48"
      dropdownPosition={dropdownPosition}
      disabled={disabled || checkoutBranch.isPending}
      compactOnMobile
      forceCompact={isSplitMode}
      searchable={branches.length >= 6}
      searchPlaceholder="Search branches..."
      itemClassName="font-mono"
    />
  );
});
