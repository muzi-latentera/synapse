import { useState, useMemo, useRef } from 'react';
import { GitPullRequest } from 'lucide-react';
import toast from 'react-hot-toast';
import { BaseModal } from '@/components/ui/shared/BaseModal';
import { Button } from '@/components/ui/primitives/Button';
import { useChatStore } from '@/store/chatStore';
import { sandboxService } from '@/services/sandboxService';
import {
  useGitBranchesQuery,
  useGitDiffQuery,
  useGitRemoteUrlQuery,
} from '@/hooks/queries/useSandboxQueries';
import {
  useGitHubCollaboratorsQuery,
  useCreatePullRequestMutation,
} from '@/hooks/queries/useGitHubQueries';

interface CreatePRDialogProps {
  onClose: () => void;
}

const DIFF_HEADER_RE = /^a\/(.+?) b\//;
const DEFAULT_BASES = ['main', 'master', 'develop', 'trunk'];

function parseChangedFiles(
  diff: string,
): Array<{ path: string; additions: number; deletions: number }> {
  const files: Array<{ path: string; additions: number; deletions: number }> = [];
  const chunks = diff.split(/^diff --git /m);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const headerMatch = chunk.match(DIFF_HEADER_RE);
    if (!headerMatch) continue;
    const path = headerMatch[1];
    let additions = 0;
    let deletions = 0;
    for (const line of chunk.split('\n')) {
      if (line[0] === '+' && !line.startsWith('+++')) additions++;
      else if (line[0] === '-' && !line.startsWith('---')) deletions++;
    }
    files.push({ path, additions, deletions });
  }
  return files;
}

