from __future__ import annotations

import json
from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass, field
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
# Valid Codex ACP session modes. Unknown values fall back to "auto".
CODEX_SESSION_MODES = frozenset({"auto", "read-only", "full-access"})


@dataclass(frozen=True)
class PermissionConfig:
    # ACP session mode ID sent via set_session_mode() after session creation.
    session_mode: str
    # Codex-only: launch-time approval_policy passed as a CLI config flag.
    # Claude doesn't use launch-time approval; its modes are session-level only.
    launch_approval_policy: str | None = None
    # Codex full-access also needs the permissive sandbox grant at launch time.
    grant_full_sandbox: bool = False


@dataclass(frozen=True)
class LaunchConfig:
    # Everything needed to spawn the agent process: the binary to exec
    # and CLI flags to pass.
    binary: str
    cli_args: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SessionConfig:
    # Everything needed to configure the ACP session: env overrides to
    # inject before spawning, metadata for new_session/load_session,
    # mapped reasoning effort, and the permission model.
    meta: dict[str, Any] = field(default_factory=dict)
    env_overrides: dict[str, str] = field(default_factory=dict)
    reasoning_effort: str | None = None
    permission: PermissionConfig = field(
        default_factory=lambda: PermissionConfig(session_mode="default")
    )


class AgentAdapter(ABC):
    # Each agent binary (claude-agent-acp, codex-acp) speaks ACP over stdio but
    # differs in CLI flags, env vars, session metadata, and permission models.
    # Adapters encapsulate those differences so the rest of the codebase works
    # with a uniform AcpSessionConfig regardless of which agent is running.

    def __init__(self, kind: AgentKind) -> None:
        self.kind = kind

    @abstractmethod
    def build_launch_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        reasoning_effort: str | None,
        permission_mode: str | None,
        launch_approval_policy: str | None,
    ) -> LaunchConfig:
        raise NotImplementedError

    @abstractmethod
    def build_session_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        thinking_mode: str | None,
        permission_mode: str,
    ) -> SessionConfig:
        raise NotImplementedError

    @abstractmethod
    def map_session_mode(self, permission_mode: str) -> str:
        # Maps a UI permission mode string to the ACP session mode ID.
        # Used mid-stream for plan-mode transitions where only the mode
        # string is needed, not the full SessionConfig.
        raise NotImplementedError


class ClaudeAgentAdapter(AgentAdapter):
    def __init__(self) -> None:
        super().__init__(kind=AgentKind.CLAUDE)

    def build_launch_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        reasoning_effort: str | None,
        permission_mode: str | None,
        launch_approval_policy: str | None,
    ) -> LaunchConfig:
        # Claude doesn't use CLI args — all config is via env vars and session meta.
        return LaunchConfig(binary="claude-agent-acp")

    def build_session_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        thinking_mode: str | None,
        permission_mode: str,
    ) -> SessionConfig:
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

        # Claude uses MAX_THINKING_TOKENS env var for thinking budget.
        env_overrides: dict[str, str] = {}
        max_thinking = THINKING_MODE_TOKENS.get(thinking_mode or "")
        if max_thinking:
            env_overrides["MAX_THINKING_TOKENS"] = str(max_thinking)

        # Claude doesn't remap reasoning effort or permission modes —
        # thinking is controlled via env var, permissions are session-level.
        return SessionConfig(
            meta=meta,
            env_overrides=env_overrides,
            permission=PermissionConfig(session_mode=permission_mode),
        )

    def map_session_mode(self, permission_mode: str) -> str:
        # Claude session modes are a direct passthrough from the UI.
        return permission_mode


class CodexAgentAdapter(AgentAdapter):
    def __init__(self) -> None:
        super().__init__(kind=AgentKind.CODEX)

    def build_launch_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        reasoning_effort: str | None,
        permission_mode: str | None,
        launch_approval_policy: str | None,
    ) -> LaunchConfig:
        # Codex uses CLI -c flags for all customization (system prompt,
        # reasoning effort, sandbox permissions, approval policy).
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
        return LaunchConfig(binary="codex-acp", cli_args=args)

    def build_session_config(
        self,
        *,
        system_prompt: str | None,
        system_prompt_is_full_replace: bool,
        thinking_mode: str | None,
        permission_mode: str,
    ) -> SessionConfig:
        # Codex accepts reasoning_effort directly as a CLI config value
        # (low, medium, high, xhigh) — no remapping needed.
        reasoning_effort = thinking_mode or None

        # Codex ACP advertises three session modes: auto, read-only, full-access.
        # The UI sends these same values, so session_mode is a direct passthrough.
        # launch_approval_policy controls the separate approval_policy CLI flag.
        session_mode = self.map_session_mode(permission_mode)
        launch_approval_policy = CODEX_APPROVAL_POLICIES.get(permission_mode)
        permission = PermissionConfig(
            session_mode=session_mode,
            launch_approval_policy=launch_approval_policy,
            grant_full_sandbox=launch_approval_policy == "never",
        )

        # Codex passes everything via CLI args, not session meta.
        return SessionConfig(
            reasoning_effort=reasoning_effort,
            permission=permission,
        )

    def map_session_mode(self, permission_mode: str) -> str:
        return permission_mode if permission_mode in CODEX_SESSION_MODES else "auto"


AGENT_ADAPTERS: dict[AgentKind, AgentAdapter] = {
    AgentKind.CLAUDE: ClaudeAgentAdapter(),
    AgentKind.CODEX: CodexAgentAdapter(),
}
