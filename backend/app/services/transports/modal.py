import asyncio
import logging
from contextlib import suppress
from typing import Any

import modal
from claude_agent_sdk._errors import CLIConnectionError, ProcessError
from claude_agent_sdk.types import ClaudeAgentOptions

from app.services.sandbox_providers.modal_provider import setup_modal_auth
from app.services.transports.base import BaseSandboxTransport

logger = logging.getLogger(__name__)


class ModalSandboxTransport(BaseSandboxTransport):
    def __init__(
        self,
        *,
        sandbox_id: str,
        api_key: str,
        options: ClaudeAgentOptions,
    ) -> None:
        super().__init__(sandbox_id=sandbox_id, options=options)
        self._api_key = api_key
        self._sandbox: modal.Sandbox | None = None
        self._process: Any | None = None
        self._stdout_reader_task: asyncio.Task[None] | None = None
        self._monitor_task: asyncio.Task[None] | None = None
        setup_modal_auth(api_key)

    def _get_logger(self) -> Any:
        return logger

    async def connect(self) -> None:
        if self._ready:
            return
        self._stdin_closed = False
        try:
            self._sandbox = await modal.Sandbox.from_id.aio(self._sandbox_id)
        except Exception as exc:
            raise CLIConnectionError(
                f"Failed to connect to sandbox {self._sandbox_id}: {exc}"
            ) from exc

        command_line = self._build_command()
        envs, cwd, user = self._prepare_environment()

        try:
            assert self._sandbox is not None
            self._process = await self._sandbox.exec.aio(
                "runuser",
                "-u",
                user,
                "--",
                "bash",
                "-c",
                f"cd {cwd} && {command_line}",
                env={key: str(value) for key, value in envs.items()},
            )
        except Exception as exc:
            raise CLIConnectionError(f"Failed to start Claude CLI: {exc}") from exc

        loop = asyncio.get_running_loop()
        self._monitor_task = loop.create_task(self._monitor_process())
        self._stdout_reader_task = loop.create_task(self._read_stdout())
        self._ready = True

    def _is_connection_ready(self) -> bool:
        return self._process is not None and self._sandbox is not None

    async def _cleanup_resources(self) -> None:
        if self._stdout_reader_task:
            self._stdout_reader_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._stdout_reader_task
            self._stdout_reader_task = None

        if self._process:
            with suppress(Exception):
                self._process.stdin.write_eof()
            self._process = None

    async def _send_data(self, data: str) -> None:
        assert self._process is not None
        self._process.stdin.write(data)
        await self._process.stdin.drain.aio()

    async def _send_eof(self) -> None:
        assert self._process is not None
        self._process.stdin.write_eof()
        await self._process.stdin.drain.aio()

    async def _read_stdout(self) -> None:
        if not self._process:
            return
        try:
            async for line in self._process.stdout:
                await self._stdout_queue.put(line)
        except Exception as exc:
            logger.debug("Stdout reader stopped: %s", exc)

    async def _monitor_process(self) -> None:
        if not self._process:
            return
        try:
            await self._process.wait.aio()
            exit_code = self._process.returncode
            if exit_code != 0:
                stderr_lines = []
                try:
                    async for line in self._process.stderr:
                        stderr_lines.append(line)
                except Exception:
                    pass
                self._exit_error = ProcessError(
                    "Claude CLI exited with an error",
                    exit_code=exit_code,
                    stderr="".join(stderr_lines),
                )
        except Exception as exc:
            self._exit_error = CLIConnectionError(
                f"Claude CLI stopped unexpectedly: {exc}"
            )
        finally:
            await self._put_sentinel()
            self._ready = False
