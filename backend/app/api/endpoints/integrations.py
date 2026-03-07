import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.models.db_models.user import User
from app.models.schemas.integrations import (
    DeviceCodeResponse,
    OpenAIPollTokenRequest,
    PollTokenRequest,
    PollTokenResponse,
)
from app.services.copilot_oauth import CopilotOAuthService
from app.services.openai_oauth import VERIFICATION_URI, OpenAIOAuthService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/copilot/device-code", response_model=DeviceCodeResponse)
async def start_device_flow(
    _current_user: User = Depends(get_current_user),
) -> DeviceCodeResponse:
    try:
        data: dict[str, Any] = await CopilotOAuthService.start_device_authorization()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Failed to initiate GitHub device authorization",
        )

    return DeviceCodeResponse(
        verification_uri=data["verification_uri"],
        user_code=data["user_code"],
        device_code=data["device_code"],
        interval=data.get("interval", 5),
        expires_in=data.get("expires_in", 900),
    )


@router.post("/copilot/poll-token", response_model=PollTokenResponse)
async def poll_token(
    request: PollTokenRequest,
    _current_user: User = Depends(get_current_user),
) -> PollTokenResponse:
    try:
        data: dict[str, Any] = await CopilotOAuthService.poll_access_token(
            request.device_code
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="GitHub token request failed")

    if data.get("access_token"):
        return PollTokenResponse(status="success", access_token=data["access_token"])

    error = data.get("error", "unknown")
    if error == "authorization_pending":
        return PollTokenResponse(status="pending")
    if error == "slow_down":
        interval = data.get("interval")
        if isinstance(interval, int) and interval > 0:
            return PollTokenResponse(status="slow_down", interval=interval)
        return PollTokenResponse(status="slow_down")

    raise HTTPException(status_code=400, detail=f"Authorization failed: {error}")


@router.post("/openai/device-code", response_model=DeviceCodeResponse)
async def start_openai_device_flow(
    _current_user: User = Depends(get_current_user),
) -> DeviceCodeResponse:
    try:
        data: dict[str, Any] = await OpenAIOAuthService.start_device_authorization()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Failed to initiate OpenAI device authorization",
        )

    return DeviceCodeResponse(
        verification_uri=VERIFICATION_URI,
        user_code=data["user_code"],
        device_code=data["device_auth_id"],
        interval=int(data.get("interval", 5)),
        expires_in=data.get("expires_in", 900),
    )


@router.post("/openai/poll-token", response_model=PollTokenResponse)
async def poll_openai_token(
    request: OpenAIPollTokenRequest,
    _current_user: User = Depends(get_current_user),
) -> PollTokenResponse:
    try:
        data: dict[str, Any] = await OpenAIOAuthService.poll_device_token(
            request.device_code, request.user_code
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="OpenAI token request failed")

    status_code = data.get("status_code", 0)
    if status_code in (403, 404):
        return PollTokenResponse(status="pending")

    if status_code == 200:
        auth_code = data.get("authorization_code")
        code_verifier = data.get("code_verifier")
        if not auth_code or not code_verifier:
            raise HTTPException(
                status_code=502,
                detail="Incomplete authorization response from OpenAI",
            )
        try:
            tokens = await OpenAIOAuthService.exchange_authorization_code(
                auth_code, code_verifier
            )
        except httpx.HTTPError:
            raise HTTPException(
                status_code=502,
                detail="Failed to exchange OpenAI authorization code",
            )
        return PollTokenResponse(
            status="success",
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
        )

    raise HTTPException(
        status_code=400,
        detail=f"OpenAI authorization failed (status {status_code})",
    )
