import re
from typing import cast

import yaml

from app.models.types import YamlMetadata

YAML_FIELD_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*:\s*")
KNOWN_YAML_FIELDS = {
    "name",
    "description",
}


class YAMLParser:
    @staticmethod
    def _is_already_quoted(value: str) -> bool:
        return (
            value.startswith('"')
            or value.startswith("'")
            or value.startswith("|")
            or value.startswith(">")
        )

    @staticmethod
    def _is_real_yaml_field(line: str) -> bool:
        if not line or line[0].isspace():
            return False
        if not YAML_FIELD_PATTERN.match(line):
            return False

        field_name, _, _ = line.partition(":")
        return field_name.strip() in KNOWN_YAML_FIELDS

    @staticmethod
    def _normalize(content: str) -> str:
        lines = content.split("\n")

        if not lines or lines[0].strip() != "---":
            return content

        yaml_end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                yaml_end = i
                break

        if yaml_end is None:
            return content

        yaml_lines = lines[1:yaml_end]
        normalized_lines = [lines[0]]

        i = 0
        while i < len(yaml_lines):
            line = yaml_lines[i]

            if re.match(r"^(description|name):\s*", line):
                field_name = line.split(":", 1)[0]
                value_part = line.split(":", 1)[1].strip() if ":" in line else ""

                if YAMLParser._is_already_quoted(value_part):
                    normalized_lines.append(line)
                    i += 1
                    continue

                continuation_lines: list[str] = []
                j = i + 1
                while j < len(yaml_lines):
                    next_line = yaml_lines[j]
                    if YAMLParser._is_real_yaml_field(next_line):
                        break
                    continuation_lines.append(next_line)
                    j += 1

                if continuation_lines:
                    normalized_lines.append(f"{field_name}: |-")
                    if value_part:
                        normalized_lines.append(f"  {value_part}")
                    for cont_line in continuation_lines:
                        normalized_lines.append(f"  {cont_line.rstrip()}")
                    i = j
                else:
                    if value_part and (":" in value_part or "<" in value_part):
                        value_part = value_part.replace('"', '\\"')
                        line = f'{field_name}: "{value_part}"'
                    normalized_lines.append(line)
                    i += 1
            else:
                normalized_lines.append(line)
                i += 1

        normalized_lines.extend(lines[yaml_end:])
        return "\n".join(normalized_lines)

    @staticmethod
    def parse(content: str) -> YamlMetadata:
        lines = content.split("\n")

        if not lines or lines[0].strip() != "---":
            raise ValueError("Content must start with YAML frontmatter (---)")

        yaml_end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "---":
                yaml_end = i
                break

        if yaml_end is None:
            raise ValueError("YAML frontmatter must end with ---")

        normalized_content = YAMLParser._normalize(content)
        normalized_lines = normalized_content.split("\n")

        normalized_yaml_end = None
        for i, line in enumerate(normalized_lines[1:], start=1):
            if line.strip() == "---":
                normalized_yaml_end = i
                break

        if normalized_yaml_end is None:
            raise ValueError("YAML frontmatter must end with ---")

        yaml_content = "\n".join(normalized_lines[1:normalized_yaml_end])

        try:
            metadata = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML frontmatter: {e}")

        if not isinstance(metadata, dict):
            raise ValueError("YAML frontmatter must be a dictionary")

        return cast(YamlMetadata, metadata)
