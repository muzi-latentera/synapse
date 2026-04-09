from __future__ import annotations

import asyncio
import base64
import logging
import os
import shlex
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from acp.client.connection import ClientSideConnection
from acp.schema import (
    BlobResourceContents,
    EmbeddedResourceContentBlock,
    EnvVariable,
    HttpHeader,
    ImageContentBlock,
    McpServerHttp,
    McpServerStdio,
    TextContentBlock,
)

from app.constants import SANDBOX_HOME_DIR, SANDBOX_WORKSPACE_DIR, TERMINAL_TYPE
from app.core.config import get_settings
from app.services.acp.adapters import AGENT_ADAPTERS, AgentKind, LaunchConfig
from app.services.acp.client import AcpClientHandler
from app.services.sandbox_providers import SandboxProviderType
from app.services.sandbox_providers.docker_provider import (
    DOCKER_SANDBOX_CONTAINER_PREFIX,
)

logger = logging.getLogger(__name__)
settings = get_settings()

ACP_PROTOCOL_VERSION = 1
# 100 MB — large enough for long-running agent sessions that produce extensive
# tool output (e.g. full file reads, large diffs) without hitting asyncio's
# default 64 KB stream buffer limit.
STDIO_BUFFER_LIMIT = 100 * 1024 * 1024


@dataclass
class AcpSessionConfig:
    # Everything needed to spawn an ACP agent process and create a session.
    # Built by AgentService._build_acp_config() from chat/user/model state.
    sandbox_id: str
    sandbox_provider: str
    cwd: str
    agent_kind: AgentKind = AgentKind.CLAUDE
    env: dict[str, str] = field(default_factory=dict)
    mcp_servers: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""
    permission_mode: str = "default"
    launch_approval_policy: str | None = None
    resume_session_id: str | None = None
    workspace_path: str | None = None
    system_prompt: str | None = None
    system_prompt_is_full_replace: bool = False
    worktree: bool = False
    reasoning_effort: str | None = None
    session_meta: dict[str, Any] = field(default_factory=dict)