export function CreatePRDialog({ onClose }: CreatePRDialogProps) {
  const currentChat = useChatStore((s) => s.currentChat);
  const sandboxId = currentChat?.sandbox_id ?? '';
  const worktreeCwd = currentChat?.worktree_cwd ?? undefined;

  const { data: remoteUrl } = useGitRemoteUrlQuery(sandboxId, !!sandboxId, worktreeCwd);
  const owner = remoteUrl?.owner ?? '';
  const repo = remoteUrl?.repo ?? '';

  const { data: branchesData } = useGitBranchesQuery(sandboxId, !!sandboxId, worktreeCwd);
  const { data: diffData } = useGitDiffQuery(sandboxId, 'branch', false, worktreeCwd);
  const { data: collaborators } = useGitHubCollaboratorsQuery(owner, repo, !!owner && !!repo);

  const changedFiles = useMemo(
    () => (diffData?.diff ? parseChangedFiles(diffData.diff) : []),
    [diffData?.diff],
  );

  const defaultBody = useMemo(() => {
    const parts: string[] = [];
    if (changedFiles.length > 0) {
      parts.push('**Changed files:**');
      for (const f of changedFiles.slice(0, 15)) {
        const stat = `+${f.additions} −${f.deletions}`;
        parts.push(`- \`${f.path}\` (${stat})`);
      }
      if (changedFiles.length > 15) {
        parts.push(`- ...and ${changedFiles.length - 15} more`);
      }
    }
    return parts.join('\n');
  }, [changedFiles]);

  const headBranch = branchesData?.current_branch ?? '';
  const detectedBase = useMemo(() => {
    const candidates = branchesData?.branches.filter((b) => b !== headBranch) ?? [];
    return candidates.find((b) => DEFAULT_BASES.includes(b)) ?? '';
  }, [branchesData?.branches, headBranch]);

  const [title, setTitle] = useState(currentChat?.title?.slice(0, 72) ?? '');
  const [body, setBody] = useState(defaultBody);
  const [baseBranch, setBaseBranch] = useState('');
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const bodyEditedRef = useRef(false);

  const prevDefaultBodyRef = useRef(defaultBody);
  if (prevDefaultBodyRef.current !== defaultBody && !bodyEditedRef.current) {
    prevDefaultBodyRef.current = defaultBody;
    setBody(defaultBody);
  }

  const prevDetectedBaseRef = useRef(detectedBase);
  if (prevDetectedBaseRef.current !== detectedBase && !baseBranch) {
    prevDetectedBaseRef.current = detectedBase;
    setBaseBranch(detectedBase);
  }

  const createPR = useCreatePullRequestMutation();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!owner || !repo) {
      toast.error('Could not detect GitHub repository');
      return;
    }
    if (!headBranch) {
      toast.error('Could not detect current branch');
      return;
    }
    if (!baseBranch.trim()) {
      toast.error('Please select a base branch');
      return;
    }

    try {
      const pushResult = await sandboxService.gitPush(sandboxId, worktreeCwd);
      if (!pushResult.success) {
        toast.error(`Push failed: ${pushResult.error || 'Could not push branch to remote'}`);
        return;
      }

      const result = await createPR.mutateAsync({
        owner,
        repo,
        title: title.trim(),
        body,
        head: headBranch,
        base: baseBranch,
        reviewers: selectedReviewers,
      });
      toast.success(
        <span>
          Created PR #{result.number}:{' '}
          <a href={result.html_url} target="_blank" rel="noopener noreferrer" className="underline">
            View on GitHub
          </a>
        </span>,
        { duration: 6000 },
      );
      if (result.reviewer_warning) {
        toast.error(result.reviewer_warning, { duration: 5000 });
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create pull request');
    }
  };

  const toggleReviewer = (login: string) => {
    setSelectedReviewers((prev) =>
      prev.includes(login) ? prev.filter((r) => r !== login) : [...prev, login],
    );
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="md"
      zIndex="modalHighest"
      className="overflow-visible"
    >
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <GitPullRequest className="h-4 w-4 text-text-tertiary dark:text-text-dark-tertiary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              Create pull request
            </h2>
            {headBranch && (
              <p className="font-mono text-2xs text-text-tertiary dark:text-text-dark-tertiary">
                {headBranch} → {baseBranch}
              </p>
            )}
          </div>
        </div>

        {!owner ? (
          <p className="mt-4 text-xs text-text-tertiary dark:text-text-dark-tertiary">
            No GitHub remote detected for this workspace.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PR title"
                className="w-full rounded-lg border border-border/50 bg-surface-secondary px-3 py-1.5 text-xs text-text-primary outline-none transition-colors duration-200 focus:border-border-hover dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:focus:border-border-dark-hover"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                Description
              </label>
              <textarea
                value={body}
                onChange={(e) => {
                  bodyEditedRef.current = true;
                  setBody(e.target.value);
                }}
                rows={5}
                className="w-full resize-none rounded-lg border border-border/50 bg-surface-secondary px-3 py-2 text-xs text-text-primary outline-none transition-colors duration-200 focus:border-border-hover dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:focus:border-border-dark-hover"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                  Base branch
                </label>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-surface-secondary px-3 py-1.5 text-xs text-text-primary outline-none transition-colors duration-200 focus:border-border-hover dark:border-border-dark/50 dark:bg-surface-dark-secondary dark:text-text-dark-primary dark:focus:border-border-dark-hover"
                >
                  {branchesData?.branches
                    .filter((b) => b !== headBranch)
                    .map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                  Reviewers
                </label>
                <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-surface-secondary px-2 py-1 dark:border-border-dark/50 dark:bg-surface-dark-secondary">
                  {!collaborators || collaborators.length === 0 ? (
                    <span className="px-1 py-0.5 text-2xs text-text-quaternary dark:text-text-dark-quaternary">
                      No collaborators
                    </span>
                  ) : (
                    collaborators.map((c) => (
                      <button
                        key={c.login}
                        type="button"
                        onClick={() => toggleReviewer(c.login)}
                        className={`rounded px-1.5 py-0.5 text-2xs transition-colors duration-200 ${
                          selectedReviewers.includes(c.login)
                            ? 'bg-text-primary text-surface dark:bg-text-dark-primary dark:text-surface-dark'
                            : 'text-text-secondary hover:bg-surface-hover dark:text-text-dark-secondary dark:hover:bg-surface-dark-hover'
                        }`}
                      >
                        {c.login}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {changedFiles.length > 0 && (
              <div>
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-wider text-text-quaternary dark:text-text-dark-quaternary">
                  Changed files ({changedFiles.length})
                </label>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-border/50 bg-surface-secondary p-2 dark:border-border-dark/50 dark:bg-surface-dark-secondary">
                  {changedFiles.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center justify-between py-0.5 font-mono text-2xs text-text-secondary dark:text-text-dark-secondary"
                    >
                      <span className="truncate">{f.path}</span>
                      <span className="ml-2 flex-shrink-0 text-text-quaternary dark:text-text-dark-quaternary">
                        +{f.additions} −{f.deletions}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!diffData?.has_changes && (
              <p className="text-xs text-text-quaternary dark:text-text-dark-quaternary">
                No changes detected on this branch. Make sure you have committed your changes.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border/50 px-5 py-3.5 dark:border-border-dark/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={createPR.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={createPR.isPending || !owner}
        >
          {createPR.isPending ? 'Creating...' : 'Create pull request'}
        </Button>
      </div>
    </BaseModal>
  );
}
