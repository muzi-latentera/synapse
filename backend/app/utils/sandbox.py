import re

# Guard against shell injection in branch names and workspace-relative cwd
# paths passed to exec.
BRANCH_NAME_RE = re.compile(r"^[\w./-]+$")


def normalize_relative_path(path: str | None) -> str:
    # Empty / None / "." / "./" all mean the workspace root. Rejecting absolute
    # paths, `..` escapes, and quote/control characters protects the
    # single-quoted `cd` prefix built in git_cd_prefix from breaking out while
    # still allowing normal repo filenames like @scoped packages or names with
    # punctuation.
    if path is None:
        return ""
    if path.startswith("/"):
        raise ValueError(f"Path must be workspace-relative, got absolute: {path}")
    path = path.removeprefix("./")
    if path in ("", "."):
        return ""
    if any(c in path for c in "\x00\n\r'") or ".." in path.split("/"):
        raise ValueError(f"Invalid relative path: {path}")
    return path


def git_cd_prefix(cwd: str | None = None) -> str:
    # Providers exec from the workspace root, so an empty/root cwd needs no cd.
    rel = normalize_relative_path(cwd)
    if not rel:
        return ""
    return f"cd '{rel}' && "
