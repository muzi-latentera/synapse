import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.deps import get_db, get_user_service
from app.core.security import get_current_user
from app.models.db_models import User
from app.models.schemas.integrations import (
    DeviceCodePollResponse,
    DeviceCodeResponse,
    GmailStatusResponse,
    OAuthClientResponse,
    OAuthClientUploadRequest,
    OAuthUrlResponse,
    OpenAIStatusResponse,
)
from app.services import gmail_oauth, openai_oauth
from app.services.exceptions import UserException
from app.services.user import UserService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/gmail/oauth-client", response_model=OAuthClientResponse)
async def upload_oauth_client(
    request: OAuthClientUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OAuthClientResponse:
    is_valid, error_msg = gmail_oauth.validate_client_config(request.client_config)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg or "Invalid OAuth client configuration",
        )

    try:
        user_settings = await user_service.get_user_settings(
            current_user.id, db=db, for_update=True
        )
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    user_settings.gmail_oauth_client = request.client_config
    user_settings.gmail_oauth_tokens = None
    user_settings.gmail_connected_at = None
    user_settings.gmail_email = None
    flag_modified(user_settings, "gmail_oauth_client")
    flag_modified(user_settings, "gmail_oauth_tokens")

    await user_service.commit_settings_and_invalidate_cache(
        user_settings, db, current_user.id
    )

    return OAuthClientResponse(success=True, message="OAuth client configuration saved")


