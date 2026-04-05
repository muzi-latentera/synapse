from __future__ import annotations

import json
from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass
from typing import Any


class AgentKind(str, Enum):
    CLAUDE = "claude"
    CODEX = "codex"


# Claude uses MAX_THINKING_TOKENS env var (not a CLI arg) to cap the
# extended-thinking budget. These map the UI's named tiers to token counts.
THINKING_MODE_TOKENS: dict[str, int] = {
    "low": 4000,
    "medium": 10000,
    "high": 15000,
    "max": 32000,
}

# Maps UI permission modes to codex-acp launch-time approval_policy values.
# "untrusted" = deny all writes, "on-request" = prompt for risky actions,
# "never" = never prompt (auto-approve everything).
CODEX_APPROVAL_POLICIES: dict[str, str] = {
    "auto": "on-request",
    "read-only": "untrusted",
    "full-access": "never",
}
# Pre-granted sandbox permissions for full-access mode so Codex doesn't
# prompt for disk/network access on every tool call.
CODEX_AUTO_SANDBOX_PERMISSIONS = (
    '["disk-full-read-access","disk-write-access","network-full-access"]'
)


@dataclass(frozen=True)
class PermissionConfig:
    # ACP session mode ID sent via set_session_mode() after session creation.
    session_mode: str
    # Codex-only: launch-time approval_policy passed as a CLI config flag.
    # Claude doesn't use launch-time approval; its modes are session-level only.
    launch_approval_policy: str | None = None
    # Codex full-access also needs the permissive sandbox grant at launch time.
    grant_full_sandbox: bool = False


class AgentAdapter(ABC):
    # Each agent binary (claude-agent-acp, codex-acp) speaks ACP over stdio but
    # differs in CLI flags, env vars, session metadata, and permission models.
    # Adapters encapsulate those differences so the rest of the codebase works
    # with a uniform AcpSessionConfig regardless of which agent is running.
    supports_worktree: bool = False

    def __init__(self, kind: AgentKind, binary: str) -> None:
        self.kind = kind
        self.binary = binary

    def apply_env_overrides(
        self,
        env: dict[str, str],
        thinking_mode: str | None,
    ) -> None:
        return  # Optional hook — only Claude uses this to set MAX_THINKING_TOKENS

    def map_reasoning_effort(self, thinking_mode: str | None) -> str | None:
        return None

    def build_permission_config(self, permission_mode: str) -> PermissionConfig:
        return PermissionConfig(session_mode=permission_mode)

    def build_cli_args(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        reasoning_effort: str | None,
        permission_mode: str | None = None,
        launch_approval_policy: str | None = None,
    ) -> list[str]:
        return []

    @abstractmethod
    def build_session_meta(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        worktree: bool,
    ) -> dict[str, Any]:
        raise NotImplementedError


class ClaudeAgentAdapter(AgentAdapter):
    supports_worktree = True

    def __init__(self) -> None:
        super().__init__(kind=AgentKind.CLAUDE, binary="claude-agent-acp")

    def apply_env_overrides(
        self,
        env: dict[str, str],
        thinking_mode: str | None,
    ) -> None:
        max_thinking = THINKING_MODE_TOKENS.get(thinking_mode or "")
        if max_thinking:
            env["MAX_THINKING_TOKENS"] = str(max_thinking)

    def build_session_meta(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        worktree: bool,
    ) -> dict[str, Any]:
        # Session metadata is sent as _meta in new_session/load_session and
        # forwarded by the ACP bridge to Claude Code's internal config.
        # "systemPrompt" as a string replaces the default prompt entirely;
        # {"append": ...} appends to it (used for custom instructions).
        meta: dict[str, Any] = {}
        if system_prompt:
            if system_prompt_is_full_replace:
                meta["systemPrompt"] = system_prompt
            else:
                meta["systemPrompt"] = {"append": system_prompt}

        agent_options: dict[str, Any] = {}
        if worktree:
            agent_options["worktree"] = True
        if agent_options:
            meta["claudeCode"] = {"options": agent_options}
        return meta


class CodexAgentAdapter(AgentAdapter):
    def __init__(self) -> None:
        super().__init__(kind=AgentKind.CODEX, binary="codex-acp")

    def map_reasoning_effort(self, thinking_mode: str | None) -> str | None:
        # Codex accepts reasoning_effort directly as a CLI config value
        # (low, medium, high, xhigh) — no remapping needed.
        return thinking_mode or None

    def build_permission_config(self, permission_mode: str) -> PermissionConfig:
        # Codex ACP advertises three session modes: auto, read-only, full-access.
        # The UI sends these same values, so session_mode is a direct passthrough.
        # launch_approval_policy controls the separate approval_policy CLI flag.
        session_mode = {
            "auto": "auto",
            "read-only": "read-only",
            "full-access": "full-access",
        }.get(permission_mode, "auto")
        launch_approval_policy = CODEX_APPROVAL_POLICIES.get(permission_mode)
        return PermissionConfig(
            session_mode=session_mode,
            launch_approval_policy=launch_approval_policy,
            grant_full_sandbox=launch_approval_policy == "never",
        )

    def build_cli_args(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        reasoning_effort: str | None,
        permission_mode: str | None = None,
        launch_approval_policy: str | None = None,
    ) -> list[str]:
        args: list[str] = []
        # Required for Codex to expose ACP session modes (auto/read-only/full-access).
        args.extend(["-c", "features.collaboration_modes=true"])
        if system_prompt:
            args.extend(["-c", "developer_instructions=" + json.dumps(system_prompt)])
        if reasoning_effort:
            args.extend(["-c", f'model_reasoning_effort="{reasoning_effort}"'])
        if launch_approval_policy == "never":
            args.extend(["-c", f"sandbox_permissions={CODEX_AUTO_SANDBOX_PERMISSIONS}"])
        # Codex collaboration Plan Mode is not an ACP session mode or
        # launch-time approval_policy. We enter it per-turn via `/plan`.
        if launch_approval_policy in ("untrusted", "on-request", "never"):
            args.extend(["-c", f'approval_policy="{launch_approval_policy}"'])
        return args

    def build_session_meta(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        worktree: bool,
    ) -> dict[str, Any]:
        return {}


_AGENT_ADAPTERS: dict[AgentKind, AgentAdapter] = {
    AgentKind.CLAUDE: ClaudeAgentAdapter(),
    AgentKind.CODEX: CodexAgentAdapter(),
}


def get_agent_adapter(agent_kind: AgentKind) -> AgentAdapter:
    return _AGENT_ADAPTERS[agent_kind]
