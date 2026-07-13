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
