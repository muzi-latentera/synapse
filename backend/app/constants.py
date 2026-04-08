import os
from pathlib import Path
from typing import Final, NamedTuple

from app.core.config import get_settings
from app.services.acp.adapters import AgentKind

settings = get_settings()


class ModelInfo(NamedTuple):
    display_name: str
    agent_kind: AgentKind
    context_window: int | None


CLAUDE_DIR: Final[Path] = (
    Path(d) if (d := os.environ.get("CLAUDE_CONFIG_DIR")) else Path.home() / ".claude"
)
CODEX_DIR: Final[Path] = (
    Path(d) if (d := os.environ.get("CODEX_HOME")) else Path.home() / ".codex"
)
CLAUDE_SKILLS_DIR: Final[Path] = (
    CLAUDE_DIR if settings.DESKTOP_MODE else Path(settings.STORAGE_PATH) / ".claude"
) / "skills"
CODEX_SKILLS_DIR: Final[Path] = (
    CODEX_DIR if settings.DESKTOP_MODE else Path(settings.STORAGE_PATH) / ".codex"
) / "skills"

HOST_REQUIRED_PATH_PREFIX: Final[str] = (
    f"{Path.home()}/.local/bin:/opt/homebrew/bin:/usr/local/bin"
)

REDIS_KEY_CHAT_STREAM_LIVE: Final[str] = "chat:{chat_id}:stream:live"
REDIS_KEY_USER_SETTINGS: Final[str] = "user_settings:{user_id}"
REDIS_KEY_CHAT_CONTEXT_USAGE: Final[str] = "chat:{chat_id}:context_usage"
REDIS_KEY_CHAT_QUEUE: Final[str] = "chat:{chat_id}:queue"
REDIS_KEY_CHAT_QUEUE_SEND_NOW: Final[str] = "chat:{chat_id}:queue:send_now"

QUEUE_MESSAGE_TTL_SECONDS: Final[int] = 3600

SANDBOX_DEFAULT_COMMAND_TIMEOUT: Final[int] = 120
PTY_OUTPUT_QUEUE_SIZE: Final[int] = 512
PTY_INPUT_QUEUE_SIZE: Final[int] = 1024

DOCKER_AVAILABLE_PORTS: Final[list[int]] = [
    3000,
    3001,
    5000,
    8000,
    8080,
    5173,
    4200,
    8888,
    4321,
    3030,
    5500,
    1234,
    4000,
]

SANDBOX_SYSTEM_VARIABLES: Final[list[str]] = [
    "SHELL",
    "PWD",
    "LOGNAME",
    "HOME",
    "USER",
    "SHLVL",
    "PS1",
    "PATH",
    "_",
    "NVM_DIR",
    "NODE_VERSION",
    "TERM",
]

SANDBOX_BINARY_EXTENSIONS: Final[set[str]] = {
    "exe",
    "dll",
    "so",
    "dylib",
    "a",
    "lib",
    "obj",
    "o",
    "zip",
    "tar",
    "gz",
    "bz2",
    "xz",
    "7z",
    "rar",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "ico",
    "tiff",
    "webp",
    "svg",
    "mp4",
    "avi",
    "mkv",
    "mov",
    "wmv",
    "flv",
    "webm",
    "mp3",
    "wav",
    "flac",
    "ogg",
    "wma",
    "aac",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "bin",
    "dat",
    "db",
    "sqlite",
    "sqlite3",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "eot",
    "class",
    "jar",
    "war",
    "ear",
    "pyc",
    "pyo",
    "pyd",
}

SANDBOX_HOME_DIR: Final[str] = "/home/user"
SANDBOX_WORKSPACE_DIR: Final[str] = "/home/user/workspace"
SANDBOX_CLAUDE_DIR: Final[str] = "/home/user/.claude"
SANDBOX_CODEX_DIR: Final[str] = "/home/user/.codex"
SANDBOX_CLAUDE_JSON_PATH: Final[str] = "/home/user/.claude.json"
SANDBOX_GIT_ASKPASS_PATH: Final[str] = "/home/user/.git-askpass.sh"

WS_MSG_AUTH: Final[str] = "auth"
WS_MSG_INIT: Final[str] = "init"
WS_MSG_RESIZE: Final[str] = "resize"
WS_MSG_CLOSE: Final[str] = "close"
WS_MSG_PING: Final[str] = "ping"
WS_MSG_DETACH: Final[str] = "detach"

