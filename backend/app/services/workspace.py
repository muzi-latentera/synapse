import asyncio
import shutil
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.services.exceptions import ChatException, ErrorCode

settings = get_settings()

WORKSPACES_DIR_NAME = "workspaces"
GIT_CLONE_TIMEOUT_SECONDS = 180


class WorkspaceService:
    def __init__(self) -> None:
        self._base_dir = (Path(settings.STORAGE_PATH) / WORKSPACES_DIR_NAME).resolve()
        self._base_dir.mkdir(parents=True, exist_ok=True)

    async def bootstrap_workspace(
        self,
        user_id: UUID,
        source_type: str,
        git_url: str,
    ) -> str:
        user_workspace_dir = (self._base_dir / str(user_id)).resolve()
        user_workspace_dir.mkdir(parents=True, exist_ok=True)

        if source_type == "git":
            normalized_url = self._normalize_git_url(git_url)
            return await self._clone_git_workspace(user_workspace_dir, normalized_url)

        raise ChatException(
            "Unsupported workspace source type",
            error_code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
        )

    async def _clone_git_workspace(self, user_workspace_dir: Path, git_url: str) -> str:
        repo_name = self._extract_repo_name(git_url)
        workspace_dir = user_workspace_dir / f"{repo_name}-{uuid4().hex[:8]}"

        process = await asyncio.create_subprocess_exec(
            "git",
            "clone",
            "--depth",
            "1",
            git_url,
            str(workspace_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=GIT_CLONE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            await asyncio.to_thread(shutil.rmtree, workspace_dir, True)
            raise ChatException(
                "Git clone timed out",
                error_code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
            ) from exc

        if process.returncode != 0:
            await asyncio.to_thread(shutil.rmtree, workspace_dir, True)
            error_output = (
                stderr.decode("utf-8", errors="replace").strip()
                or stdout.decode("utf-8", errors="replace").strip()
                or "Failed to clone repository"
            )
            raise ChatException(
                error_output,
                error_code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
            )

        return str(workspace_dir)

    @staticmethod
    def _normalize_git_url(git_url: str) -> str:
        candidate = git_url.strip()
        if not candidate:
            raise ChatException(
                "git_url is required for git workspace",
                error_code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
            )

        if candidate.startswith("git@"):
            return candidate

        parsed = urlparse(candidate)
        if parsed.scheme != "https":
            raise ChatException(
                "git_url must be an HTTPS or git@... SSH URL",
                error_code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
            )
        if parsed.username or parsed.password:
            raise ChatException(
                "git_url must not contain embedded credentials",
                error_code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
            )
        return candidate

    @staticmethod
    def _extract_repo_name(git_url: str) -> str:
        normalized = git_url.rstrip("/")
        if normalized.startswith("git@"):
            normalized = normalized.split(":", 1)[-1]
        else:
            normalized = urlparse(normalized).path
        raw_name = normalized.rsplit("/", 1)[-1]
        if raw_name.endswith(".git"):
            raw_name = raw_name[:-4]
        safe_name = "".join(
            char if char.isalnum() or char in {"-", "_"} else "-" for char in raw_name
        )
        safe_name = safe_name.strip("-")
        return safe_name or "workspace"
