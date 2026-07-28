from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.style.presets import STYLE_PRESETS, PLATFORM_RULES
from app.core.style.compiler import compile_style
from app.models import Project

router = APIRouter()


@router.get("/presets")
async def get_presets():
    return [{"id": k, **v} for k, v in STYLE_PRESETS.items()]


@router.get("/platforms")
async def get_platforms():
    return [{"name": k, **v} for k, v in PLATFORM_RULES.items()]


@router.get("/{project_id}")
async def get_project_style(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {}
    return project.style_config or {}


class SaveStyleRequest(BaseModel):
    style_config: dict


@router.put("/{project_id}")
async def save_project_style(project_id: str, req: SaveStyleRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {"status": "error", "message": "Project not found"}
    from sqlalchemy.orm.attributes import flag_modified
    config = dict(project.style_config or {})
    config.update(req.style_config)
    project.style_config = config
    flag_modified(project, "style_config")
    await db.commit()
    return {"status": "ok"}


@router.post("/{project_id}/preview")
async def preview_style(project_id: str, db: AsyncSession = Depends(get_db)):
    from app.services.generation.helpers import get_provider_from_settings, get_project_context, sse_event
    from app.core.prompts.base import build_system_prompt

    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)
    project = ctx["project"]

    async def stream():
        yield sse_event("progress", {"message": "正在生成风格预览..."})

        system_prompt = ctx["system_prompt"]
        user_prompt = f"""请用当前设定的写作风格，写一段500字左右的小说片段作为风格预览。

小说类型：{project.genre}
核心创意：{project.concept}

要求：
- 充分展现当前风格的特点
- 包含场景描写、人物对话、内心活动
- 让用户能直观感受到这种风格的效果

直接输出小说片段，不要任何解释。"""

        full_text = ""
        async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=2048):
            full_text += chunk
            yield sse_event("content", {"text": chunk})
        yield sse_event("done", {"result": {"preview": full_text}})

    return StreamingResponse(stream(), media_type="text/event-stream")
