from uuid import UUID

ATTACHMENTS_PREFIX = "/api/v1/attachments"


class AttachmentURL:
    @staticmethod
    def build_preview_url(attachment_id: UUID | str) -> str:
        return f"{ATTACHMENTS_PREFIX}/{attachment_id}/preview"

    @staticmethod
    def build_temp_preview_url(path: str) -> str:
        return f"{ATTACHMENTS_PREFIX}/temp/preview?path={path}"
