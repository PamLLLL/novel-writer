from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import prompt_settings

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_settings_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在分析创意，生成基础设定..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

    user_prompt = prompt_settings(
        genre=project.genre,
        concept=project.concept,
        target_words=project.target_words,
        platform=project.target_platform,
    )
    if user_direction:
        user_prompt += f"\n\n用户特别要求：{user_direction}"

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=4096):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})
