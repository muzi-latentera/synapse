from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import zipfile
from pathlib import Path
from typing import Any, Callable, Coroutine

from app.core.config import get_settings
from app.constants import (
    CLAUDE_DIR,
    CODEX_DIR,
    SANDBOX_CLAUDE_DIR,
    SANDBOX_CLAUDE_JSON_PATH,
    SANDBOX_GIT_ASKPASS_PATH,
    SANDBOX_HOME_DIR,
)
from app.models.types import CustomEnvVarDict
from app.services.exceptions import SandboxException
from app.services.sandbox_providers import (
    PtyDataCallbackType,
    PtySize,
    SandboxProvider,
)
from app.services.sandbox_providers.types import CommandResult
from app.services.skill import SkillService

settings = get_settings()
logger = logging.getLogger(__name__)


class SandboxService:
    @staticmethod
    def build_env_vars(
        custom_env_vars: list[CustomEnvVarDict] | None,
        github_token: str | None,
    ) -> dict[str, str]:
        # Merge user-level env vars and github token into a single dict
        # that gets injected into every sandbox command execution.
        envs: dict[str, str] = {}
        if custom_env_vars:
            for ev in custom_env_vars:
                envs[ev["key"]] = ev["value"]
        # Desktop mode uses the host's native git credentials; only inject
        # token-based auth inside Docker containers.
        if github_token and not settings.DESKTOP_MODE:
            envs["GITHUB_TOKEN"] = github_token
            envs["GIT_ASKPASS"] = str(SANDBOX_GIT_ASKPASS_PATH)
        return envs

    def __init__(
        self,
        provider: SandboxProvider,
        env_vars: dict[str, str] | None = None,
        session_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.provider = provider
        # User-level env vars (custom_env_vars + github token) loaded from DB,
        # injected into every command execution.
        self.env_vars = env_vars or {}
        self.session_factory = session_factory

    @staticmethod
    def _get_claude_auth_paths() -> tuple[
        list[tuple[Path, str]], list[tuple[Path, str]]
    ]:
        home_path = Path(os.environ.get("HOME", ""))
        auth_files: list[tuple[Path, str]] = []
        auth_dirs = [(CLAUDE_DIR, SANDBOX_CLAUDE_DIR)]

        if home_path != Path("."):
            auth_files.append((home_path / ".claude.json", SANDBOX_CLAUDE_JSON_PATH))

        return auth_files, auth_dirs

    @staticmethod
    def _get_codex_auth_paths() -> tuple[
        list[tuple[Path, str]], list[tuple[Path, str]]
    ]:
        return [
            (CODEX_DIR / "config.toml", f"{SANDBOX_HOME_DIR}/.codex/config.toml"),
        ], [
            (CODEX_DIR, f"{SANDBOX_HOME_DIR}/.codex"),
        ]

    @staticmethod
    async def _write_file_to_sandbox(
        provider: SandboxProvider, sandbox_id: str, path: str, content: str
    ) -> None:
        try:
            await provider.write_file(sandbox_id, path, content)
        except OSError:
            logger.debug("Failed to sync %s to sandbox %s", path, sandbox_id)

    @staticmethod
    async def sync_cli_auth(provider: SandboxProvider, sandbox_id: str) -> None:
        # Copy the host's Claude/Codex auth credentials into the sandbox so the
        # CLI inside the container can make authenticated API calls without the
        # user re-authenticating.
        claude_files, claude_dirs = SandboxService._get_claude_auth_paths()
        codex_files, codex_dirs = SandboxService._get_codex_auth_paths()
        auth_files = [*claude_files, *codex_files]
        auth_dirs = [*claude_dirs, *codex_dirs]

        writes: list[tuple[str, str]] = []

        for host_file, sandbox_path in auth_files:
            try:
                content = host_file.read_text()
            except OSError:
                continue
            writes.append((sandbox_path, content))

        for host_dir, sandbox_dir in auth_dirs:
            try:
                json_files = list(host_dir.glob("*.json"))
            except OSError:
                continue
            for json_file in json_files:
                try:
                    content = json_file.read_text()
                    writes.append((f"{sandbox_dir}/{json_file.name}", content))
                except OSError:
                    pass

        await asyncio.gather(
            *[
                SandboxService._write_file_to_sandbox(provider, sandbox_id, p, c)
                for p, c in writes
            ],
            return_exceptions=True,
        )

    async def cleanup(self) -> None:
        await self.provider.cleanup()

    async def delete_sandbox(self, sandbox_id: str) -> None:
        if not sandbox_id:
            return
        try:
            await self.provider.delete_sandbox(sandbox_id)
        except Exception as e:
            logger.warning(
                "Failed to delete sandbox %s: %s",
                sandbox_id,
                e,
                exc_info=True,
                extra={"sandbox_id": sandbox_id},
            )

    async def execute_command(
        self,
        sandbox_id: str,
        command: str,
    ) -> CommandResult:
        return await self.provider.execute_command(
            sandbox_id, command, envs=self.env_vars or None
        )

    async def create_pty_session(
        self,
        sandbox_id: str,
        rows: int,
        cols: int,
        tmux_session: str,
        on_data: PtyDataCallbackType,
    ) -> str:
        pty_session = await self.provider.create_pty(
            sandbox_id,
            rows,
            cols,
            tmux_session,
            on_data=on_data,
        )
        return pty_session.id

    async def send_pty_input(
        self, sandbox_id: str, pty_session_id: str, data: bytes
    ) -> None:
        try:
            await self.provider.send_pty_input(sandbox_id, pty_session_id, data)
        except Exception as e:
            logger.error("Failed to send PTY input: %s", e)
            await self.cleanup_pty_session(sandbox_id, pty_session_id)

    async def resize_pty_session(
        self, sandbox_id: str, pty_session_id: str, rows: int, cols: int
    ) -> None:
        try:
            await self.provider.resize_pty(
                sandbox_id, pty_session_id, PtySize(rows=rows, cols=cols)
            )
        except Exception as e:
            logger.error(
                "Failed to resize PTY for sandbox %s: %s", sandbox_id, e, exc_info=True
            )

    async def cleanup_pty_session(self, sandbox_id: str, pty_session_id: str) -> None:
        try:
            await self.provider.kill_pty(sandbox_id, pty_session_id)
        except OSError as e:
            logger.error(
                "Error killing PTY process for session %s: %s",
                pty_session_id,
                e,
                exc_info=True,
            )

    async def get_files_metadata(self, sandbox_id: str) -> list[dict[str, Any]]:
        metadata = await self.provider.list_files(sandbox_id)
        return [
            {
                "path": m.path,
                "type": m.type,
                "is_binary": m.is_binary,
            }
            for m in metadata
        ]

    async def get_file_content(self, sandbox_id: str, file_path: str) -> dict[str, Any]:
        try:
            content = await self.provider.read_file(sandbox_id, file_path)
            return {
                "path": content.path,
                "content": content.content,
                "type": content.type,
                "is_binary": content.is_binary,
            }
        except Exception as e:
            raise SandboxException(f"Failed to read file {file_path}: {str(e)}")

    async def generate_zip_download(self, sandbox_id: str) -> bytes:
        metadata_items = await self.provider.list_files(sandbox_id)

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for item in metadata_items:
                if item.type == "file":
                    file_path = item.path

                    try:
                        content = await self.provider.read_file(sandbox_id, file_path)

                        if content.is_binary:
                            zip_file.writestr(
                                file_path, base64.b64decode(content.content)
                            )
                        else:
                            zip_file.writestr(
                                file_path, content.content.encode("utf-8")
                            )
                    except Exception as e:
                        logger.warning(
                            "Failed to write file %s to zip: %s", file_path, e
                        )
                        continue

        zip_buffer.seek(0)
        return zip_buffer.read()

    async def _deploy_resources(
        self,
        sandbox_id: str,
    ) -> None:
        # In desktop mode, resources already live under the host's CLI config
        # directories (~/.claude and ~/.codex), which the sandbox reads
        # directly, so there is nothing to copy.
        if settings.DESKTOP_MODE:
            return

        skill_service = SkillService(base_paths=SkillService.get_default_base_paths())

        skill_paths = skill_service.get_all_skill_paths()

        writes: list[tuple[str, str | bytes]] = []

        for skill in skill_paths:
            skill_name = skill["name"]
            skill_dir = Path(skill["path"])

            if not skill_dir.is_dir():
                logger.warning(
                    "Skill directory not found: %s at %s", skill_name, skill_dir
                )
                continue

            for f in skill_dir.rglob("*"):
                if not f.is_file():
                    continue
                try:
                    file_bytes = f.read_bytes()
                except OSError:
                    continue
                rel = str(f.relative_to(skill_dir))
                writes.extend(
                    SkillService.format_for_sandbox(skill_name, rel, file_bytes)
                )

        if not writes:
            return

        try:
            async with asyncio.TaskGroup() as tg:
                for remote_path, content in writes:
                    tg.create_task(
                        self.provider.write_file(sandbox_id, remote_path, content)
                    )

            logger.info(
                "Deployed %d skills (%d files) to sandbox %s",
                len(skill_paths),
                len(writes),
                sandbox_id,
            )
        except Exception as e:
            logger.error("Failed to deploy resources to sandbox %s: %s", sandbox_id, e)
            raise SandboxException(f"Failed to deploy resources to sandbox: {e}") from e

    async def _setup_github_token(self, sandbox_id: str) -> None:
        # GIT_ASKPASS is a script git calls for credentials — it just echoes the
        # GITHUB_TOKEN env var, avoiding interactive prompts for HTTPS git operations.
        # The token itself is injected via env_vars on every execute_command call.
        script_content = '#!/bin/sh\\necho "$GITHUB_TOKEN"'
        setup_cmd = (
            f"echo -e '{script_content}' > {SANDBOX_GIT_ASKPASS_PATH} && "
            f"chmod +x {SANDBOX_GIT_ASKPASS_PATH}"
        )
        await self.execute_command(sandbox_id, setup_cmd)

    async def initialize_sandbox(
        self,
        sandbox_id: str,
        has_github_token: bool = False,
    ) -> None:
        tasks: list[Coroutine[None, None, None]] = []

        tasks.append(self._deploy_resources(sandbox_id))
        tasks.append(SandboxService.sync_cli_auth(self.provider, sandbox_id))

        if has_github_token:
            tasks.append(self._setup_github_token(sandbox_id))

        async with asyncio.TaskGroup() as tg:
            for task in tasks:
                tg.create_task(task)
