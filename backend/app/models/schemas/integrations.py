from pydantic import BaseModel


class DeviceCodeResponse(BaseModel):
    verification_uri: str
    user_code: str
    device_code: str
    interval: int
    expires_in: int


class PollTokenRequest(BaseModel):
    device_code: str


class OpenAIPollTokenRequest(BaseModel):
    device_code: str
    user_code: str


class PollTokenResponse(BaseModel):
    status: str
    access_token: str | None = None
    refresh_token: str | None = None
    interval: int | None = None
