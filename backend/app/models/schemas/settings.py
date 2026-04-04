from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomAgent(BaseModel):
    name: str
    description: str
    content: str
    allowed_tools: list[str] | None = None


class CustomMcp(BaseModel):
    name: str
    description: str
    command_type: Literal["npx", "bunx", "uvx", "http"]
    package: str | None = None
    url: str | None = None
    env_vars: dict[str, str] | None = None
    args: list[str] | None = None
    enabled: bool = True


class CustomEnvVar(BaseModel):
    key: str
    value: str


class CustomSkill(BaseModel):
    name: str
    description: str
    size_bytes: int
    file_count: int


class CustomSlashCommand(BaseModel):
    name: str
    description: str
    content: str
    argument_hint: str | None = None
    allowed_tools: list[str] | None = None


class Persona(BaseModel):
    name: str
    content: str


class InstalledPluginSchema(BaseModel):
    name: str
    version: str | None = None
    installed_at: str
    components: list[str] = Field(default_factory=list)


class UserSettingsBase(BaseModel):
    github_personal_access_token: str | None = None
    sandbox_provider: Literal["docker", "host"] = "docker"
    custom_instructions: str | None = Field(default=None, max_length=1500)
    custom_mcps: list[CustomMcp] | None = None
    custom_env_vars: list[CustomEnvVar] | None = None
    personas: list[Persona] | None = None
    installed_plugins: list[InstalledPluginSchema] | None = None
    notifications_enabled: bool = True
    auto_compact_disabled: bool = False
    attribution_disabled: bool = False

    @field_validator(
        "custom_mcps",
        "custom_env_vars",
        "personas",
        "installed_plugins",
        mode="before",
    )
    @classmethod
    def _normalize_json_lists(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return []
        raise ValueError(f"Expected list or None, got {type(value).__name__}")


class UserSettingsResponse(UserSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    custom_agents: list[CustomAgent] | None = None
    custom_skills: list[CustomSkill] | None = None
    custom_slash_commands: list[CustomSlashCommand] | None = None