@router.delete("/gmail/oauth-client", response_model=OAuthClientResponse)
async def delete_oauth_client(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OAuthClientResponse:
    try:
        user_settings = await user_service.get_user_settings(
            current_user.id, db=db, for_update=True
        )
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    user_settings.gmail_oauth_client = None
    user_settings.gmail_oauth_tokens = None
    user_settings.gmail_connected_at = None
    user_settings.gmail_email = None
    flag_modified(user_settings, "gmail_oauth_client")
    flag_modified(user_settings, "gmail_oauth_tokens")

    await user_service.commit_settings_and_invalidate_cache(
        user_settings, db, current_user.id
    )

    return OAuthClientResponse(
        success=True, message="OAuth client configuration removed"
    )


@router.get("/gmail/oauth-url", response_model=OAuthUrlResponse)
async def get_oauth_url(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OAuthUrlResponse:
    try:
        user_settings = await user_service.get_user_settings(current_user.id, db=db)
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if not user_settings.gmail_oauth_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth client not configured. Upload gcp-oauth.keys.json first.",
        )

    client_id, _ = gmail_oauth.extract_client_credentials(
        user_settings.gmail_oauth_client
    )
    state = gmail_oauth.create_oauth_state(current_user.id)
    url = gmail_oauth.build_authorization_url(client_id, state)

    return OAuthUrlResponse(url=url)


@router.get("/gmail/callback", response_class=HTMLResponse)
async def oauth_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> HTMLResponse:
    user_id = gmail_oauth.verify_oauth_state(state)
    if not user_id:
        return HTMLResponse(
            content=_callback_html("Authentication failed: Invalid state token"),
            status_code=400,
        )

    try:
        user_settings = await user_service.get_user_settings(
            user_id, db=db, for_update=True
        )
    except UserException:
        return HTMLResponse(
            content=_callback_html("Authentication failed: User not found"),
            status_code=404,
        )

    if not user_settings.gmail_oauth_client:
        return HTMLResponse(
            content=_callback_html(
                "Authentication failed: OAuth client not configured"
            ),
            status_code=400,
        )

    client_id, client_secret = gmail_oauth.extract_client_credentials(
        user_settings.gmail_oauth_client
    )

    try:
        tokens = await gmail_oauth.exchange_code_for_tokens(
            code, client_id, client_secret
        )
    except Exception as e:
        logger.error("Token exchange failed: %s", e)
        return HTMLResponse(
            content=_callback_html(
                "Authentication failed: Could not exchange code for tokens"
            ),
            status_code=500,
        )

    email = await gmail_oauth.get_user_email(tokens.get("access_token", ""))

    if "expires_in" in tokens:
        expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        tokens["expiry"] = expiry.isoformat()

    user_settings.gmail_oauth_tokens = tokens
    user_settings.gmail_connected_at = datetime.now(timezone.utc)
    user_settings.gmail_email = email
    flag_modified(user_settings, "gmail_oauth_tokens")

    await user_service.commit_settings_and_invalidate_cache(user_settings, db, user_id)

    return HTMLResponse(content=_callback_html(None, email))


@router.get("/gmail/status", response_model=GmailStatusResponse)
async def get_gmail_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> GmailStatusResponse:
    try:
        user_settings = await user_service.get_user_settings(current_user.id, db=db)
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return GmailStatusResponse(
        connected=user_settings.gmail_oauth_tokens is not None,
        email=user_settings.gmail_email,
        connected_at=user_settings.gmail_connected_at,
        has_oauth_client=user_settings.gmail_oauth_client is not None,
    )


@router.post("/gmail/disconnect", response_model=OAuthClientResponse)
async def disconnect_gmail(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OAuthClientResponse:
    try:
        user_settings = await user_service.get_user_settings(
            current_user.id, db=db, for_update=True
        )
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if user_settings.gmail_oauth_tokens:
        refresh_token = user_settings.gmail_oauth_tokens.get("refresh_token")
        if refresh_token:
            await gmail_oauth.revoke_token(refresh_token)

    user_settings.gmail_oauth_tokens = None
    user_settings.gmail_connected_at = None
    user_settings.gmail_email = None
    flag_modified(user_settings, "gmail_oauth_tokens")

    await user_service.commit_settings_and_invalidate_cache(
        user_settings, db, current_user.id
    )

    return OAuthClientResponse(success=True, message="Gmail disconnected")


@router.post("/openai/device-code", response_model=DeviceCodeResponse)
async def request_openai_device_code(
    current_user: User = Depends(get_current_user),
) -> DeviceCodeResponse:
    try:
        data = await openai_oauth.request_device_code()
    except Exception as e:
        logger.error("OpenAI device code request failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to start OpenAI authentication flow.",
        )

    await openai_oauth.store_device_code(
        str(current_user.id),
        data["device_code"],
        data.get("expires_in", 900),
    )

    return DeviceCodeResponse(
        user_code=data["user_code"],
        verification_uri=data["verification_uri"],
        verification_uri_complete=data.get("verification_uri_complete"),
        expires_in=data.get("expires_in", 900),
        interval=data.get("interval", 5),
    )


@router.post("/openai/poll-token", response_model=DeviceCodePollResponse)
async def poll_openai_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> DeviceCodePollResponse:
    device_code = await openai_oauth.get_device_code(str(current_user.id))
    if not device_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active device code flow. Start a new one.",
        )

    try:
        result = await openai_oauth.poll_for_tokens(device_code)
    except Exception as e:
        logger.error("OpenAI token poll failed: %s", e)
        return DeviceCodePollResponse(
            status="error",
            detail="Failed to complete OpenAI authentication flow.",
        )

    if result["status"] == "pending":
        return DeviceCodePollResponse(status="pending")

    if result["status"] == "slow_down":
        return DeviceCodePollResponse(
            status="pending",
            retry_after_seconds=result.get("retry_after_seconds", 10),
        )

    if result["status"] == "expired":
        await openai_oauth.clear_device_code(str(current_user.id))
        return DeviceCodePollResponse(
            status="error", detail="Device code expired. Please try again."
        )

    if result["status"] == "error":
        await openai_oauth.clear_device_code(str(current_user.id))
        return DeviceCodePollResponse(
            status="error", detail=result.get("detail", "Unknown error")
        )

    await openai_oauth.clear_device_code(str(current_user.id))
    auth_json = openai_oauth.build_auth_json(result["tokens"])

    try:
        user_settings = await user_service.get_user_settings(
            current_user.id, db=db, for_update=True
        )
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    providers = user_settings.custom_providers or []
    updated = False
    for provider in providers:
        if provider.get("provider_type") == "openai" and provider.get("enabled", True):
            provider["auth_token"] = auth_json
            updated = True
            break

    if not updated:
        return DeviceCodePollResponse(
            status="error",
            detail="No enabled OpenAI provider found. Add one first.",
        )

    user_settings.custom_providers = providers
    flag_modified(user_settings, "custom_providers")
    await user_service.commit_settings_and_invalidate_cache(
        user_settings, db, current_user.id
    )

    return DeviceCodePollResponse(status="success")


@router.get("/openai/status", response_model=OpenAIStatusResponse)
async def get_openai_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OpenAIStatusResponse:
    try:
        user_settings = await user_service.get_user_settings(current_user.id, db=db)
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    providers = user_settings.custom_providers or []
    connected = any(
        p.get("provider_type") == "openai"
        and p.get("enabled", True)
        and p.get("auth_token")
        for p in providers
    )

    return OpenAIStatusResponse(connected=connected)


@router.post("/openai/disconnect", response_model=OAuthClientResponse)
async def disconnect_openai(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> OAuthClientResponse:
    try:
        user_settings = await user_service.get_user_settings(
            current_user.id, db=db, for_update=True
        )
    except UserException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    providers = user_settings.custom_providers or []
    for provider in providers:
        if provider.get("provider_type") == "openai":
            provider["auth_token"] = None

    user_settings.custom_providers = providers
    flag_modified(user_settings, "custom_providers")
    await user_service.commit_settings_and_invalidate_cache(
        user_settings, db, current_user.id
    )

    return OAuthClientResponse(success=True, message="OpenAI disconnected")


def _callback_html(error: str | None, email: str | None = None) -> str:
    if error:
        return f"""
<!DOCTYPE html>
<html>
<head><title>Gmail Connection Failed</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff;">
    <div style="text-align: center;">
        <h2 style="color: #ef4444;">Connection Failed</h2>
        <p>{error}</p>
        <p style="color: #888;">You can close this window.</p>
    </div>
    <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>
"""
    return f"""
<!DOCTYPE html>
<html>
<head><title>Gmail Connected</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff;">
    <div style="text-align: center;">
        <h2 style="color: #22c55e;">Gmail Connected</h2>
        <p>Successfully connected{f" as {email}" if email else ""}.</p>
        <p style="color: #888;">This window will close automatically.</p>
    </div>
    <script>
        if (window.opener) window.opener.postMessage('gmail-connected', '*');
        setTimeout(() => window.close(), 2000);
    </script>
</body>
</html>
"""
