from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_claude_agent_service, get_github_service
from app.core.security import get_current_user
from app.models.db_models.user import User
from app.models.schemas.github import (
    CreatePullRequestRequest,
    CreatePullRequestResponse,
    GenerateCommitMessageRequest,
    GenerateCommitMessageResponse,
    GeneratePRDescriptionRequest,
    GeneratePRDescriptionResponse,
    GitHubCollaborator,
    GitHubPRCommentsResponse,
    GitHubPRListResponse,
    GitHubReposResponse,
)
from app.services.claude_agent import ClaudeAgentService
from app.services.exceptions import ClaudeAgentException, GitHubException
from app.services.github import GitHubService
from app.utils.validators import APIKeyValidationError

router = APIRouter()


def _raise_from_github(exc: GitHubException) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/repositories", response_model=GitHubReposResponse)
async def list_repositories(
    q: str = Query(default="", max_length=256),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    _current_user: User = Depends(get_current_user),
    github: GitHubService = Depends(get_github_service),
) -> GitHubReposResponse:
    try:
        return await github.list_repositories(q, page, per_page)
    except GitHubException as exc:
        _raise_from_github(exc)


@router.get("/pulls", response_model=GitHubPRListResponse)
async def list_pull_requests(
    owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1),
    _current_user: User = Depends(get_current_user),
    github: GitHubService = Depends(get_github_service),
) -> GitHubPRListResponse:
    try:
        return await github.list_pull_requests(owner, repo)
    except GitHubException as exc:
        _raise_from_github(exc)


@router.get(
    "/pulls/{owner}/{repo}/{number}/comments",
    response_model=GitHubPRCommentsResponse,
)
async def get_pr_comments(
    owner: str,
    repo: str,
    number: int,
    _current_user: User = Depends(get_current_user),
    github: GitHubService = Depends(get_github_service),
) -> GitHubPRCommentsResponse:
    try:
        return await github.get_pr_comments(owner, repo, number)
    except GitHubException as exc:
        _raise_from_github(exc)


@router.post("/pulls", response_model=CreatePullRequestResponse)
async def create_pull_request(
    request: CreatePullRequestRequest,
    _current_user: User = Depends(get_current_user),
    github: GitHubService = Depends(get_github_service),
) -> CreatePullRequestResponse:
    try:
        return await github.create_pull_request(request)
    except GitHubException as exc:
        _raise_from_github(exc)


@router.post(
    "/generate-pr-description",
    response_model=GeneratePRDescriptionResponse,
)
async def generate_pr_description(
    request: GeneratePRDescriptionRequest,
    current_user: User = Depends(get_current_user),
    ai_service: ClaudeAgentService = Depends(get_claude_agent_service),
) -> GeneratePRDescriptionResponse:
    try:
        description = await ai_service.generate_pr_description(
            request.title, request.diff, request.model_id, current_user
        )
    except APIKeyValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except ClaudeAgentException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    return GeneratePRDescriptionResponse(description=description)


@router.post(
    "/generate-commit-message",
    response_model=GenerateCommitMessageResponse,
)
async def generate_commit_message(
    request: GenerateCommitMessageRequest,
    current_user: User = Depends(get_current_user),
    ai_service: ClaudeAgentService = Depends(get_claude_agent_service),
) -> GenerateCommitMessageResponse:
    try:
        message = await ai_service.generate_commit_message(
            request.diff, request.model_id, current_user
        )
    except APIKeyValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except ClaudeAgentException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    return GenerateCommitMessageResponse(message=message)


@router.get("/collaborators")
async def list_collaborators(
    owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1),
    _current_user: User = Depends(get_current_user),
    github: GitHubService = Depends(get_github_service),
) -> list[GitHubCollaborator]:
    try:
        return await github.list_collaborators(owner, repo)
    except GitHubException as exc:
        _raise_from_github(exc)