WS_CLOSE_AUTH_FAILED: Final[int] = 4001
WS_CLOSE_SANDBOX_NOT_FOUND: Final[int] = 4004

TERMINAL_TYPE: Final[str] = "xterm-256color"
DEFAULT_PTY_ROWS: Final[int] = 24
DEFAULT_PTY_COLS: Final[int] = 80
DOCKER_STATUS_RUNNING: Final[str] = "running"

SANDBOX_BASHRC_PATH: Final[str] = "/home/user/.bashrc"


MODELS: dict[str, ModelInfo] = {
    "sonnet[1m]": ModelInfo("Sonnet", AgentKind.CLAUDE, 1_000_000),
    "opus[1m]": ModelInfo("Opus", AgentKind.CLAUDE, 1_000_000),
    "haiku": ModelInfo("Haiku", AgentKind.CLAUDE, 200_000),
    "gpt-5.4": ModelInfo("GPT 5.4", AgentKind.CODEX, 1_000_000),
    "gpt-5.4-mini": ModelInfo("GPT 5.4 Mini", AgentKind.CODEX, 400_000),
    "gpt-5.3-codex": ModelInfo("GPT 5.3 Codex", AgentKind.CODEX, 400_000),
    "gpt-5.2-codex": ModelInfo("GPT 5.2 Codex", AgentKind.CODEX, 400_000),
    "gpt-5.2": ModelInfo("GPT 5.2", AgentKind.CODEX, 400_000),
    "gpt-5.1-codex-max": ModelInfo("GPT 5.1 Codex Max", AgentKind.CODEX, 400_000),
    "gpt-5.1-codex-mini": ModelInfo("GPT 5.1 Codex Mini", AgentKind.CODEX, 400_000),
}

# Built-in slash commands exposed to the frontend per agent kind.
# Claude commands sourced from the Claude SDK's supportedCommands(),
# filtered by what claude-agent-acp exposes via ACP (excludes cost,
# login, logout, release-notes, todos, and local-only commands like
# context, heapdump, extra-usage).
# Codex commands sourced from the codex-acp README.
BUILTIN_SLASH_COMMANDS: dict[AgentKind, list[dict[str, str]]] = {
    AgentKind.CLAUDE: [
        {
            "value": "/compact",
            "label": "Compact",
            "description": "Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]",
        },
        {"value": "/review", "label": "Review", "description": "Review a pull request"},
        {
            "value": "/init",
            "label": "Init",
            "description": "Initialize a new CLAUDE.md file with codebase documentation",
        },
        {
            "value": "/debug",
            "label": "Debug",
            "description": "Debug your current Claude Code session",
        },
        {
            "value": "/security-review",
            "label": "Security Review",
            "description": "Complete a security review of the pending changes on the current branch",
        },
        {
            "value": "/insights",
            "label": "Insights",
            "description": "Generate a report analyzing your Claude Code sessions",
        },
        {
            "value": "/simplify",
            "label": "Simplify",
            "description": "Review changed code for reuse, quality and efficiency, then fix any issues found",
        },
        {
            "value": "/loop",
            "label": "Loop",
            "description": "Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo, defaults to 10m)",
        },
        {
            "value": "/batch",
            "label": "Batch",
            "description": "Research and plan a large-scale change, then execute it in parallel across isolated worktree agents that each open a PR",
        },
        {
            "value": "/update-config",
            "label": "Update Config",
            "description": "Configure Claude Code settings via settings.json",
        },
        {
            "value": "/claude-api",
            "label": "Claude API",
            "description": "Build apps with the Claude API or Anthropic SDK",
        },
    ],
    AgentKind.CODEX: [
        {"value": "/review", "label": "Review", "description": "Review a pull request"},
        {
            "value": "/review-branch",
            "label": "Review Branch",
            "description": "Review changes on the current branch",
        },
        {
            "value": "/review-commit",
            "label": "Review Commit",
            "description": "Review a specific commit",
        },
        {
            "value": "/init",
            "label": "Init",
            "description": "Initialize project configuration",
        },
        {
            "value": "/compact",
            "label": "Compact",
            "description": "Clear conversation history but keep a summary in context",
        },
    ],
}
