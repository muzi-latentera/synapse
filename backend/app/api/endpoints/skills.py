from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_skill_service
from app.core.security import get_current_user
from app.models.db_models.user import User
from app.models.schemas.skills import SkillFilesResponse, SkillUpdateRequest
from app.models.types import CustomSkillDict
from app.services.skill import SkillService

router = APIRouter()


@router.get("", response_model=list[CustomSkillDict])
async def list_skills(
    current_user: User = Depends(get_current_user),
    skill_service: SkillService = Depends(get_skill_service),
) -> list[CustomSkillDict]:
    return skill_service.list_all()


@router.get("/{skill_name}/files", response_model=SkillFilesResponse)
async def get_skill_files(
    skill_name: str,
    current_user: User = Depends(get_current_user),
    skill_service: SkillService = Depends(get_skill_service),
) -> SkillFilesResponse:
    try:
        skill_service.validate_exact_sanitized_name(skill_name)
        files = skill_service.get_files(skill_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SkillFilesResponse(name=skill_name, files=files)


@router.put("/{skill_name}", response_model=CustomSkillDict)
async def update_skill(
    skill_name: str,
    request: SkillUpdateRequest,
    current_user: User = Depends(get_current_user),
    skill_service: SkillService = Depends(get_skill_service),
) -> CustomSkillDict:
    try:
        skill_service.validate_exact_sanitized_name(skill_name)
        files_data: list[dict[str, str | bool]] = [
            {"path": file.path, "content": file.content, "is_binary": file.is_binary}
            for file in request.files
        ]
        return skill_service.update(skill_name, files_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
