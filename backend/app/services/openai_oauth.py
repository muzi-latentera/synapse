import json
import logging
from typing import Any, cast

import httpx

from app.constants import REDIS_KEY_OPENAI_DEVICE_CODE
from app.utils.redis import redis_connection

logger = logging.getLogger(__name__)

OPENAI_DEVICE_CODE_URL = "https://auth.openai.com/oauth/device/code"
OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token"
CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
OPENAI_SCOPES = "openid profile email offline_access"


async def request_device_code() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            OPENAI_DEVICE_CODE_URL,
            data={
                "client_id": CODEX_CLIENT_ID,
                "scope": OPENAI_SCOPES,
                "audience": "https://api.openai.com/v1",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Device code request failed: {response.text}")
        return cast(dict[str, Any], response.json())


async def poll_for_tokens(device_code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            OPENAI_TOKEN_URL,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": device_code,
                "client_id": CODEX_CLIENT_ID,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        data = response.json()

        if response.status_code != 200:
            error = data.get("error", "unknown_error")
            if error == "authorization_pending":
                return {"status": "pending"}
            if error == "slow_down":
                return {
                    "status": "slow_down",
                    "retry_after_seconds": int(data.get("interval", 10)),
                }
            if error == "expired_token":
                return {"status": "expired"}
            return {"status": "error", "detail": data.get("error_description", error)}

        return {"status": "success", "tokens": data}


def build_auth_json(token_response: dict[str, Any]) -> str:
    auth_data = {
        "tokens": {
            "access_token": token_response.get("access_token", ""),
            "refresh_token": token_response.get("refresh_token", ""),
            "id_token": token_response.get("id_token", ""),
        }
    }
    return json.dumps(auth_data)


async def store_device_code(user_id: str, device_code: str, expires_in: int) -> None:
    key = REDIS_KEY_OPENAI_DEVICE_CODE.format(user_id=user_id)
    async with redis_connection() as redis:
        await redis.setex(key, expires_in, device_code)


async def get_device_code(user_id: str) -> str | None:
    key = REDIS_KEY_OPENAI_DEVICE_CODE.format(user_id=user_id)
    async with redis_connection() as redis:
        value = await redis.get(key)
    if not value:
        return None
    return cast(str, value)


async def clear_device_code(user_id: str) -> None:
    key = REDIS_KEY_OPENAI_DEVICE_CODE.format(user_id=user_id)
    async with redis_connection() as redis:
        await redis.delete(key)
