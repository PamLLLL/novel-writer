import json
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.ai.registry import get_provider
from app.core.prompts.base import build_system_prompt
from app.core.style.compiler import compile_style, get_platform_rules
from app.models import Chapter, GlobalSettings, Outline, Project, Volume, Worldview
from app.models.character import Character


async def get_provider_from_settings(db: AsyncSession):
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        raise ValueError("请先在设置页面配置 AI 模型和 API Key")
    provider_name = settings.default_provider
    api_keys = settings.api_keys or {}
    config = api_keys.get(provider_name, {})
    key = config.get("key", "")
    model = config.get("default_model", "")
    if not key:
        raise ValueError(f"请先在设置页面配置 {provider_name} 的 API Key")
    return get_provider(provider_name, api_key=key, model=model or None)


async def get_project_context(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")

    result = await db.execute(select(Character).where(Character.project_id == project_id))
    characters = result.scalars().all()

    result = await db.execute(select(Worldview).where(Worldview.project_id == project_id))
    worldview = result.scalar_one_or_none()

    result = await db.execute(select(Outline).where(Outline.project_id == project_id))
    outline = result.scalar_one_or_none()

    result = await db.execute(
        select(Volume).where(Volume.project_id == project_id).order_by(Volume.sort_order)
    )
    volumes = result.scalars().all()

    chars_data = [
        {"name": c.name, "role": c.role, "personality": c.personality, "background": c.background}
        for c in characters
    ]

    return {
        "project": project,
        "characters": characters,
        "characters_json": json.dumps(chars_data, ensure_ascii=False),
        "worldview": worldview,
        "worldview_json": json.dumps(worldview.content if worldview else {}, ensure_ascii=False),
        "outline": outline,
        "outline_json": json.dumps(outline.content if outline else {}, ensure_ascii=False),
        "volumes": volumes,
        "system_prompt": build_system_prompt(
            style_instruction=compile_style(project.style_config or {}),
            platform_rules=get_platform_rules(project.target_platform or ""),
            reference_texts=(project.style_config or {}).get("reference_texts"),
        ),
    }


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
