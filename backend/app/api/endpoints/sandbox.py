from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.deps import (
    get_git_service,
    get_sandbox_service,
    validate_sandbox_ownership,
)
from app.models.schemas.sandbox import (
    AddSecretRequest,
    FileContentResponse,
    FileMetadata,
    GitBranchesResponse,
    GitCheckoutRequest,
    GitCheckoutResponse,
    GitCommandResponse,
    GitCommitRequest,
    GitCreateBranchRequest,
    GitCreateBranchResponse,
    GitDiffResponse,
    GitRemoteUrlResponse,
    SandboxFilesMetadataResponse,
    UpdateFileRequest,
    UpdateFileResponse,
    UpdateSecretRequest,
)
from app.models.schemas.secrets import (
    MessageResponse,
    SecretResponse,
    SecretsListResponse,
)
from app.services.exceptions import SandboxException
from app.services.git import GitService
from app.services.sandbox import SandboxService
from app.utils.sandbox import normalize_sandbox_file_path


router = APIRouter()


@router.get(
    "/{sandbox_id}/files/metadata",
    response_model=SandboxFilesMetadataResponse,
)
async def get_files_metadata(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> SandboxFilesMetadataResponse:
    files = await sandbox_service.get_files_metadata(sandbox_id)
    return SandboxFilesMetadataResponse(files=[FileMetadata(**f) for f in files])


@router.get(
    "/{sandbox_id}/files/content/{file_path:path}", response_model=FileContentResponse
)
async def get_file_content(
    file_path: str,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> FileContentResponse:
    try:
        file_data = await sandbox_service.get_file_content(
            sandbox_id, normalize_sandbox_file_path(file_path)
        )
        return FileContentResponse(**file_data)
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/{sandbox_id}/files", response_model=UpdateFileResponse)
async def update_file_in_sandbox(
    request: UpdateFileRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> UpdateFileResponse:
    try:
        normalized_path = normalize_sandbox_file_path(request.file_path)
        await sandbox_service.provider.write_file(
            sandbox_id, normalized_path, request.content
        )
        return UpdateFileResponse(
            success=True, message=f"File {normalized_path} updated successfully"
        )
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{sandbox_id}/secrets", response_model=SecretsListResponse)
async def get_secrets(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> SecretsListResponse:
    try:
        secrets = await sandbox_service.get_secrets(sandbox_id)
        return SecretsListResponse(secrets=[SecretResponse(**s) for s in secrets])
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/secrets", response_model=MessageResponse)
async def add_secret(
    secret_data: AddSecretRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> MessageResponse:
    try:
        await sandbox_service.provider.add_secret(
            sandbox_id, secret_data.key, secret_data.value
        )
        return MessageResponse(message=f"Secret {secret_data.key} added successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{sandbox_id}/secrets/{key}", response_model=MessageResponse)
async def update_secret(
    key: str,
    secret_data: UpdateSecretRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> MessageResponse:
    try:
        await sandbox_service.update_secret(sandbox_id, key, secret_data.value)
        return MessageResponse(message=f"Secret {key} updated successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{sandbox_id}/secrets/{key}", response_model=MessageResponse)
async def delete_secret(
    key: str,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> MessageResponse:
    try:
        await sandbox_service.provider.delete_secret(sandbox_id, key)
        return MessageResponse(message=f"Secret {key} deleted successfully")
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{sandbox_id}/download-zip")
async def download_sandbox_files(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    sandbox_service: SandboxService = Depends(get_sandbox_service),
) -> Response:
    try:
        zip_bytes = await sandbox_service.generate_zip_download(sandbox_id)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="sandbox_{sandbox_id}.zip"'
            },
        )
    except SandboxException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{sandbox_id}/git/diff", response_model=GitDiffResponse)
async def get_git_diff(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
    mode: Literal["all", "staged", "unstaged", "branch"] = Query("all"),
    full_context: bool = Query(False),
    cwd: str | None = Query(None),
) -> GitDiffResponse:
    try:
        return await git_service.get_diff(sandbox_id, mode, full_context, cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{sandbox_id}/git/branches", response_model=GitBranchesResponse)
async def get_git_branches(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
    cwd: str | None = Query(None),
) -> GitBranchesResponse:
    try:
        return await git_service.get_branches(sandbox_id, cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/git/checkout", response_model=GitCheckoutResponse)
async def checkout_git_branch(
    request: GitCheckoutRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
) -> GitCheckoutResponse:
    try:
        return await git_service.checkout(sandbox_id, request.branch, request.cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/git/push", response_model=GitCommandResponse)
async def git_push(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
    cwd: str | None = Query(None),
) -> GitCommandResponse:
    try:
        return await git_service.push(sandbox_id, cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/git/pull", response_model=GitCommandResponse)
async def git_pull(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
    cwd: str | None = Query(None),
) -> GitCommandResponse:
    try:
        return await git_service.pull(sandbox_id, cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/git/commit", response_model=GitCommandResponse)
async def git_commit(
    request: GitCommitRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
) -> GitCommandResponse:
    try:
        return await git_service.commit(sandbox_id, request.message, request.cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{sandbox_id}/git/create-branch", response_model=GitCreateBranchResponse)
async def create_git_branch(
    request: GitCreateBranchRequest,
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
) -> GitCreateBranchResponse:
    try:
        return await git_service.create_branch(
            sandbox_id, request.name, request.base_branch, request.cwd
        )
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{sandbox_id}/git/remote-url", response_model=GitRemoteUrlResponse)
async def get_git_remote_url(
    sandbox_id: str = Depends(validate_sandbox_ownership),
    git_service: GitService = Depends(get_git_service),
    cwd: str | None = Query(None),
) -> GitRemoteUrlResponse:
    try:
        return await git_service.get_remote_url(sandbox_id, cwd)
    except (ValueError, SandboxException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
