from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.services import knowledge_service

router = APIRouter()


@router.get("/{project_id}")
async def get_knowledge_graph(project_id: str, db: AsyncSession = Depends(get_db)):
    return await knowledge_service.get_knowledge_graph(db, project_id)


@router.post("/{project_id}/build")
async def build_knowledge_graph(project_id: str, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        knowledge_service.build_knowledge_graph_stream(db, project_id),
        media_type="text/event-stream",
    )


class CascadeRequest(BaseModel):
    chapter_id: str


@router.post("/{project_id}/cascade-analysis")
async def cascade_analysis(project_id: str, req: CascadeRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        knowledge_service.cascade_analysis_stream(db, project_id, req.chapter_id),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/update-state/{chapter_id}")
async def update_narrative_state(
    project_id: str, chapter_id: str, db: AsyncSession = Depends(get_db)
):
    return StreamingResponse(
        knowledge_service.update_narrative_state_stream(db, project_id, chapter_id),
        media_type="text/event-stream",
    )


class UpstreamCascadeRequest(BaseModel):
    change_type: str
    change_summary: str = ""


@router.post("/{project_id}/upstream-cascade")
async def upstream_cascade(
    project_id: str, req: UpstreamCascadeRequest, db: AsyncSession = Depends(get_db)
):
    return StreamingResponse(
        knowledge_service.cascade_analysis_upstream_stream(
            db, project_id, req.change_type, req.change_summary
        ),
        media_type="text/event-stream",
    )
