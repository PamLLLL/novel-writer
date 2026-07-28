import json
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import prompt_worldview

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_worldview_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在构建世界观..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

    settings_content = project.style_config.get("settings", {})
    user_prompt = prompt_worldview(
        genre=project.genre,
        concept=project.concept,
        settings_json=json.dumps(settings_content, ensure_ascii=False),
        characters_json=ctx["characters_json"],
        user_direction=user_direction,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=6144):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})
