import logging
from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.core.user_manager import optional_current_active_user
from app.db.session import SessionLocal, get_db
from app.models.db_models.workspace import Workspace
from app.models.db_models.user import User
from app.services.attachment import AttachmentService
from app.services.chat import ChatService
from app.services.agent import AgentService
from app.services.message import MessageService
from app.services.exceptions import UserException
from app.services.github import GitHubService
from app.services.refresh_token import RefreshTokenService
from app.services.sandbox import SandboxService
from app.services.workspace import WorkspaceService
from app.services.sandbox_providers import SandboxProviderType
from app.services.sandbox_providers.factory import SandboxProviderFactory
from app.services.skill import SkillService
from app.services.user import UserService

logger = logging.getLogger(__name__)


def get_user_service() -> UserService:
    return UserService(session_factory=SessionLocal)


def get_refresh_token_service() -> RefreshTokenService:
    return RefreshTokenService(session_factory=SessionLocal)


def get_skill_service() -> SkillService:
    return SkillService(base_paths=SkillService.get_default_base_paths())


async def get_github_token(
    user: User | None = Depends(optional_current_active_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> str | None:
    if user is None:
        return None
    try:
        user_settings = await user_service.get_user_settings(user.id, db=db)
        token = user_settings.github_personal_access_token
        return token if token else None
    except UserException:
        return None


async def require_github_token(
    github_token: str | None = Depends(get_github_token),
) -> str:
    if not github_token:
        raise HTTPException(
            status_code=400,
            detail="GitHub personal access token not configured",
        )
    return github_token


def get_github_service(
    github_token: str = Depends(require_github_token),
) -> GitHubService:
    return GitHubService(token=github_token)


def get_agent_service() -> AgentService:
    return AgentService(session_factory=SessionLocal)


async def validate_sandbox_ownership(
    sandbox_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    query = select(Workspace.sandbox_id).where(
        Workspace.sandbox_id == sandbox_id,
        Workspace.user_id == current_user.id,
        Workspace.deleted_at.is_(None),
    )
    result = await db.execute(query)
    if not result.one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox not found",
        )
    return sandbox_id


async def get_sandbox_service(
    request: Request,
    user: User | None = Depends(optional_current_active_user),
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> AsyncIterator[SandboxService]:
    # Resolve the correct provider (Docker or Host) for this request: if a
    # sandbox_id is in the URL, look up which provider the workspace uses;
    # otherwise fall back to the user's configured default.
    provider_type = SandboxProviderType.DOCKER

    sandbox_id = request.path_params.get("sandbox_id")
    if sandbox_id:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        query = select(Workspace.sandbox_provider, Workspace.workspace_path).where(
            Workspace.sandbox_id == sandbox_id,
            Workspace.user_id == user.id,
            Workspace.deleted_at.is_(None),
        )
        result = await db.execute(query)
        row = result.one_or_none()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sandbox not found",
            )
        sandbox_provider = row.sandbox_provider
        sandbox_workspace_path = row.workspace_path
    else:
        sandbox_provider = None
        sandbox_workspace_path = None

    if user:
        try:
            user_settings = await user_service.get_user_settings(user.id, db=db)
            if user_settings.sandbox_provider:
                provider_type = SandboxProviderType(user_settings.sandbox_provider)
        except UserException as e:
            logger.warning("Failed to load user settings for sandbox: %s", e)

    if sandbox_provider:
        provider_type = SandboxProviderType(sandbox_provider)

    provider = SandboxProviderFactory.create_bound(
        provider_type=provider_type,
        sandbox_id=sandbox_id or "",
        workspace_path=sandbox_workspace_path,
    )
    try:
        yield SandboxService(provider)
    finally:
        await provider.cleanup()


async def get_workspace_service(
    sandbox_service: SandboxService = Depends(get_sandbox_service),
    user_service: UserService = Depends(get_user_service),
) -> WorkspaceService:
    return WorkspaceService(
        sandbox_service,
        user_service,
        session_factory=SessionLocal,
    )


def get_attachment_service() -> AttachmentService:
    return AttachmentService(
        message_service=MessageService(session_factory=SessionLocal)
    )


async def get_chat_service(
    user_service: UserService = Depends(get_user_service),
) -> AsyncIterator[ChatService]:
    yield ChatService(
        user_service,
        session_factory=SessionLocal,
    )
