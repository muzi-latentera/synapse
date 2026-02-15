import asyncio
import logging
import select
import socket
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
from typing import Any

import docker as docker_sdk
from claude_agent_sdk._errors import CLIConnectionError, ProcessError
from claude_agent_sdk.types import ClaudeAgentOptions

from app.constants import TERMINAL_TYPE
from app.services.sandbox_providers.types import DockerConfig
from app.services.transports.base import BaseSandboxTransport

logger = logging.getLogger(__name__)


class DockerSandboxTransport(BaseSandboxTransport):
    def __init__(
        self,
        *,
        sandbox_id: str,
        docker_config: DockerConfig,
        options: ClaudeAgentOptions,
    ) -> None:
        super().__init__(sandbox_id=sandbox_id, options=options)
        self._docker_config = docker_config
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._docker_client: Any = None
        self._container: Any = None
        self._exec_id: str | None = None
        self._raw_socket: Any = None
        self._reader_task: asyncio.Task[None] | None = None

    def _get_logger(self) -> Any:
        return logger

    def _get_docker_client(self) -> Any:
        if self._docker_client is None:
            try:
                if self._docker_config.host:
                    self._docker_client = docker_sdk.DockerClient(
                        base_url=self._docker_config.host
                    )
                else:
                    self._docker_client = docker_sdk.from_env()
            except Exception as e:
                raise CLIConnectionError(f"Failed to connect to Docker: {e}")
        return self._docker_client

    def _get_container(self) -> Any:
        client = self._get_docker_client()
        try:
            container = client.containers.get(f"claudex-sandbox-{self._sandbox_id}")
            container.reload()
            if container.status != "running":
                container.start()
            return container
        except Exception as e:
            raise CLIConnectionError(
                f"Failed to connect to sandbox {self._sandbox_id}: {e}"
            )

    def _create_exec(
        self,
        command_line: str,
        envs: dict[str, str],
        cwd: str,
        user: str,
    ) -> tuple[str, Any]:
        exec_result = self._container.client.api.exec_create(
            self._container.id,
            cmd=["bash", "-c", f"exec {command_line}"],
            stdin=True,
            tty=False,
            environment=envs,
            workdir=cwd,
            user=user,
        )
        exec_id = exec_result["Id"]
        socket = self._container.client.api.exec_start(
            exec_id,
            socket=True,
            tty=False,
        )
        return exec_id, socket

    @staticmethod
    def _extract_raw_socket(sock: Any) -> Any:
        if hasattr(sock, "_sock"):
            return sock._sock
        return sock

    async def connect(self) -> None:
        if self._ready:
            return
        self._stdin_closed = False

        loop = asyncio.get_running_loop()

        try:
            self._container = await loop.run_in_executor(
                self._executor, self._get_container
            )
        except Exception as exc:
            raise CLIConnectionError(
                f"Failed to connect to sandbox {self._sandbox_id}: {exc}"
            ) from exc

        command_line = self._build_command()
        envs, cwd, user = self._prepare_environment()
        envs["TERM"] = TERMINAL_TYPE

        try:
            exec_id, sock = await loop.run_in_executor(
                self._executor,
                lambda: self._create_exec(command_line, envs, cwd, user),
            )
            self._exec_id = exec_id
            self._raw_socket = self._extract_raw_socket(sock)
        except Exception as exc:
            raise CLIConnectionError(f"Failed to start Claude CLI: {exc}") from exc

        self._reader_task = loop.create_task(self._read_socket_data())
        self._monitor_task = loop.create_task(self._monitor_process())
        self._ready = True

    def _is_connection_ready(self) -> bool:
        return self._raw_socket is not None

    async def _kill_exec_process(self) -> None:
        exec_id = self._exec_id
        container = self._container
        if not exec_id or not container:
            return
        loop = asyncio.get_running_loop()
        try:
            info = await loop.run_in_executor(self._executor, self._get_exec_info)
            if not info or not info.get("Running", False):
                return
            pid = info.get("Pid")
            if not pid:
                return
            await loop.run_in_executor(
                self._executor,
                lambda: container.exec_run(
                    ["/bin/kill", "-KILL", f"-{pid}"], user="root"
                ),
            )
        except Exception as e:
            logger.debug("Failed to kill exec process: %s", e)

    async def _cleanup_resources(self) -> None:
        await self._cancel_task(self._reader_task)
        self._reader_task = None

        await self._kill_exec_process()

        if self._raw_socket:
            with suppress(Exception):
                self._raw_socket.close()
            self._raw_socket = None

        self._exec_id = None

        if self._docker_client:
            with suppress(Exception):
                self._docker_client.close()
            self._docker_client = None

        await asyncio.to_thread(self._executor.shutdown, wait=True)

    async def _send_data(self, data: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            self._executor, lambda: self._raw_socket.sendall(data.encode("utf-8"))
        )

    async def _send_eof(self) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(self._executor, self._shutdown_socket_write)

    def _shutdown_socket_write(self) -> None:
        if not self._raw_socket:
            return
        try:
            self._raw_socket.shutdown(socket.SHUT_WR)
        except Exception:
            self._raw_socket.sendall(b"\x04")

    def _recv_with_select(self, timeout: float) -> bytes | None:
        if not self._raw_socket:
            return None
        try:
            fd = self._raw_socket.fileno()
            readable, _, _ = select.select([fd], [], [], timeout)
            if not readable:
                return b""
            return bytes(self._raw_socket.recv(4096))
        except Exception:
            return None

    async def _read_socket_data(self) -> None:
        loop = asyncio.get_running_loop()
        buffer = b""
        drain_empty_count = 0

        try:
            while True:
                timeout = 5.0 if self._ready else 0.2
                data = await loop.run_in_executor(
                    self._executor, self._recv_with_select, timeout
                )
                if data is None:
                    break
                if len(data) == 0:
                    if not self._ready:
                        drain_empty_count += 1
                        if drain_empty_count >= 5:
                            break
                    continue
                drain_empty_count = 0

                buffer += data

                while len(buffer) >= 8:
                    stream_type = buffer[0]
                    frame_size = int.from_bytes(buffer[4:8], byteorder="big")

                    if frame_size > self._max_buffer_size:
                        buffer = b""
                        break

                    if len(buffer) < 8 + frame_size:
                        break

                    payload = buffer[8 : 8 + frame_size]
                    buffer = buffer[8 + frame_size :]

                    if stream_type == 1:
                        decoded = payload.decode("utf-8", errors="replace")
                        await self._stdout_queue.put(decoded)
                    elif stream_type == 2 and self._options.stderr:
                        try:
                            self._options.stderr(
                                payload.decode("utf-8", errors="replace")
                            )
                        except Exception:
                            pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Socket reader error: %s", e)
        finally:
            await self._put_sentinel()

    def _get_exec_info(self) -> dict[str, Any] | None:
        try:
            result: dict[str, Any] = self._container.client.api.exec_inspect(
                self._exec_id
            )
            return result
        except Exception as e:
            logger.warning("exec_inspect failed for exec_id %s: %s", self._exec_id, e)
            return None

    async def _monitor_process(self) -> None:
        if not self._exec_id or not self._container:
            return

        loop = asyncio.get_running_loop()

        try:
            while self._ready:
                await asyncio.sleep(0.5)

                info = await loop.run_in_executor(self._executor, self._get_exec_info)
                if info is None:
                    self._exit_error = CLIConnectionError(
                        "Claude CLI process disappeared"
                    )
                    break

                if not info.get("Running", True):
                    exit_code = info.get("ExitCode", -1)
                    if exit_code != 0:
                        self._exit_error = ProcessError(
                            "Claude CLI exited with an error",
                            exit_code=exit_code,
                            stderr="",
                        )
                    break
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._exit_error = CLIConnectionError(
                f"Claude CLI stopped unexpectedly: {exc}"
            )
        finally:
            self._ready = False
