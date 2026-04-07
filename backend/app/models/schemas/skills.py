from pydantic import BaseModel, Field


class SkillFileEntry(BaseModel):
    path: str = Field(..., max_length=4096)
    content: str
    is_binary: bool = False


class SkillFilesResponse(BaseModel):
    name: str
    files: list[SkillFileEntry]


class SkillUpdateRequest(BaseModel):
    files: list[SkillFileEntry]
