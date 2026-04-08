import asyncio
import base64
import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import NamedTuple, cast
from uuid import UUID

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Query, WebSocket, status
from fastapi_users.password import PasswordHelper
from jose import jwt
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..constants import WS_MSG_AUTH
from ..db.session import SessionLocal, get_db
from ..models.db_models.user import User
from ..services.exceptions import UserException
from ..services.sandbox_providers import SandboxProviderType
from ..services.user import UserService
from .config import get_settings
from .user_manager import optional_current_active_user

settings = get_settings()
password_helper = PasswordHelper()
logger = logging.getLogger(__name__)


def _get_fernet_key() -> bytes:
    # Derive a 32-byte Fernet key from SECRET_KEY via SHA-256 so we don't
    # require users to set a separate Fernet-formatted key.
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


_fernet = Fernet(_get_fernet_key())


def encrypt_value(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    return _fernet.decrypt(encrypted_value.encode()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        verified, _ = password_helper.verify_and_update(plain_password, hashed_password)
        return bool(verified)
    except Exception as e:
        logger.warning("Password verification failed: %s", e)
        return False


def get_password_hash(password: str) -> str:
    return str(password_helper.hash(password))


async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            logger.warning("No sub in token payload")
            return None

        user_id = UUID(user_id_str)
        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            logger.info("Successfully validated token for user %s", user_id)
        else:
            logger.warning("User %s not found in database", user_id)
        return cast(User | None, user)
    except Exception as e:
        logger.error("Error validating token: %s", e)
        return None


async def get_current_user(
    # Accepts auth via either the standard Bearer header (resolved by
    # fastapi-users into `user`) or a `?token=` query param for SSE/WebSocket
    # endpoints where the browser can't set custom headers.
    token_query: str | None = Query(None, alias="token"),
    user: User | None = Depends(optional_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token_query:
        query_user = await get_user_from_token(token_query, db)
        if query_user is None:
            raise credentials_exception
        return query_user

    if user is None:
        raise credentials_exception

    return user


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )


class WebSocketAuthResult(NamedTuple):
    user: User | None
    sandbox_provider: str


NO_WS_AUTH = WebSocketAuthResult(None, SandboxProviderType.DOCKER.value)


async def authenticate_websocket_user(token: str) -> WebSocketAuthResult:
    # Validates the JWT, loads the user, and resolves their sandbox provider
    # preference so the terminal connects to the right backend (Docker/Host).
    try:
        async with SessionLocal() as db:
            user = await get_user_from_token(token, db)
            if not user:
                return NO_WS_AUTH

            user_service = UserService(session_factory=SessionLocal)
            try:
                user_settings = await user_service.get_user_settings(user.id, db=db)
                sandbox_provider = user_settings.sandbox_provider
            except UserException:
                sandbox_provider = SandboxProviderType.DOCKER.value

        return WebSocketAuthResult(user, sandbox_provider)
    except (ValueError, OSError, SQLAlchemyError) as e:
        logger.warning("WebSocket authentication failed: %s", e)
        return NO_WS_AUTH


async def wait_for_websocket_auth(
    websocket: WebSocket, timeout: float = 10.0
) -> WebSocketAuthResult:
    # WebSocket connections can't send headers after the handshake, so the
    # client sends a JSON auth message as the first frame. This waits for
    # that message and validates the token.
    try:
        message = await asyncio.wait_for(websocket.receive(), timeout=timeout)
        data = json.loads(message["text"])
    except (asyncio.TimeoutError, json.JSONDecodeError, KeyError):
        return NO_WS_AUTH

    if not isinstance(data, dict) or data.get("type") != WS_MSG_AUTH:
        return NO_WS_AUTH

    token = data.get("token")
    if not isinstance(token, str) or not token:
        return NO_WS_AUTH

    return await authenticate_websocket_user(token)
