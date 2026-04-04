from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.models.db_models.user import User
from app.models.schemas.ai_model import AIModelResponse
from app.services.model_registry import get_all_models, get_models_for_agent

router = APIRouter()


@router.get("/", response_model=list[AIModelResponse])
async def list_models(
    current_user: User = Depends(get_current_user),
    agent_kind: str | None = Query(None, max_length=32),
) -> list[AIModelResponse]:
    entries = get_models_for_agent(agent_kind) if agent_kind else get_all_models()
    return [
        AIModelResponse(
            model_id=m.model_id,
            name=m.name,
            agent_kind=m.agent_kind,
            context_window=m.context_window,
        )
        for m in entries
    ]
