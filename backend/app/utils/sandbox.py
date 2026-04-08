import re

from app.constants import SANDBOX_HOME_DIR, SANDBOX_WORKSPACE_DIR

# Try workspace dir first (Docker mounts), fall back to home dir (host sandboxes)
GIT_CD_PREFIX = f"cd {SANDBOX_WORKSPACE_DIR} 2>/dev/null || cd {SANDBOX_HOME_DIR}; "
# Guard against shell injection in branch names and cwd paths passed to exec
BRANCH_NAME_RE = re.compile(r"^[\w./-]+$")
CWD_PATH_RE = re.compile(r"^/[a-zA-Z0-9/_.\- ]+$")


def normalize_sandbox_file_path(file_path: str) -> str:
    # FastAPI captures the path param with a leading slash; strip it to make
    # it relative to the sandbox home dir — but keep absolute paths that
    # already point inside SANDBOX_HOME_DIR (e.g. /home/user/workspace/...).
    if file_path.startswith("/") and not file_path.startswith(SANDBOX_HOME_DIR):
        return file_path.lstrip("/")
    return file_path


def git_cd_prefix(cwd: str | None = None) -> str:
    if not cwd:
        return GIT_CD_PREFIX
    if not CWD_PATH_RE.match(cwd):
        raise ValueError("Invalid cwd path")
    return f"cd '{cwd}' && "
