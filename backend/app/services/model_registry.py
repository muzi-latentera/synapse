from __future__ import annotations

from dataclasses import dataclass

from app.services.acp.adapters import AgentKind


@dataclass(frozen=True)
class ModelEntry:
    model_id: str
    name: str
    agent_kind: AgentKind
    context_window: int | None = None


_RAW_MODELS: dict[AgentKind, list[tuple[str, str, int | None]]] = {
    AgentKind.CLAUDE: [
        ("claude-sonnet-4-6", "Sonnet", 1_000_000),
        ("claude-opus-4-6", "Opus", 1_000_000),
        ("claude-haiku-4-5-20251001", "Haiku", 200_000),
    ],
    AgentKind.CODEX: [
        ("gpt-5.4", "GPT 5.4", 1_000_000),
        ("gpt-5.4-mini", "GPT 5.4 Mini", 400_000),
        ("gpt-5.3-codex", "GPT 5.3 Codex", 400_000),
        ("gpt-5.2-codex", "GPT 5.2 Codex", 400_000),
        ("gpt-5.2", "GPT 5.2", 400_000),
        ("gpt-5.1-codex-max", "GPT 5.1 Codex Max", 400_000),
        ("gpt-5.1-codex-mini", "GPT 5.1 Codex Mini", 400_000),
    ],
}

_MODELS_BY_AGENT: dict[AgentKind, list[ModelEntry]] = {
    kind: [ModelEntry(mid, name, kind, ctx) for mid, name, ctx in entries]
    for kind, entries in _RAW_MODELS.items()
}

_ALL_MODELS: list[ModelEntry] = [
    m for models in _MODELS_BY_AGENT.values() for m in models
]

_BY_ID: dict[str, ModelEntry] = {m.model_id: m for m in _ALL_MODELS}


def get_all_model_ids() -> list[str]:
    return [m.model_id for m in _ALL_MODELS]


def get_models_for_agent(agent_kind: str) -> list[ModelEntry]:
    try:
        kind = AgentKind(agent_kind)
    except ValueError:
        kind = AgentKind.CLAUDE
    return _MODELS_BY_AGENT.get(kind, _MODELS_BY_AGENT[AgentKind.CLAUDE])


def get_all_models() -> list[ModelEntry]:
    return _ALL_MODELS


def get_context_window(model_id: str) -> int | None:
    entry = _BY_ID.get(model_id)
    return entry.context_window if entry else None


def get_agent_kind_for_model(model_id: str) -> AgentKind:
    entry = _BY_ID.get(model_id)
    return entry.agent_kind if entry else AgentKind.CLAUDE
