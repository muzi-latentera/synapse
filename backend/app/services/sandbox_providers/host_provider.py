import asyncio
import contextlib
import fcntl
import fnmatch
import logging
import os
import pty
import re
import shlex
import shutil
import signal
import subprocess
import termios
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from app.constants import (
    HOST_REQUIRED_PATH_PREFIX,
    SANDBOX_BASHRC_PATH,
    SANDBOX_BINARY_EXTENSIONS,
    SANDBOX_DEFAULT_COMMAND_TIMEOUT,
    SANDBOX_HOME_DIR,
    SANDBOX_WORKSPACE_DIR,
    TERMINAL_TYPE,
)
from app.core.config import get_settings
from app.services.exceptions import SandboxException
from app.services.sandbox_providers.base import SandboxProvider
from app.services.sandbox_providers.types import (
    CommandResult,
    FileContent,
    FileMetadata,
    PtyDataCallbackType,
    PtySession,
    PtySize,
)

logger = logging.getLogger(__name__)
settings = get_settings()

HOME_PREFIX = f"{SANDBOX_HOME_DIR}/"
WORKSPACE_PREFIX = f"{SANDBOX_WORKSPACE_DIR}/"

# Matches /home/user/workspace or /home/user at word-like boundaries in shell commands.
# Workspace alternative comes first so the longer path wins.
# The host provider uses a real directory per sandbox instead of a container.
# Commands reference virtual paths (/home/user/workspace) that need to be
# rewritten to the actual host path before execution, and output containing
# host paths must be masked back to virtual paths so the frontend never
# sees the real filesystem layout.
VIRTUAL_PATH_PATTERN = re.compile(
    rf"(?:(?<=^)|(?<=[\s\"'=(]))"
    rf"({re.escape(SANDBOX_WORKSPACE_DIR)}|{re.escape(SANDBOX_HOME_DIR)})"
    rf"(?=(?:/|$|[\s\"')]))"
)


@dataclass
class HostSandboxInfo:
    home_dir: Path
    workspace_dir: Path


