from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.services.acp.session import AcpSession, AcpSessionConfig

logger = logging.getLogger(__name__)

TASK_CANCEL_TIMEOUT_SECONDS = 5.0

IDLE_CHECK_INTERVAL_SECONDS = 60.0


@dataclass
class ChatSession:
    chat_id: str
    acp_session: AcpSession
    fingerprint: str
    current_model: str = ""
    current_mode: str = ""
    active_generation_task: asyncio.Task[Any] | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    last_used_at: float = field(default_factory=time.monotonic)


# In-process registry of active ACP sessions keyed by chat_id. A single
# session is reused across consecutive messages in the same chat so the
# agent keeps its conversation context. Sessions are fingerprinted by
# config — if the user changes model provider, env vars, MCP servers, etc.,
# the old session is torn down and a fresh one is created.
class SessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, ChatSession] = {}
        # Pending cancels are tracked separately so a cancel request that
        # arrives between generations (no active task to cancel) is still
        # honoured when the next generation starts.
        self._pending_cancels: set[str] = set()

    async def get_or_create(
        self,
        *,
        chat_id: str,
        config: AcpSessionConfig,
    ) -> tuple[ChatSession, bool]:
        session = self._sessions.get(chat_id)
        fingerprint = self._compute_fingerprint(config)

        if session is not None and not session.acp_session.is_alive():
            await self._close_session(session)
            session = None

        if session is not None and session.fingerprint != fingerprint:
            await self._close_session(session)
            session = None
            # The stored session_id belongs to the old agent/config —
            # don't try to resume it in the new process.
            config.resume_session_id = None

        created = session is None
        if created:
            acp_session = await AcpSession.create(config)
            session = ChatSession(
                chat_id=chat_id,
                acp_session=acp_session,
                fingerprint=fingerprint,
                current_model=config.model or "",
            )
            self._sessions[chat_id] = session

        assert session is not None
        session.last_used_at = time.monotonic()
        return session, created

    async def cancel_generation(self, chat_id: str) -> None:
        self._pending_cancels.add(chat_id)
        session = self._sessions.get(chat_id)
        if session is None:
            return
        session.cancel_event.set()
        await session.acp_session.cancel()

    def resolve_permission(
        self,
        chat_id: str,
        request_id: str,
        *,
        option_id: str = "",
        user_answers: dict[str, Any] | None = None,
        alternative_instruction: str | None = None,
    ) -> bool:
        session = self._sessions.get(chat_id)
        if session is None:
            return False
        return session.acp_session.handler.resolve_permission(
            request_id,
            option_id=option_id,
            user_answers=user_answers,
            alternative_instruction=alternative_instruction,
        )

    def consume_pending_cancel(self, chat_id: str) -> bool:
        if chat_id in self._pending_cancels:
            self._pending_cancels.discard(chat_id)
            return True
        return False

    async def terminate(self, chat_id: str) -> None:
        session = self._sessions.pop(chat_id, None)
        if session is not None:
            await self._close_session(session)

    async def terminate_all(self) -> None:
        sessions = list(self._sessions.values())
        self._sessions.clear()
        await asyncio.gather(
            *[self._close_session(s) for s in sessions],
            return_exceptions=True,
        )

    async def close_idle_sessions(self, ttl_seconds: float) -> None:
        now = time.monotonic()
        expired: list[str] = []

        for chat_id, session in self._sessions.items():
            task = session.active_generation_task
            if task is not None and not task.done():
                continue
            if (now - session.last_used_at) >= ttl_seconds:
                expired.append(chat_id)

        await asyncio.gather(
            *[self._close_session(self._sessions.pop(cid)) for cid in expired],
            return_exceptions=True,
        )

        if expired:
            logger.info("Closed %d idle chat session(s)", len(expired))

    @staticmethod
    def _compute_fingerprint(config: AcpSessionConfig) -> str:
        fingerprint_dict: dict[str, Any] = {
            "agent_kind": config.agent_kind.value,
            "env": config.env,
            "mcp_servers": config.mcp_servers,
            "system_prompt": config.system_prompt,
            "worktree": config.worktree,
            "reasoning_effort": config.reasoning_effort,
            "launch_approval_policy": config.launch_approval_policy,
        }
        # cwd changes dynamically in worktree mode (workspace → worktree path
        # after session init), so including it would invalidate the session on
        # the second turn.
        if not config.worktree:
            fingerprint_dict["cwd"] = config.cwd
        data = json.dumps(fingerprint_dict, sort_keys=True, default=str)
        return hashlib.sha256(data.encode()).hexdigest()

    @staticmethod
    async def _close_session(session: ChatSession) -> None:
        task = session.active_generation_task
        if task is not None and not task.done():
            task.cancel()
            try:
                await asyncio.wait_for(task, timeout=TASK_CANCEL_TIMEOUT_SECONDS)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass

        try:
            await session.acp_session.close()
        except (OSError, ConnectionError) as exc:
            logger.debug(
                "Error closing ACP session for chat %s: %s", session.chat_id, exc
            )


session_registry = SessionRegistry()
