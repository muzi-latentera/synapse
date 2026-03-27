import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import require_github_token
from app.core.security import get_current_user
from app.models.db_models.user import User
from app.models.schemas.github import (
    CreatePullRequestRequest,
    CreatePullRequestResponse,
    GitHubCollaborator,
    GitHubPRCommentsResponse,
    GitHubPRListResponse,
    GitHubPullRequest,
    GitHubRepo,
    GitHubReposResponse,
    GitHubReviewComment,
)

router = APIRouter()
logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


def _github_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _check_github_response(response: httpx.Response) -> None:
    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token is invalid or expired",
        )
    if response.status_code != 200:
        logger.warning(
            "GitHub API returned %d: %s", response.status_code, response.text[:200]
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub API request failed",
        )


@router.get("/repositories", response_model=GitHubReposResponse)
async def list_repositories(
    q: str = Query(default="", max_length=256),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    _current_user: User = Depends(get_current_user),
    github_token: str = Depends(require_github_token),
) -> GitHubReposResponse:
    headers = _github_headers(github_token)

    async with httpx.AsyncClient(timeout=10.0) as client:
        if q.strip():
            response = await client.get(
                f"{GITHUB_API_BASE}/search/repositories",
                params={
                    "q": q.strip(),
                    "sort": "updated",
                    "order": "desc",
                    "per_page": per_page,
                    "page": page,
                },
                headers=headers,
            )
        else:
            response = await client.get(
                f"{GITHUB_API_BASE}/user/repos",
                params={
                    "sort": "pushed",
                    "direction": "desc",
                    "per_page": per_page,
                    "page": page,
                    "affiliation": "owner,collaborator,organization_member",
                },
                headers=headers,
            )

    _check_github_response(response)

    data = response.json()
    raw_repos = data.get("items", data) if isinstance(data, dict) else data

    repos = [
        GitHubRepo(
            name=r["name"],
            full_name=r["full_name"],
            description=r.get("description"),
            language=r.get("language"),
            html_url=r["html_url"],
            clone_url=r["clone_url"],
            private=r.get("private", False),
            pushed_at=r.get("pushed_at"),
            stargazers_count=r.get("stargazers_count", 0),
        )
        for r in raw_repos
    ]

    return GitHubReposResponse(items=repos, has_more=len(raw_repos) == per_page)


@router.get("/pulls", response_model=GitHubPRListResponse)
async def list_pull_requests(
    owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1),
    _current_user: User = Depends(get_current_user),
    github_token: str = Depends(require_github_token),
) -> GitHubPRListResponse:
    headers = _github_headers(github_token)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls",
            params={
                "state": "open",
                "per_page": 30,
                "sort": "updated",
                "direction": "desc",
            },
            headers=headers,
        )

    _check_github_response(response)

    raw_prs = response.json()
    prs = [
        GitHubPullRequest(
            number=pr["number"],
            title=pr["title"],
            body=pr.get("body"),
            state=pr["state"],
            html_url=pr["html_url"],
            head={
                "ref": pr["head"]["ref"],
                "repo": {
                    "full_name": pr["head"]["repo"]["full_name"]
                    if pr["head"].get("repo")
                    else ""
                },
            },
            base={"ref": pr["base"]["ref"]},
            user={
                "login": pr["user"]["login"],
                "avatar_url": pr["user"].get("avatar_url", ""),
            },
            draft=pr.get("draft", False),
            review_comments=pr.get("review_comments", 0),
        )
        for pr in raw_prs
    ]

    return GitHubPRListResponse(items=prs)


@router.get(
    "/pulls/{owner}/{repo}/{number}/comments",
    response_model=GitHubPRCommentsResponse,
)
async def get_pr_comments(
    owner: str,
    repo: str,
    number: int,
    _current_user: User = Depends(get_current_user),
    github_token: str = Depends(require_github_token),
) -> GitHubPRCommentsResponse:
    headers = _github_headers(github_token)
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{number}/comments"
    raw_comments: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        page = 1
        while page <= 10:
            response = await client.get(
                url,
                params={"per_page": 100, "page": page},
                headers=headers,
            )
            _check_github_response(response)
            batch = response.json()
            raw_comments.extend(batch)
            if len(batch) < 100:
                break
            page += 1

    comments = [
        GitHubReviewComment(
            id=c["id"],
            body=c["body"],
            path=c.get("path"),
            line=c.get("line") or c.get("original_line"),
            user={
                "login": c["user"]["login"],
                "avatar_url": c["user"].get("avatar_url", ""),
            },
            created_at=c["created_at"],
        )
        for c in raw_comments
    ]

    return GitHubPRCommentsResponse(comments=comments)


@router.post("/pulls", response_model=CreatePullRequestResponse)
async def create_pull_request(
    request: CreatePullRequestRequest,
    _current_user: User = Depends(get_current_user),
    github_token: str = Depends(require_github_token),
) -> CreatePullRequestResponse:
    headers = _github_headers(github_token)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{GITHUB_API_BASE}/repos/{request.owner}/{request.repo}/pulls",
            json={
                "title": request.title,
                "body": request.body,
                "head": request.head,
                "base": request.base,
            },
            headers=headers,
        )

        if response.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token is invalid or expired",
            )
        if response.status_code not in (200, 201):
            logger.warning(
                "GitHub API returned %d: %s",
                response.status_code,
                response.text[:200],
            )
            try:
                detail = response.json().get("message", "Failed to create pull request")
            except (ValueError, KeyError):
                detail = "Failed to create pull request"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            )

        pr_data = response.json()

        reviewer_warning = None
        if request.reviewers:
            try:
                reviewer_resp = await client.post(
                    f"{GITHUB_API_BASE}/repos/{request.owner}/{request.repo}/pulls/{pr_data['number']}/requested_reviewers",
                    json={"reviewers": request.reviewers},
                    headers=headers,
                )
                if reviewer_resp.status_code not in (200, 201):
                    reviewer_warning = "Failed to assign reviewers"
                    logger.warning(
                        "Failed to assign reviewers to PR #%d: %s",
                        pr_data["number"],
                        reviewer_resp.text[:200],
                    )
            except httpx.HTTPError:
                reviewer_warning = "Failed to assign reviewers"
                logger.warning(
                    "Failed to assign reviewers to PR #%d", pr_data["number"]
                )

    return CreatePullRequestResponse(
        number=pr_data["number"],
        html_url=pr_data["html_url"],
        title=pr_data["title"],
        reviewer_warning=reviewer_warning,
    )


@router.get("/collaborators")
async def list_collaborators(
    owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1),
    _current_user: User = Depends(get_current_user),
    github_token: str = Depends(require_github_token),
) -> list[GitHubCollaborator]:
    headers = _github_headers(github_token)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/collaborators",
            params={"per_page": 50},
            headers=headers,
        )

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token is invalid or expired",
        )
    # 403/404 are expected when user lacks push access to the repo
    if response.status_code in (403, 404):
        return []
    if response.status_code != 200:
        logger.warning(
            "GitHub collaborators API returned %d: %s",
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to load collaborators",
        )

    return [
        GitHubCollaborator(login=c["login"], avatar_url=c.get("avatar_url", ""))
        for c in response.json()
    ]
