from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import zipfile
from pathlib import Path
from typing import Any, Callable, Coroutine

from app.constants import (
    CLAUDE_DIR,
    CODEX_DIR,
    SANDBOX_CLAUDE_DIR,
    SANDBOX_CLAUDE_JSON_PATH,
    SANDBOX_GIT_ASKPASS_PATH,
    SANDBOX_HOME_DIR,
)
from app.models.types import CustomEnvVarDict
from app.services.agent import AgentService
from app.services.command import CommandService
from app.services.exceptions import SandboxException
from app.services.sandbox_providers import (
    PtyDataCallbackType,
    PtySize,
    SandboxProvider,
)
from app.services.claude_folder_sync import (
    CLAUDE_PLUGINS_CACHE_DIR,
    ClaudeFolderSync,
)
from app.services.sandbox_providers.types import CommandResult
from app.services.skill import SkillService

logger = logging.getLogger(__name__)


class SandboxService:
    def __init__(
        self,
        provider: SandboxProvider,
        session_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.provider = provider
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
        background: bool = False,
    ) -> CommandResult:
        # Inject the sandbox's user-defined secrets as env vars so commands
        # (git, npm, etc.) can use tokens/keys without explicit configuration.
        sandbox_secrets = await self.provider.get_secrets(sandbox_id)
        envs = {s.key: s.value for s in sandbox_secrets}

        return await self.provider.execute_command(
            sandbox_id, command, background=background, envs=envs
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
                "size": m.size,
                "modified": m.modified,
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

    async def update_secret(
        self,
        sandbox_id: str,
        key: str,
        value: str,
    ) -> None:
        # Secrets are stored as `export KEY=VALUE` lines in .bashrc — there's no
        # atomic update, so we delete the old line first then append the new one.
        try:
            sandbox_secrets = await self.provider.get_secrets(sandbox_id)
            secret_exists = any(secret.key == key for secret in sandbox_secrets)
        except Exception as e:
            raise SandboxException(f"Failed to read secrets for update: {str(e)}")

        if not secret_exists:
            await self.provider.add_secret(sandbox_id, key, value)
            return

        try:
            await self.provider.delete_secret(sandbox_id, key)
            await self.provider.add_secret(sandbox_id, key, value)
        except Exception as e:
            raise SandboxException(f"Failed to update secret {key}: {str(e)}")

    async def get_secrets(
        self,
        sandbox_id: str,
    ) -> list[dict[str, Any]]:
        sandbox_secrets = await self.provider.get_secrets(sandbox_id)
        return [{"key": s.key, "value": s.value} for s in sandbox_secrets]

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
        # In desktop mode, resources already live at ~/.claude/ which the
        # sandbox reads directly — no need to copy anything.
        if ClaudeFolderSync.is_active():
            return

        skill_service = SkillService()
        command_service = CommandService()
        agent_service = AgentService()

        skill_paths = skill_service.get_all_skill_paths()
        command_paths = command_service.get_all_resource_paths()
        agent_paths = agent_service.get_all_resource_paths()

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
                writes.append(
                    (f"{SANDBOX_CLAUDE_DIR}/skills/{skill_name}/{rel}", file_bytes)
                )

        for command in command_paths:
            command_name = command["name"]
            local_path = Path(command["path"])

            if not local_path.exists():
                logger.warning("Command not found: %s at %s", command_name, local_path)
                continue

            command_content = local_path.read_text(encoding="utf-8")
            writes.append(
                (f"{SANDBOX_CLAUDE_DIR}/commands/{command_name}.md", command_content)
            )

        for agent in agent_paths:
            agent_name = agent["name"]
            local_path = Path(agent["path"])

            if not local_path.exists():
                logger.warning("Agent not found: %s at %s", agent_name, local_path)
                continue

            agent_content = local_path.read_text(encoding="utf-8")
            writes.append(
                (f"{SANDBOX_CLAUDE_DIR}/agents/{agent_name}.md", agent_content)
            )

        container_cache_dir = f"{SANDBOX_CLAUDE_DIR}/plugins/cache"
        plugins_data = ClaudeFolderSync.read_installed_plugins()
        plugin_paths = ClaudeFolderSync.get_active_plugin_paths(plugins_data)
        if plugin_paths:
            remapped_json = ClaudeFolderSync.rewrite_installed_plugins_for_container(
                container_cache_dir, plugins_data
            )
            if remapped_json:
                writes.append(
                    (
                        f"{SANDBOX_CLAUDE_DIR}/plugins/installed_plugins.json",
                        remapped_json,
                    )
                )
            for plugin_dir in plugin_paths:
                try:
                    rel_to_cache = plugin_dir.relative_to(CLAUDE_PLUGINS_CACHE_DIR)
                except ValueError:
                    continue
                for f in plugin_dir.rglob("*"):
                    if not f.is_file():
                        continue
                    try:
                        file_bytes = f.read_bytes()
                    except OSError:
                        continue
                    rel_file = f.relative_to(plugin_dir)
                    writes.append(
                        (
                            f"{container_cache_dir}/{rel_to_cache}/{rel_file}",
                            file_bytes,
                        )
                    )

        if not writes:
            return

        try:
            async with asyncio.TaskGroup() as tg:
                for remote_path, content in writes:
                    tg.create_task(
                        self.provider.write_file(sandbox_id, remote_path, content)
                    )

            resource_count = len(skill_paths) + len(command_paths) + len(agent_paths)
            logger.info(
                "Deployed %d resources (%d files) to sandbox %s",
                resource_count,
                len(writes),
                sandbox_id,
            )
        except Exception as e:
            logger.error("Failed to deploy resources to sandbox %s: %s", sandbox_id, e)
            raise SandboxException(f"Failed to deploy resources to sandbox: {e}") from e

    async def _add_env_vars_parallel(
        self, sandbox_id: str, custom_env_vars: list[CustomEnvVarDict]
    ) -> None:
        if not custom_env_vars:
            return
        async with asyncio.TaskGroup() as tg:
            for env_var in custom_env_vars:
                tg.create_task(
                    self.provider.add_secret(
                        sandbox_id, env_var["key"], env_var["value"]
                    )
                )

    async def _setup_github_token(self, sandbox_id: str, github_token: str) -> None:
        # GIT_ASKPASS is a script git calls for credentials — it just echoes the
        # token, avoiding interactive prompts for HTTPS git operations.
        script_content = '#!/bin/sh\\necho "$GITHUB_TOKEN"'
        async with asyncio.TaskGroup() as tg:
            tg.create_task(
                self.provider.add_secret(sandbox_id, "GITHUB_TOKEN", github_token)
            )
            tg.create_task(
                self.provider.add_secret(
                    sandbox_id, "GIT_ASKPASS", SANDBOX_GIT_ASKPASS_PATH
                )
            )

        setup_cmd = (
            f"echo -e '{script_content}' > {SANDBOX_GIT_ASKPASS_PATH} && "
            f"chmod +x {SANDBOX_GIT_ASKPASS_PATH}"
        )
        await self.execute_command(sandbox_id, setup_cmd)

    async def _setup_claude_config(
        self,
        sandbox_id: str,
        auto_compact_disabled: bool,
        attribution_disabled: bool,
    ) -> None:
        if not auto_compact_disabled and not attribution_disabled:
            return

        if auto_compact_disabled:
            config: dict[str, Any] = {}
            try:
                existing = await self.provider.read_file(
                    sandbox_id, SANDBOX_CLAUDE_JSON_PATH
                )
                if not existing.is_binary and existing.content:
                    config = json.loads(existing.content)
            except Exception:
                pass
            config["autoCompactEnabled"] = False
            await self.provider.write_file(
                sandbox_id, SANDBOX_CLAUDE_JSON_PATH, json.dumps(config, indent=2)
            )

        if attribution_disabled:
            settings_path = f"{SANDBOX_CLAUDE_DIR}/settings.json"
            settings: dict[str, Any] = {}
            await self.execute_command(sandbox_id, f"mkdir -p {SANDBOX_CLAUDE_DIR}")
            try:
                existing = await self.provider.read_file(sandbox_id, settings_path)
                if not existing.is_binary and existing.content:
                    settings = json.loads(existing.content)
            except Exception:
                pass
            settings["attribution"] = {"commit": "", "pr": ""}
            await self.provider.write_file(
                sandbox_id, settings_path, json.dumps(settings, indent=2)
            )

    async def initialize_sandbox(
        self,
        sandbox_id: str,
        github_token: str | None = None,
        custom_env_vars: list[CustomEnvVarDict] | None = None,
        auto_compact_disabled: bool = False,
        attribution_disabled: bool = False,
    ) -> None:
        # Ensure login shells (e.g. tmux in the web terminal) source .bashrc
        # so custom env vars and secrets written there are available.
        await self.provider.execute_command(
            sandbox_id,
            "test -f ~/.bash_profile || echo '[ -f ~/.bashrc ] && source ~/.bashrc' > ~/.bash_profile",
            timeout=5,
        )

        tasks: list[Coroutine[None, None, None]] = []

        tasks.append(
            self._setup_claude_config(
                sandbox_id, auto_compact_disabled, attribution_disabled
            )
        )

        if custom_env_vars:
            tasks.append(self._add_env_vars_parallel(sandbox_id, custom_env_vars))

        tasks.append(self._deploy_resources(sandbox_id))
        tasks.append(SandboxService.sync_cli_auth(self.provider, sandbox_id))

        if github_token:
            tasks.append(self._setup_github_token(sandbox_id, github_token))

        async with asyncio.TaskGroup() as tg:
            for task in tasks:
                tg.create_task(task)
