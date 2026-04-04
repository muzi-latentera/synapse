from pydantic import BaseModel, Field, field_validator


class UpdateFileRequest(BaseModel):
    file_path: str = Field(..., min_length=1)
    content: str

    @field_validator("file_path")
    @classmethod
    def normalize_file_path(cls, v: str) -> str:
        if not v.startswith("/"):
            return f"/{v.lstrip('/')}"
        return v


class UpdateFileResponse(BaseModel):
    success: bool
    message: str


class FileMetadata(BaseModel):
    path: str
    type: str
    size: int
    modified: float
    is_binary: bool | None = None


class SandboxFilesMetadataResponse(BaseModel):
    files: list[FileMetadata]


class FileContentResponse(BaseModel):
    content: str
    path: str
    type: str
    is_binary: bool


class AddSecretRequest(BaseModel):
    key: str = Field(..., min_length=1)
    value: str = Field(..., min_length=1)


class UpdateSecretRequest(BaseModel):
    value: str = Field(..., min_length=1)


class GitDiffResponse(BaseModel):
    diff: str
    has_changes: bool
    is_git_repo: bool
    error: str | None = None


class GitBranchesResponse(BaseModel):
    branches: list[str]
    current_branch: str
    is_git_repo: bool


class GitCheckoutRequest(BaseModel):
    branch: str = Field(..., min_length=1, max_length=256)
    cwd: str | None = None


class GitCheckoutResponse(BaseModel):
    success: bool
    current_branch: str
    error: str | None = None


class GitCreateBranchRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    base_branch: str | None = None
    cwd: str | None = None


class GitCreateBranchResponse(BaseModel):
    success: bool
    current_branch: str
    error: str | None = None


class GitCommitRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    cwd: str | None = None


class GitCommandResponse(BaseModel):
    success: bool
    output: str
    error: str | None = None


class GitRemoteUrlResponse(BaseModel):
    owner: str
    repo: str
    remote_url: str
