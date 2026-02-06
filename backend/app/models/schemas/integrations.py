from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class OAuthClientUploadRequest(BaseModel):
    client_config: dict[str, Any] = Field(
        ..., description="Contents of gcp-oauth.keys.json"
    )


class OAuthClientResponse(BaseModel):
    success: bool
    message: str


class OAuthUrlResponse(BaseModel):
    url: str


class GmailStatusResponse(BaseModel):
    connected: bool
    email: str | None = None
    connected_at: datetime | None = None
    has_oauth_client: bool = False


class DeviceCodeResponse(BaseModel):
    user_code: str
    verification_uri: str
    verification_uri_complete: str | None = None
    expires_in: int
    interval: int


class DeviceCodePollResponse(BaseModel):
    status: str
    detail: str | None = None
    retry_after_seconds: int | None = None


class OpenAIStatusResponse(BaseModel):
    connected: bool
