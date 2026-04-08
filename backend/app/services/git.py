import asyncio
import re
from typing import Literal

from app.models.schemas.sandbox import (
    GitBranchesResponse,
    GitCheckoutResponse,
    GitCommandResponse,
    GitCreateBranchResponse,
    GitDiffResponse,
    GitRemoteUrlResponse,
)
from app.services.exceptions import SandboxException
from app.services.sandbox import SandboxService
from app.utils.sandbox import BRANCH_NAME_RE, git_cd_prefix

GITHUB_REMOTE_RE = re.compile(
    r"(?:https?://github\.com/|git@github\.com:)([^/]+)/([^/]+?)(?:\.git)?$"
)


class GitService:
    def __init__(self, sandbox_service: SandboxService) -> None:
        self.sandbox_service = sandbox_service

    async def get_diff(
        self,
        sandbox_id: str,
        mode: Literal["all", "staged", "unstaged", "branch"] = "all",
        full_context: bool = False,
        cwd: str | None = None,
    ) -> GitDiffResponse:
        cd_prefix = git_cd_prefix(cwd)
        check = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git rev-parse --is-inside-work-tree 2>/dev/null",
        )
        if check.exit_code != 0:
            return GitDiffResponse(diff="", has_changes=False, is_git_repo=False)

        # Large context window so the patch includes the entire file,
        # enabling full-file diff view
        ctx = " -U99999" if full_context else ""

        untracked_diff = (
            " git ls-files --others --exclude-standard -z"
            f" | xargs -0 -I{{}} git diff{ctx} --no-index -- /dev/null {{}} 2>/dev/null"
        )

        if mode == "branch":
            # Diff current HEAD against the merge-base with the default branch.
            # Detect default branch via the remote HEAD symref, falling back
            # to main/master.
            cmd = (
                "base=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/||');"
                " [ -z \"$base\" ] && base=$(git branch -r 2>/dev/null | grep -oE 'origin/(main|master|develop|trunk)' | head -1 | tr -d ' ');"
                ' [ -z "$base" ] && for b in main master develop trunk; do'
                " git rev-parse --verify $b >/dev/null 2>&1 && base=$b && break; done;"
                ' if [ -z "$base" ]; then exit 2; fi;'
                ' merge_base=$(git merge-base "$base" HEAD 2>/dev/null || echo "$base");'
                f' git diff{ctx} "$merge_base" HEAD 2>/dev/null'
            )
        elif mode == "staged":
            cmd = f"git diff{ctx} --cached 2>/dev/null"
        elif mode == "unstaged":
            cmd = f"git diff{ctx} 2>/dev/null;{untracked_diff}"
        else:
            # "all" mode: try `git diff HEAD` first (combined staged+unstaged
            # in one pass); falls back to separate staged + unstaged when HEAD
            # doesn't exist (initial commit).
            cmd = (
                f"{{ git diff{ctx} HEAD 2>/dev/null"
                f" || {{ git diff{ctx} --cached 2>/dev/null; git diff{ctx} 2>/dev/null; }}; }};"
                f"{untracked_diff}"
            )

        result = await self.sandbox_service.execute_command(
            sandbox_id, f"{cd_prefix}{cmd}"
        )
        if mode == "branch" and result.exit_code == 2:
            return GitDiffResponse(
                diff="",
                has_changes=False,
                is_git_repo=True,
                error="Could not determine base branch",
            )
        diff_output = result.stdout
        return GitDiffResponse(
            diff=diff_output,
            has_changes=bool(diff_output.strip()),
            is_git_repo=True,
        )

    async def get_branches(
        self,
        sandbox_id: str,
        cwd: str | None = None,
    ) -> GitBranchesResponse:
        cd_prefix = git_cd_prefix(cwd)
        check = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git rev-parse --is-inside-work-tree 2>/dev/null",
        )
        if check.exit_code != 0:
            return GitBranchesResponse(
                branches=[], current_branch="", is_git_repo=False
            )

        head_result, local_result, remote_result = await asyncio.gather(
            self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git rev-parse --abbrev-ref HEAD 2>/dev/null",
            ),
            self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git branch --no-color 2>/dev/null",
            ),
            self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git branch -r --no-color 2>/dev/null",
            ),
        )
        current_branch = head_result.stdout.strip()

        local_branches: set[str] = set()
        for line in local_result.stdout.splitlines():
            name = line.removeprefix("* ").strip()
            if name:
                local_branches.add(name)

        # Merge remote-only branches into the list so the UI shows branches
        # the user can check out even if they don't exist locally yet.
        # Skip symref lines like "origin/HEAD -> origin/main".
        all_branches = set(local_branches)
        for line in remote_result.stdout.splitlines():
            name = line.strip()
            if not name or " -> " in name or not name.startswith("origin/"):
                continue
            short = name.removeprefix("origin/")
            if short not in all_branches:
                all_branches.add(short)

        return GitBranchesResponse(
            branches=sorted(all_branches),
            current_branch=current_branch,
            is_git_repo=True,
        )

    async def checkout(
        self,
        sandbox_id: str,
        branch: str,
        cwd: str | None = None,
    ) -> GitCheckoutResponse:
        self._validate_branch_name(branch)
        cd_prefix = git_cd_prefix(cwd)

        result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git checkout '{branch}' 2>&1",
        )
        if result.exit_code != 0:
            # Branch might only exist as a remote tracking branch
            result = await self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git checkout -b '{branch}' 'origin/{branch}' 2>&1",
            )

        if result.exit_code != 0:
            return GitCheckoutResponse(
                success=False,
                current_branch="",
                error=result.stdout.strip() or result.stderr.strip(),
            )

        head_result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git rev-parse --abbrev-ref HEAD 2>/dev/null",
        )
        current = head_result.stdout.strip()
        if current == "HEAD":
            # Detached HEAD (e.g. checking out a tag or SHA) — revert to the
            # previous branch so the UI always has a named branch to display
            await self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git checkout - 2>/dev/null",
            )
            return GitCheckoutResponse(
                success=False,
                current_branch="",
                error="Cannot checkout: would result in detached HEAD",
            )
        return GitCheckoutResponse(success=True, current_branch=current)

    async def run_command(
        self,
        sandbox_id: str,
        command: str,
        cwd: str | None = None,
    ) -> GitCommandResponse:
        # Execute a simple git command and return success/failure with output.
        cd_prefix = git_cd_prefix(cwd)
        result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}{command} 2>&1",
        )
        if result.exit_code != 0:
            return GitCommandResponse(
                success=False,
                output="",
                error=result.stdout.strip() or result.stderr.strip(),
            )
        return GitCommandResponse(success=True, output=result.stdout.strip())

    async def push(self, sandbox_id: str, cwd: str | None = None) -> GitCommandResponse:
        return await self.run_command(sandbox_id, "git push -u origin HEAD", cwd)

    async def pull(self, sandbox_id: str, cwd: str | None = None) -> GitCommandResponse:
        return await self.run_command(sandbox_id, "git pull", cwd)

    async def commit(
        self, sandbox_id: str, message: str, cwd: str | None = None
    ) -> GitCommandResponse:
        # Shell-escape single quotes so the commit message can contain
        # apostrophes
        msg = message.replace("'", "'\\''")
        return await self.run_command(
            sandbox_id, f"git add -A && git commit -m '{msg}'", cwd
        )

    async def create_branch(
        self,
        sandbox_id: str,
        name: str,
        base_branch: str | None = None,
        cwd: str | None = None,
    ) -> GitCreateBranchResponse:
        self._validate_branch_name(name)
        if base_branch:
            self._validate_branch_name(base_branch, label="base branch")
        cd_prefix = git_cd_prefix(cwd)

        base = f" '{base_branch}'" if base_branch else ""
        result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git checkout -b '{name}'{base} 2>&1",
        )
        if result.exit_code != 0 and base_branch:
            # Base branch might only exist as a remote tracking branch
            result = await self.sandbox_service.execute_command(
                sandbox_id,
                f"{cd_prefix}git checkout -b '{name}' 'origin/{base_branch}' 2>&1",
            )
        if result.exit_code != 0:
            return GitCreateBranchResponse(
                success=False,
                current_branch="",
                error=result.stdout.strip() or result.stderr.strip(),
            )

        head_result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git rev-parse --abbrev-ref HEAD 2>/dev/null",
        )
        return GitCreateBranchResponse(
            success=True,
            current_branch=head_result.stdout.strip(),
        )

    async def get_remote_url(
        self,
        sandbox_id: str,
        cwd: str | None = None,
    ) -> GitRemoteUrlResponse:
        cd_prefix = git_cd_prefix(cwd)
        result = await self.sandbox_service.execute_command(
            sandbox_id,
            f"{cd_prefix}git remote get-url origin 2>/dev/null",
        )
        if result.exit_code != 0:
            raise SandboxException("No git remote origin found", status_code=404)

        remote_url = result.stdout.strip()
        # Only parse GitHub remotes — other forges (GitLab, Gitea, etc.) are
        # not supported
        match = GITHUB_REMOTE_RE.match(remote_url)
        if not match:
            raise SandboxException(
                "No GitHub remote detected — only github.com remotes are supported"
            )
        return GitRemoteUrlResponse(
            owner=match.group(1),
            repo=match.group(2),
            remote_url=remote_url,
        )

    @staticmethod
    def _validate_branch_name(name: str, label: str = "branch") -> None:
        if (
            not BRANCH_NAME_RE.match(name)
            or ".." in name
            or name.strip(".") == ""
            or name.startswith("-")
        ):
            raise ValueError(f"Invalid {label} name")