class LocalHostProvider(SandboxProvider):
    def __init__(
        self, base_dir: str, preview_base_url: str = "http://localhost"
    ) -> None:
        self._base_dir = Path(base_dir).expanduser().resolve()
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._preview_base_url = preview_base_url.rstrip("/")
        self._sandboxes: dict[str, HostSandboxInfo] = {}
        self._pty_sessions: dict[str, dict[str, Any]] = {}

    def _init_home_dir(self, sandbox_id: str, home_dir: Path) -> None:
        home_dir.mkdir(parents=True, exist_ok=True)
        # CLI tools abort if their home dirs are configured but missing.
        (home_dir / ".codex").mkdir(exist_ok=True)
        (home_dir / ".claude").mkdir(exist_ok=True)
        bashrc_content = f'export PS1="user@{sandbox_id}:\\w$ "\n'
        bashrc = home_dir / ".bashrc"
        if not bashrc.exists():
            bashrc.write_text(bashrc_content)
        bash_profile = home_dir / ".bash_profile"
        if not bash_profile.exists():
            bash_profile.write_text("[ -f ~/.bashrc ] && source ~/.bashrc\n")
        # Symlink .config so CLI tools (gws, etc.) find host credentials despite HOME override
        real_config = Path.home() / ".config"
        sandbox_config = home_dir / ".config"
        if real_config.is_dir() and not sandbox_config.exists():
            sandbox_config.symlink_to(real_config)

    def bind_workspace(self, sandbox_id: str, workspace_path: str) -> None:
        home_dir = (self._base_dir / sandbox_id).resolve()
        workspace = Path(workspace_path).expanduser().resolve()
        self._init_home_dir(sandbox_id, home_dir)
        link = home_dir / "workspace"
        if link.is_symlink():
            if link.resolve() != workspace:
                link.unlink()
                link.symlink_to(workspace)
        elif link.exists():
            shutil.rmtree(link) if link.is_dir() else link.unlink()
            link.symlink_to(workspace)
        else:
            link.symlink_to(workspace)
        self._sandboxes[sandbox_id] = HostSandboxInfo(
            home_dir=home_dir, workspace_dir=workspace
        )

    def _resolve_sandbox_dir(self, sandbox_id: str) -> Path:
        info = self._sandboxes.get(sandbox_id)
        if info:
            return info.home_dir

        candidate = (self._base_dir / sandbox_id).resolve()
        if candidate.exists() and candidate.is_dir():
            workspace_link = candidate / "workspace"
            if workspace_link.is_symlink():
                workspace_dir = workspace_link.resolve()
            else:
                workspace_dir = candidate
            self._sandboxes[sandbox_id] = HostSandboxInfo(
                home_dir=candidate, workspace_dir=workspace_dir
            )
            return candidate

        raise SandboxException(f"Host sandbox {sandbox_id} not found")

    def _resolve_workspace_dir(self, sandbox_id: str) -> Path:
        info = self._sandboxes.get(sandbox_id)
        if info:
            return info.workspace_dir
        self._resolve_sandbox_dir(sandbox_id)
        return self._sandboxes[sandbox_id].workspace_dir

    def _resolve_path(self, sandbox_id: str, path: str) -> Path:
        # Map virtual sandbox paths (/home/user/...) to real host paths, enforcing
        # that the resolved path stays within the sandbox home or workspace dir
        # (prevents path traversal via ../ or symlinks).
        home_dir = self._resolve_sandbox_dir(sandbox_id)
        workspace_dir = self._resolve_workspace_dir(sandbox_id)
        requested = Path(path)

        if requested.is_absolute():
            requested_str = str(requested)
            if requested_str == SANDBOX_HOME_DIR:
                return home_dir
            if requested_str == SANDBOX_WORKSPACE_DIR:
                return workspace_dir
            if requested_str.startswith(WORKSPACE_PREFIX):
                relative = requested_str[len(WORKSPACE_PREFIX) :]
                resolved = (workspace_dir / relative).resolve()
                try:
                    resolved.relative_to(workspace_dir)
                except ValueError as exc:
                    raise SandboxException(
                        f"Path escapes workspace root: {path}"
                    ) from exc
                return resolved
            if not requested_str.startswith(HOME_PREFIX):
                raise SandboxException(f"Path must be inside sandbox root: {path}")
            relative = requested_str[len(HOME_PREFIX) :]
            resolved = (home_dir / relative).resolve()
            try:
                resolved.relative_to(home_dir)
            except ValueError:
                try:
                    resolved.relative_to(workspace_dir)
                except ValueError as exc:
                    raise SandboxException(
                        f"Path escapes sandbox root: {path}"
                    ) from exc
        else:
            resolved = (workspace_dir / requested).resolve()
            try:
                resolved.relative_to(workspace_dir)
            except ValueError as exc:
                raise SandboxException(f"Path escapes workspace root: {path}") from exc

        return resolved

    @staticmethod
    def _map_virtual_paths(
        command: str, home_dir_str: str, workspace_dir_str: str
    ) -> str:
        replacements = {
            SANDBOX_WORKSPACE_DIR: workspace_dir_str,
            SANDBOX_HOME_DIR: home_dir_str,
        }

        def _replace(m: re.Match[str]) -> str:
            real = replacements[m.group(1)]
            if " " not in real:
                return real
            # Already inside quotes — no extra quoting needed
            pos = m.start()
            if pos > 0 and command[pos - 1] in ('"', "'"):
                return real
            return shlex.quote(real)

        return VIRTUAL_PATH_PATTERN.sub(_replace, command)

    async def create_sandbox(self, workspace_path: str | None = None) -> str:
        sandbox_id = str(uuid.uuid4())[:12]
        home_dir = (self._base_dir / sandbox_id).resolve()
        self._init_home_dir(sandbox_id, home_dir)

        if workspace_path:
            workspace = Path(workspace_path).expanduser().resolve()
            (home_dir / "workspace").symlink_to(workspace)
        else:
            workspace = home_dir

        self._sandboxes[sandbox_id] = HostSandboxInfo(
            home_dir=home_dir, workspace_dir=workspace
        )
        return sandbox_id

    async def connect_sandbox(self, sandbox_id: str) -> bool:
        try:
            self._resolve_sandbox_dir(sandbox_id)
            return True
        except SandboxException:
            return False

    async def delete_sandbox(self, sandbox_id: str) -> None:
        for pty_id in list(self._pty_sessions.get(sandbox_id, {}).keys()):
            try:
                await self.kill_pty(sandbox_id, pty_id)
            except Exception:
                pass

        info = self._sandboxes.pop(sandbox_id, None)
        home_dir = info.home_dir if info else None
        if not home_dir:
            candidate = (self._base_dir / sandbox_id).resolve()
            if candidate.exists() and candidate.is_dir():
                home_dir = candidate

        # Only delete if the home dir is inside our base dir — prevents
        # accidental deletion of arbitrary directories via crafted sandbox IDs.
        if home_dir and home_dir.is_relative_to(self._base_dir):
            await asyncio.to_thread(shutil.rmtree, home_dir, ignore_errors=True)

    async def is_running(self, sandbox_id: str) -> bool:
        try:
            return self._resolve_sandbox_dir(sandbox_id).exists()
        except SandboxException:
            return False

    @staticmethod
    def _mask_host_paths(text: str, home_dir_str: str, workspace_dir_str: str) -> str:
        # Replace workspace path first (more specific) to avoid partial matches
        if workspace_dir_str != home_dir_str:
            text = text.replace(workspace_dir_str, SANDBOX_WORKSPACE_DIR)
        return text.replace(home_dir_str, SANDBOX_HOME_DIR)

    async def execute_command(
        self,
        sandbox_id: str,
        command: str,
        background: bool = False,
        envs: dict[str, str] | None = None,
        timeout: int | None = None,
    ) -> CommandResult:
        home_dir = self._resolve_sandbox_dir(sandbox_id)
        workspace_dir = self._resolve_workspace_dir(sandbox_id)
        home_dir_str = str(home_dir)
        workspace_dir_str = str(workspace_dir)
        command_to_run = self._map_virtual_paths(
            command, home_dir_str, workspace_dir_str
        )
        command_with_path = (
            f"export PATH={HOST_REQUIRED_PATH_PREFIX}:$PATH; {command_to_run}"
        )
        process_env = os.environ.copy()
        if envs:
            process_env.update(envs)
        # Web mode: override HOME so tools (Codex) find auth files in the sandbox dir.
        # Desktop mode: keep real HOME so Claude Code finds its existing login credentials.
        if not settings.DESKTOP_MODE:
            process_env["HOME"] = home_dir_str
        process_env["TERM"] = process_env.get("TERM", TERMINAL_TYPE)
        process_env["GIT_CONFIG_GLOBAL"] = settings.GIT_CONFIG_GLOBAL
        process_env["GNUPGHOME"] = settings.GNUPGHOME

        if background:
            await asyncio.to_thread(
                subprocess.Popen,
                ["bash", "-lc", command_with_path],
                cwd=workspace_dir_str,
                env=process_env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            return CommandResult(
                stdout="Background process started",
                stderr="",
                exit_code=0,
            )

        effective_timeout = timeout or SANDBOX_DEFAULT_COMMAND_TIMEOUT
        process = await asyncio.create_subprocess_exec(
            "bash",
            "-lc",
            command_with_path,
            cwd=workspace_dir_str,
            env=process_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=effective_timeout + 5
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise TimeoutError(
                f"Command execution timed out after {effective_timeout}s"
            )

        stdout_str = self._mask_host_paths(
            stdout.decode("utf-8", errors="replace"),
            home_dir_str,
            workspace_dir_str,
        )
        stderr_str = self._mask_host_paths(
            stderr.decode("utf-8", errors="replace"),
            home_dir_str,
            workspace_dir_str,
        )

        return CommandResult(
            stdout=stdout_str,
            stderr=stderr_str,
            exit_code=process.returncode or 0,
        )

    async def write_file(
        self,
        sandbox_id: str,
        path: str,
        content: str | bytes,
    ) -> None:
        resolved = self._resolve_path(sandbox_id, path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        payload = content.encode("utf-8") if isinstance(content, str) else content
        await asyncio.to_thread(resolved.write_bytes, payload)

    async def read_file(
        self,
        sandbox_id: str,
        path: str,
    ) -> FileContent:
        resolved = self._resolve_path(sandbox_id, path)
        if not resolved.exists() or not resolved.is_file():
            raise SandboxException(f"File not found: {path}")

        content_bytes = await asyncio.to_thread(resolved.read_bytes)
        content, is_binary = self._encode_file_content(path, content_bytes)
        return FileContent(path=path, content=content, type="file", is_binary=is_binary)

    @staticmethod
    def _is_excluded_path(
        rel_path: str,
        name: str,
        caller_patterns: list[str],
        gitignore_patterns: list[str],
        exceptions: list[str],
    ) -> bool:
        full_path = f"{SANDBOX_HOME_DIR}/{rel_path}"
        if any(
            fnmatch.fnmatch(full_path, p)
            or fnmatch.fnmatch(rel_path, p)
            or fnmatch.fnmatch(name, p)
            for p in caller_patterns
        ):
            return True
        if any(fnmatch.fnmatch(rel_path, exc) for exc in exceptions):
            return False
        return any(
            fnmatch.fnmatch(full_path, p)
            or fnmatch.fnmatch(rel_path, p)
            or fnmatch.fnmatch(name, p)
            for p in gitignore_patterns
        )

    @staticmethod
    def _walk_files(
        sandbox_dir: Path,
        caller_patterns: list[str],
        gitignore_patterns: list[str],
        exceptions: list[str],
    ) -> list[FileMetadata]:
        items: list[FileMetadata] = []
        for root, dirnames, filenames in os.walk(sandbox_dir, topdown=True):
            root_path = Path(root)
            root_rel_path = root_path.relative_to(sandbox_dir)
            root_rel = "" if root_rel_path == Path(".") else str(root_rel_path)

            kept_dirnames: list[str] = []
            for dirname in dirnames:
                rel = f"{root_rel}/{dirname}" if root_rel else dirname
                if LocalHostProvider._is_excluded_path(
                    rel, dirname, caller_patterns, gitignore_patterns, exceptions
                ):
                    continue

                dir_path = root_path / dirname
                try:
                    stat = dir_path.stat()
                except OSError:
                    continue

                items.append(
                    FileMetadata(
                        path=rel,
                        type="directory",
                        size=0,
                        modified=stat.st_mtime,
                    )
                )
                kept_dirnames.append(dirname)

            dirnames[:] = kept_dirnames

            for filename in filenames:
                rel = f"{root_rel}/{filename}" if root_rel else filename
                if LocalHostProvider._is_excluded_path(
                    rel, filename, caller_patterns, gitignore_patterns, exceptions
                ):
                    continue

                file_path = root_path / filename
                try:
                    stat = file_path.stat()
                except OSError:
                    continue

                ext = file_path.suffix.lstrip(".").lower()
                is_binary = ext in SANDBOX_BINARY_EXTENSIONS
                items.append(
                    FileMetadata(
                        path=rel,
                        type="file",
                        is_binary=is_binary,
                        size=stat.st_size,
                        modified=stat.st_mtime,
                    )
                )
        return items

    async def list_files(
        self,
        sandbox_id: str,
        path: str = SANDBOX_HOME_DIR,
        excluded_patterns: list[str] | None = None,
    ) -> list[FileMetadata]:
        if path == SANDBOX_HOME_DIR:
            target_dir = self._resolve_workspace_dir(sandbox_id)
        else:
            target_dir = self._resolve_path(sandbox_id, path)
        caller_patterns = list(dict.fromkeys(excluded_patterns or []))
        gitignore_patterns, exceptions = await self._get_gitignore_patterns(
            sandbox_id, str(target_dir)
        )
        return await asyncio.to_thread(
            self._walk_files,
            target_dir,
            caller_patterns,
            gitignore_patterns,
            exceptions,
        )

    @staticmethod
    def _resize_fd(fd: int, rows: int, cols: int) -> None:
        size = rows.to_bytes(2, "little") + cols.to_bytes(2, "little") + b"\x00" * 4
        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)

    async def create_pty(
        self,
        sandbox_id: str,
        rows: int,
        cols: int,
        tmux_session: str,
        on_data: PtyDataCallbackType | None = None,
    ) -> PtySession:
        home_dir = self._resolve_sandbox_dir(sandbox_id)
        workspace_dir = self._resolve_workspace_dir(sandbox_id)
        session_id = str(uuid.uuid4())
        master_fd, slave_fd = pty.openpty()
        self._resize_fd(slave_fd, rows, cols)

        env = os.environ.copy()
        # Web mode: override HOME so terminal sessions see the sandbox home.
        # Desktop mode: keep real HOME so CLI tools find existing credentials.
        if not settings.DESKTOP_MODE:
            env["HOME"] = str(home_dir)
            # Keep CLI config paths inside the sandbox home in web mode because
            # the inherited container defaults point at /app/storage, which does
            # not exist in host-backed terminal sessions.
            env["CODEX_HOME"] = str(home_dir / ".codex")
            env["CLAUDE_HOME"] = str(home_dir / ".claude")
            env["CLAUDE_CONFIG_DIR"] = str(home_dir / ".claude")
        env["SHELL"] = "/bin/bash"
        env["TERM"] = TERMINAL_TYPE
        env["GIT_CONFIG_GLOBAL"] = settings.GIT_CONFIG_GLOBAL
        env["GNUPGHOME"] = settings.GNUPGHOME

        cmd = (
            f"export PATH={HOST_REQUIRED_PATH_PREFIX}:$PATH; "
            "command -v tmux >/dev/null && "
            f"tmux new -A -s {shlex.quote(tmux_session)} \\; set -g status off || exec bash"
        )
        process = await asyncio.to_thread(
            subprocess.Popen,
            ["bash", "-lc", cmd],
            cwd=str(workspace_dir),
            env=env,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            start_new_session=True,
            close_fds=True,
        )
        os.close(slave_fd)

        self._register_pty_session(
            sandbox_id,
            session_id,
            {
                "process": process,
                "master_fd": master_fd,
                "reader_task": None,
                "on_data": on_data,
            },
        )

        if on_data:
            reader_task = asyncio.create_task(
                self._pty_reader(
                    sandbox_id,
                    session_id,
                    master_fd,
                    on_data,
                    str(home_dir),
                    str(workspace_dir),
                )
            )
            self._pty_sessions[sandbox_id][session_id]["reader_task"] = reader_task

        return PtySession(id=session_id, pid=process.pid, rows=rows, cols=cols)

    async def _pty_reader(
        self,
        sandbox_id: str,
        session_id: str,
        master_fd: int,
        on_data: PtyDataCallbackType,
        home_dir_str: str,
        workspace_dir_str: str,
    ) -> None:
        # In web mode, replace real host paths in terminal output with virtual
        # paths so the user sees /home/user/workspace instead of /var/data/sandboxes/abc123.
        # Desktop mode skips masking since the user's real paths are expected.
        mask = not settings.DESKTOP_MODE
        if mask:
            home_bytes = home_dir_str.encode()
            workspace_bytes = workspace_dir_str.encode()
            virtual_home = SANDBOX_HOME_DIR.encode()
            virtual_workspace = SANDBOX_WORKSPACE_DIR.encode()
        try:
            while True:
                chunk = await asyncio.to_thread(os.read, master_fd, 4096)
                if not chunk:
                    break
                if mask:
                    if workspace_bytes != home_bytes:
                        chunk = chunk.replace(workspace_bytes, virtual_workspace)
                    chunk = chunk.replace(home_bytes, virtual_home)
                await on_data(chunk)
        except asyncio.CancelledError:
            pass
        except OSError as e:
            logger.error("PTY reader error for session %s: %s", session_id, e)

    async def send_pty_input(
        self,
        sandbox_id: str,
        pty_id: str,
        data: bytes,
    ) -> None:
        session = self._get_pty_session(sandbox_id, pty_id)
        if not session:
            return
        master_fd = session.get("master_fd")
        if master_fd is None:
            return
        await asyncio.to_thread(os.write, master_fd, data)

    async def resize_pty(
        self,
        sandbox_id: str,
        pty_id: str,
        size: PtySize,
    ) -> None:
        session = self._get_pty_session(sandbox_id, pty_id)
        if not session:
            return
        master_fd = session.get("master_fd")
        process = session.get("process")
        if master_fd is None:
            return
        await asyncio.to_thread(self._resize_fd, master_fd, size.rows, size.cols)
        if process and process.pid:
            with contextlib.suppress(ProcessLookupError):
                os.kill(process.pid, signal.SIGWINCH)

    async def kill_pty(
        self,
        sandbox_id: str,
        pty_id: str,
    ) -> None:
        session = self._get_pty_session(sandbox_id, pty_id)
        if not session:
            return

        reader_task = session.get("reader_task")
        if reader_task:
            reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await reader_task

        process = session.get("process")
        if process and process.poll() is None:
            process.terminate()
            with contextlib.suppress(Exception):
                await asyncio.to_thread(process.wait, 2)
            if process.poll() is None:
                with contextlib.suppress(Exception):
                    process.kill()

        master_fd = session.get("master_fd")
        if master_fd is not None:
            with contextlib.suppress(OSError):
                os.close(master_fd)

        self._cleanup_pty_session_tracking(sandbox_id, pty_id)

    async def delete_secret(
        self,
        sandbox_id: str,
        key: str,
    ) -> None:
        # Host provider manages secrets as lines in .bashrc — override the base
        # class sed-based approach with direct file manipulation since there's
        # no container shell to exec into.
        bashrc = self._resolve_path(sandbox_id, SANDBOX_BASHRC_PATH)
        lines = await asyncio.to_thread(bashrc.read_text)
        prefix = f"export {key}="
        filtered = [
            line
            for line in lines.splitlines(keepends=True)
            if not line.startswith(prefix)
        ]
        await asyncio.to_thread(bashrc.write_text, "".join(filtered))

    async def cleanup(self) -> None:
        await super().cleanup()
        self._sandboxes.clear()
