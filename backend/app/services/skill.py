import base64
import json
import logging
import re
import shutil
import stat as stat_module
import tempfile
from pathlib import Path

from app.constants import (
    CLAUDE_DIR,
    CLAUDE_SKILLS_DIR,
    CODEX_SKILLS_DIR,
    SANDBOX_CLAUDE_DIR,
    SANDBOX_CODEX_DIR,
)
from app.models.types import (
    CustomSkillDict,
    EnabledResourceInfo,
    YamlMetadata,
)
from app.utils.yaml_parser import YAMLParser

logger = logging.getLogger(__name__)

SKILL_SANDBOX_DIRS = (SANDBOX_CLAUDE_DIR, SANDBOX_CODEX_DIR)
SKILL_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-_]*$")


class SkillService:
    def __init__(
        self,
        base_paths: tuple[Path, ...],
    ) -> None:
        self.skills_base_paths = base_paths

    @staticmethod
    def get_default_base_paths() -> tuple[Path, ...]:
        return (
            CLAUDE_SKILLS_DIR,
            CODEX_SKILLS_DIR,
            *SkillService._get_plugin_skill_paths(),
        )

    @staticmethod
    def _get_plugin_skill_paths() -> list[Path]:
        # Cross-reference settings.json (enabled flags) with installed_plugins.json
        # (install paths) to avoid walking the entire plugin cache directory tree.
        plugins_dir = CLAUDE_DIR / "plugins"
        settings_path = CLAUDE_DIR / "settings.json"
        installed_path = plugins_dir / "installed_plugins.json"
        if not settings_path.is_file() or not installed_path.is_file():
            return []
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            installed = json.loads(installed_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            return []
        enabled_plugins = settings.get("enabledPlugins", {})
        # Plugin IDs use the format "plugin-name@marketplace"
        enabled_ids = {
            pid for pid, enabled in enabled_plugins.items() if enabled is True
        }
        if not enabled_ids:
            return []
        paths: list[Path] = []
        for plugin_id, installs in installed.get("plugins", {}).items():
            if plugin_id not in enabled_ids:
                continue
            for entry in installs:
                install_path = entry.get("installPath")
                if not install_path:
                    continue
                skills_dir = Path(install_path) / "skills"
                if skills_dir.is_dir():
                    paths.append(skills_dir)
        return paths

    @staticmethod
    def _get_skill_source(base_path: Path) -> str:
        return "codex" if base_path.parent.name == ".codex" else "claude"

    @staticmethod
    def _find_skill_md(skill_dir: Path) -> Path | None:
        # Skills follow the CLI's canonical filename; lowercase variants are not supported.
        skill_md = skill_dir / "SKILL.md"
        if skill_md.exists():
            return skill_md
        return None

    @staticmethod
    def _compute_dir_stats(directory: Path) -> tuple[int, int]:
        file_count = 0
        total_size = 0
        for f in directory.rglob("*"):
            try:
                st = f.stat()
            except OSError:
                continue
            if stat_module.S_ISREG(st.st_mode):
                file_count += 1
                total_size += st.st_size
        return file_count, total_size

    @staticmethod
    def validate_exact_sanitized_name(name: str) -> None:
        if not SKILL_NAME_RE.fullmatch(name):
            raise ValueError("Invalid skill name format")

    @staticmethod
    def _parse_skill_metadata(content: str) -> YamlMetadata:
        metadata = YAMLParser.parse(content)
        name = metadata.get("name")
        description = metadata.get("description")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("YAML frontmatter must include 'name'")
        if not isinstance(description, str):
            raise ValueError("YAML frontmatter must include 'description'")
        return metadata

    def _validate_skill_dir(self, skill_dir: Path) -> tuple[YamlMetadata, int, int]:
        skill_md = self._find_skill_md(skill_dir)
        if not skill_md:
            raise ValueError("Skill directory must contain a SKILL.md file")
        try:
            skill_content = skill_md.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            raise ValueError("SKILL.md must be valid UTF-8 text") from exc
        metadata = self._parse_skill_metadata(skill_content)
        file_count, total_size = self._compute_dir_stats(skill_dir)
        return metadata, file_count, total_size

    def _find_skill_dir(self, skill_name: str) -> Path | None:
        for base_path in self.skills_base_paths:
            skill_dir = base_path / skill_name
            if skill_dir.is_dir() and self._find_skill_md(skill_dir):
                return skill_dir
        return None

    def list_all(self) -> list[CustomSkillDict]:
        skills: list[CustomSkillDict] = []
        seen_skill_names: set[str] = set()
        for base_path in self.skills_base_paths:
            if not base_path.is_dir():
                continue
            for entry in base_path.iterdir():
                if not entry.is_dir() or entry.name in seen_skill_names:
                    continue
                skill_md = self._find_skill_md(entry)
                if not skill_md:
                    continue
                try:
                    content = skill_md.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                try:
                    metadata = YAMLParser.parse(content)
                except ValueError:
                    metadata = {}
                file_count, total_size = self._compute_dir_stats(entry)
                skills.append(
                    {
                        "name": entry.name,
                        "description": str(metadata.get("description", "")),
                        "size_bytes": total_size,
                        "file_count": file_count,
                        "source": self._get_skill_source(base_path),
                    }
                )
                seen_skill_names.add(entry.name)
        return skills

    def get_files(self, skill_name: str) -> list[dict[str, str | bool]]:
        skill_dir = self._find_skill_dir(skill_name)
        if skill_dir is None:
            raise FileNotFoundError(f"Skill '{skill_name}' not found")

        files: list[dict[str, str | bool]] = []
        for file_path in sorted(skill_dir.rglob("*")):
            if not file_path.is_file():
                continue
            rel_path = str(file_path.relative_to(skill_dir))
            try:
                content = file_path.read_text(encoding="utf-8")
                files.append({"path": rel_path, "content": content, "is_binary": False})
            except UnicodeDecodeError:
                encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
                files.append({"path": rel_path, "content": encoded, "is_binary": True})
        return files

    def update(
        self,
        skill_name: str,
        files: list[dict[str, str | bool]],
    ) -> CustomSkillDict:
        skill_dir = self._find_skill_dir(skill_name)
        if skill_dir is None:
            raise FileNotFoundError(f"Skill '{skill_name}' not found")

        with tempfile.TemporaryDirectory() as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str) / skill_name
            tmp_dir.mkdir()
            tmp_dir_resolved = tmp_dir.resolve()

            for entry in files:
                rel_path = str(entry["path"])
                dest = (tmp_dir / rel_path).resolve()
                if not dest.is_relative_to(tmp_dir_resolved):
                    raise ValueError(f"Invalid file path: {rel_path}")
                dest.parent.mkdir(parents=True, exist_ok=True)
                if bool(entry.get("is_binary")):
                    dest.write_bytes(base64.b64decode(str(entry["content"])))
                else:
                    dest.write_text(str(entry["content"]), encoding="utf-8")

            metadata, file_count, total_size = self._validate_skill_dir(tmp_dir)
            new_name = str(metadata.get("name", "")).strip()
            if new_name != skill_name:
                raise ValueError(
                    "Cannot rename a skill via edit. Keep the YAML name unchanged."
                )

            shutil.rmtree(skill_dir)
            shutil.copytree(tmp_dir, skill_dir)

        return {
            "name": skill_name,
            "description": str(metadata.get("description", "")),
            "size_bytes": total_size,
            "file_count": file_count,
            "source": self._get_skill_source(skill_dir.parent),
        }

    def get_all_skill_paths(self) -> list[EnabledResourceInfo]:
        resources: list[EnabledResourceInfo] = []
        seen_skill_names: set[str] = set()
        for base_path in self.skills_base_paths:
            if not base_path.is_dir():
                continue
            for entry in base_path.iterdir():
                if not entry.is_dir() or entry.name in seen_skill_names:
                    continue
                if not self._find_skill_md(entry):
                    continue
                resources.append({"name": entry.name, "path": str(entry)})
                seen_skill_names.add(entry.name)
        return resources

    @staticmethod
    def format_for_sandbox(
        skill_name: str,
        rel_path: str,
        file_bytes: bytes,
    ) -> list[tuple[str, bytes]]:
        return [
            (f"{sd}/skills/{skill_name}/{rel_path}", file_bytes)
            for sd in SKILL_SANDBOX_DIRS
        ]