class AcpSession:
    # Manages the lifecycle of a single ACP agent process: spawns the binary
    # (via Docker exec or direct host subprocess), negotiates the ACP handshake,
    # creates or resumes a session, and provides methods to send prompts,
    # change models/modes, cancel, and tear down cleanly.

    def __init__(
        self,
        handler: AcpClientHandler,
        conn: ClientSideConnection,
        process: asyncio.subprocess.Process,
        acp_session_id: str,
        stderr_task: asyncio.Task[None] | None = None,
    ) -> None:
        self._handler = handler
        self._conn = conn
        self._process = process
        self.acp_session_id = acp_session_id
        self._stderr_task = stderr_task

    @property
    def handler(self) -> AcpClientHandler:
        return self._handler

    def is_alive(self) -> bool:
        return self._process.returncode is None

    async def send_prompt(
        self,
        content: str,
        attachments: list[dict[str, Any]] | None = None,
        agent_kind: AgentKind = AgentKind.CLAUDE,
    ) -> None:
        self._handler.prepare_for_prompt()

        prompt_blocks: list[
            TextContentBlock | ImageContentBlock | EmbeddedResourceContentBlock
        ] = [
            TextContentBlock(type="text", text=content),
        ]
        if attachments:
            attachment_note = self._build_attachment_note(attachments)
            if attachment_note:
                prompt_blocks.append(
                    TextContentBlock(type="text", text=attachment_note)
                )
            prompt_blocks.extend(self._build_attachment_blocks(attachments, agent_kind))

        try:
            await self._conn.prompt(
                prompt=prompt_blocks,
                session_id=self.acp_session_id,
            )
            prompt_completed = True
        except BaseException:
            prompt_completed = False
            raise
        finally:
            self._handler.finish(prompt_completed=prompt_completed)

    IMAGE_MIME_BY_EXT: dict[str, str] = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }

    NON_IMAGE_MIME: dict[str, str] = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }

    @staticmethod
    def _build_attachment_note(attachments: list[dict[str, Any]]) -> str:
        lines: list[str] = []
        for att in attachments:
            file_path = att.get("file_path")
            if not isinstance(file_path, str) or not file_path:
                continue
            sandbox_path = SANDBOX_HOME_DIR + "/" + Path(file_path).name
            filename = att.get("filename")
            label = (
                filename
                if isinstance(filename, str) and filename
                else Path(file_path).name
            )
            lines.append("- " + label + " is available at " + sandbox_path)
        if not lines:
            return ""
        return (
            "<user_attachments>\n"
            + "User uploaded the following files. Read them from these sandbox paths when needed.\n"
            + "\n".join(lines)
            + "\n</user_attachments>"
        )

    @staticmethod
    def _build_attachment_blocks(
        attachments: list[dict[str, Any]],
        agent_kind: AgentKind,
    ) -> list[ImageContentBlock | EmbeddedResourceContentBlock]:
        storage_path = Path(settings.STORAGE_PATH)
        blocks: list[ImageContentBlock | EmbeddedResourceContentBlock] = []
        for att in attachments:
            file_path = att.get("file_path")
            if not file_path:
                continue
            file_type = att.get("file_type", "")
            # Native ACP attachment support differs by agent: Claude can consume
            # images and PDFs in the prompt, while Codex only handles images.
            # Other uploaded files still exist in the sandbox for tool-based reads.
            if file_type == "image":
                pass
            elif file_type == "pdf" and agent_kind == AgentKind.CLAUDE:
                pass
            else:
                continue
            full_path = storage_path / file_path
            try:
                raw = full_path.read_bytes()
            except OSError:
                logger.warning("Attachment file not found: %s", full_path)
                continue
            encoded = base64.standard_b64encode(raw).decode("ascii")
            filename = att.get("filename", full_path.name)

            if file_type == "image":
                ext = Path(filename).suffix.lower()
                mime = AcpSession.IMAGE_MIME_BY_EXT.get(ext, "image/png")
                blocks.append(
                    ImageContentBlock(
                        type="image",
                        data=encoded,
                        mimeType=mime,
                    )
                )
            else:
                mime = AcpSession.NON_IMAGE_MIME.get(
                    file_type, "application/octet-stream"
                )
                blocks.append(
                    EmbeddedResourceContentBlock(
                        type="resource",
                        resource=BlobResourceContents(
                            blob=encoded,
                            uri=f"file:///{filename}",
                            mimeType=mime,
                        ),
                    )
                )
        return blocks

    async def cancel(self) -> None:
        try:
            await self._conn.cancel(session_id=self.acp_session_id)
        except Exception:
            logger.warning("Failed to send ACP cancel", exc_info=True)

    async def set_model(self, model_id: str) -> None:
        try:
            await self._conn.set_session_model(
                model_id=model_id,
                session_id=self.acp_session_id,
            )
        except Exception:
            logger.warning("Failed to set ACP model: %s", model_id, exc_info=True)

    async def set_mode(self, mode_id: str) -> None:
        try:
            await self._conn.set_session_mode(
                mode_id=mode_id,
                session_id=self.acp_session_id,
            )
        except Exception:
            logger.warning("Failed to set ACP mode: %s", mode_id, exc_info=True)

    async def close(self) -> None:
        # Orderly shutdown: cancel any pending permission prompts (so blocked
        # request_permission() calls unblock), close the ACP connection, then
        # terminate the agent process with a SIGTERM grace period before SIGKILL.
        self._handler.cancel_pending_permissions()
        if self._stderr_task and not self._stderr_task.done():
            self._stderr_task.cancel()
        try:
            await self._conn.close()
        except Exception:
            logger.debug("Error closing ACP connection", exc_info=True)

        if self._process.returncode is None:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()
                await self._process.wait()
            except Exception:
                logger.debug("Error killing ACP agent process", exc_info=True)

    @classmethod
    async def create(cls, config: AcpSessionConfig) -> AcpSession:
        handler = AcpClientHandler()
        process = await cls._spawn_process(config)

        if process.stdin is None or process.stdout is None:
            process.kill()
            await process.wait()
            raise RuntimeError("Failed to open stdio pipes to ACP agent process")

        conn = ClientSideConnection(
            handler,
            process.stdin,
            process.stdout,
        )

        stderr_task = asyncio.create_task(cls._read_stderr(process))

        try:
            await conn.initialize(protocol_version=ACP_PROTOCOL_VERSION)

            session_cwd = cls._resolve_cwd(config)
            mcp_servers = cls._build_mcp_servers(config.mcp_servers)
            session_meta = config.session_meta

            if config.resume_session_id:
                # Mute the handler during load_session so replayed history
                # events don't leak onto the live stream.
                handler.muted = True
                try:
                    await conn.load_session(
                        cwd=session_cwd,
                        session_id=config.resume_session_id,
                        mcp_servers=mcp_servers,
                        **session_meta,
                    )
                finally:
                    handler.muted = False
                    handler.prepare_for_prompt()
                acp_session_id = config.resume_session_id
            else:
                response = await conn.new_session(
                    cwd=session_cwd,
                    mcp_servers=mcp_servers,
                    **session_meta,
                )
                acp_session_id = response.session_id

            if config.model:
                try:
                    await conn.set_session_model(
                        model_id=config.model,
                        session_id=acp_session_id,
                    )
                except Exception:
                    logger.warning("Failed to set initial model: %s", config.model)

            if config.permission_mode and config.permission_mode != "default":
                try:
                    await conn.set_session_mode(
                        mode_id=config.permission_mode,
                        session_id=acp_session_id,
                    )
                except Exception:
                    logger.warning(
                        "Failed to set initial mode: %s", config.permission_mode
                    )

        except Exception as exc:
            stderr_output = ""
            if process.stderr:
                try:
                    stderr_bytes = await asyncio.wait_for(
                        process.stderr.read(8192), timeout=2.0
                    )
                    stderr_output = stderr_bytes.decode(errors="replace").strip()
                except (asyncio.TimeoutError, Exception):
                    pass
            stderr_task.cancel()

            error_data = getattr(exc, "data", None)
            error_code = getattr(exc, "code", None)
            logger.error(
                "ACP session creation failed: %s | code: %s | data: %s | stderr: %s | cwd: %s | sandbox: %s/%s | env_keys: %s",
                exc,
                error_code,
                error_data,
                stderr_output or "(empty)",
                config.cwd,
                config.sandbox_provider,
                config.sandbox_id,
                list(config.env.keys()),
            )

            await conn.close()
            if process.returncode is None:
                process.kill()
                await process.wait()
            raise

        return cls(
            handler=handler,
            conn=conn,
            process=process,
            acp_session_id=acp_session_id,
            stderr_task=stderr_task,
        )

    @staticmethod
    async def _read_stderr(process: asyncio.subprocess.Process) -> None:
        if process.stderr is None:
            return
        while True:
            line = await process.stderr.readline()
            if not line:
                break
            logger.warning(
                "acp-agent stderr: %s", line.decode(errors="replace").rstrip()
            )

    @staticmethod
    def _build_launch_config(config: AcpSessionConfig) -> LaunchConfig:
        adapter = AGENT_ADAPTERS[config.agent_kind]
        return adapter.build_launch_config(
            system_prompt=config.system_prompt,
            system_prompt_is_full_replace=config.system_prompt_is_full_replace,
            reasoning_effort=config.reasoning_effort,
            permission_mode=config.permission_mode,
            launch_approval_policy=config.launch_approval_policy,
        )

    @staticmethod
    async def _spawn_process(config: AcpSessionConfig) -> asyncio.subprocess.Process:
        if config.sandbox_provider == SandboxProviderType.DOCKER.value:
            return await AcpSession._spawn_docker(config)
        if config.sandbox_provider == SandboxProviderType.HOST.value:
            return await AcpSession._spawn_host(config)
        raise ValueError(f"Unknown sandbox provider: {config.sandbox_provider}")

    @staticmethod
    async def _spawn_docker(config: AcpSessionConfig) -> asyncio.subprocess.Process:
        container_name = f"{DOCKER_SANDBOX_CONTAINER_PREFIX}{config.sandbox_id}"
        launch = AcpSession._build_launch_config(config)

        cmd: list[str] = [
            "docker",
            "exec",
            "-i",
            "-u",
            "user",
            "-w",
            config.cwd,
        ]
        for key, value in config.env.items():
            cmd.extend(["-e", f"{key}={value}"])

        # Run through bash login shell so .bashrc env vars are available
        agent_parts = [launch.binary, *launch.cli_args]
        agent_cmd = "exec " + shlex.join(agent_parts)
        cmd.extend([container_name, "bash", "-lc", agent_cmd])

        return await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            limit=STDIO_BUFFER_LIMIT,
        )

    @staticmethod
    async def _spawn_host(config: AcpSessionConfig) -> asyncio.subprocess.Process:
        launch = AcpSession._build_launch_config(config)

        # Start from the host environment so auth tokens, proxy vars,
        # TLS settings, and tool paths are available to the agent process.
        env = dict(os.environ)
        if config.sandbox_id:
            host_base = settings.get_host_sandbox_base_dir()
            host_home = f"{host_base}/{config.sandbox_id}"
            # Rewrite virtual sandbox paths (/home/user/...) to the real
            # host sandbox directory so helpers like GIT_ASKPASS resolve.
            for key, val in config.env.items():
                env[key] = val.replace(SANDBOX_HOME_DIR, host_home)
            # Web mode: override HOME so the agent uses the sandbox dir.
            # Desktop mode: keep real HOME so existing ~/.claude / ~/.codex
            # login credentials are discovered (sync_cli_auth is Docker-only).
            if not settings.DESKTOP_MODE:
                env["HOME"] = host_home
            env["CODEX_HOME"] = f"{host_home}/.codex"
        else:
            env.update(config.env)
        env.setdefault("TERM", TERMINAL_TYPE)

        cwd = config.workspace_path or config.cwd

        return await asyncio.create_subprocess_exec(
            launch.binary,
            *launch.cli_args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            limit=STDIO_BUFFER_LIMIT,
            env=env,
            cwd=cwd,
        )

    @staticmethod
    def _resolve_cwd(config: AcpSessionConfig) -> str:
        # Host mode needs the real filesystem path since the virtual
        # sandbox path (/home/user/workspace) doesn't exist on the host.
        if config.sandbox_provider == SandboxProviderType.HOST.value:
            # Real host paths should be used as-is. Only rewrite the
            # virtual sandbox paths that don't exist on the host.
            if config.cwd not in (SANDBOX_HOME_DIR, SANDBOX_WORKSPACE_DIR):
                return config.cwd
            if config.workspace_path:
                return config.workspace_path
            return f"{settings.get_host_sandbox_base_dir()}/{config.sandbox_id}"
        return config.cwd

    @staticmethod
    def _build_mcp_servers(
        mcp_configs: list[dict[str, Any]],
    ) -> list[McpServerStdio | McpServerHttp]:
        servers: list[McpServerStdio | McpServerHttp] = []
        for cfg in mcp_configs:
            mcp_type = cfg.get("type")
            if mcp_type in ("http", "sse"):
                url = cfg.get("url")
                if not url:
                    continue
                headers = [
                    HttpHeader(name=k, value=v)
                    for k, v in cfg.get("headers", {}).items()
                ]
                servers.append(
                    McpServerHttp(
                        name=cfg.get("name") or url,
                        url=url,
                        headers=headers,
                    )
                )
                continue
            command = cfg.get("command")
            if not command:
                continue
            env_list = [
                EnvVariable(name=k, value=v) for k, v in cfg.get("env", {}).items()
            ]
            servers.append(
                McpServerStdio(
                    name=cfg.get("name") or command,
                    command=command,
                    args=cfg.get("args", []),
                    env=env_list,
                )
            )
        return servers
