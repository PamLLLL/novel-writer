from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.project import Project
from app.services.generation_service import generate_publish_materials_stream

router = APIRouter()


class GenerateRequest(BaseModel):
    user_direction: str = ""


class SaveMaterialsRequest(BaseModel):
    data: dict


@router.post("/{project_id}/generate-materials")
async def generate_materials(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generate_publish_materials_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


@router.get("/{project_id}/materials")
async def get_materials(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return (project.style_config or {}).get("publish_materials", {})


@router.put("/{project_id}/materials")
async def save_materials(project_id: str, req: SaveMaterialsRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    style_config = project.style_config or {}
    style_config["publish_materials"] = req.data
    project.style_config = style_config
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(project, "style_config")
    await db.commit()
    return {"status": "ok"}
