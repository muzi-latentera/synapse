from app.models.types import CustomAgentDict, YamlMetadata
from app.services.resource import BaseMarkdownResourceService
from app.services.exceptions import AgentException


class AgentService(BaseMarkdownResourceService[CustomAgentDict]):
    resource_type = "Agent"
    exception_class = AgentException

    def _get_storage_folder(self) -> str:
        return "agents"

    def _validate_additional_fields(self, metadata: YamlMetadata) -> None:
        pass

    def _build_response(
        self, name: str, metadata: YamlMetadata, content: str
    ) -> CustomAgentDict:
        return {
            "name": name,
            "description": metadata.get("description", ""),
            "content": content,
            "allowed_tools": metadata.get("allowed_tools"),
        }
