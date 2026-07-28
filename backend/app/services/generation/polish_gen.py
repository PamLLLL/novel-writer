import json
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import (
    prompt_polish,
    prompt_quality_check,
)
from app.models import Chapter, Volume

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def polish_chapter_stream(
    db: AsyncSession, project_id: str, chapter_id: str,
    selected_text: str = "", user_direction: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在润色..."})
    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter or not chapter.content:
        yield sse_event("error", {"message": "章节不存在或无内容"})
        return

    from app.models.version import Version
    version = Version(chapter_id=chapter_id, content=chapter.content, operation_type="before_polish")
    db.add(version)
    await db.commit()

    user_prompt = prompt_polish(
        chapter_content=chapter.content,
        characters_json=ctx["characters_json"],
        selected_text=selected_text,
        user_direction=user_direction,
    )

    full_text = ""
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, max_tokens=16384):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    if selected_text and full_text:
        new_content = chapter.content.replace(selected_text, full_text, 1)
        chapter.content = new_content
    elif full_text:
        chapter.content = full_text
    chapter.word_count = len(chapter.content)
    await db.commit()

    yield sse_event("done", {"result": {"content": chapter.content, "word_count": chapter.word_count}})


async def generate_quality_check_stream(db: AsyncSession, project_id: str) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在进行全文质量检查..."})

    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    chapters = await db.execute(
        select(Chapter)
        .where(Chapter.project_id == project_id, Chapter.content != "")
        .order_by(Chapter.sort_order)
    )
    chapter_list = chapters.scalars().all()

    if not chapter_list:
        yield sse_event("error", {"message": "暂无已写章节，无法进行质量检查"})
        return

    full_text = "\n\n".join([f"## {c.title}\n\n{c.content}" for c in chapter_list])

    user_prompt = prompt_quality_check(
        full_text=full_text,
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
    )

    system_prompt = ctx["system_prompt"]
    full_response = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_response += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_response)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_response}})


async def apply_quality_fix_stream(
    db: AsyncSession, project_id: str, chapter_id: str,
    issue_description: str, suggestion: str, original_text: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在应用修改建议..."})

    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        yield sse_event("error", {"message": "章节不存在"})
        return

    if not chapter.content:
        yield sse_event("error", {"message": "章节暂无内容，无法修改"})
        return

    from app.models.version import Version
    version = Version(chapter_id=chapter_id, content=chapter.content, operation_type="before_fix")
    db.add(version)
    await db.commit()

    system_prompt = ctx["system_prompt"]
    user_prompt = f"""请根据以下质量检查建议，修改小说章节内容。

## 当前章节：{chapter.title}

## 发现的问题
{issue_description}

## 修改建议
{suggestion}

{"## 问题原文片段" + chr(10) + original_text if original_text else ""}

## 当前章节完整内容
{chapter.content}

## 修改要求
- 严格按照修改建议来修改，只改有问题的部分
- 保持其他内容不变，不要重写整章
- 修改后的内容要与上下文自然融合
- 保持原有的文风和叙事节奏

请直接输出修改后的完整章节内容，不要任何解释或标注。"""

    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=16384):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    chapter.content = full_text
    chapter.word_count = len(full_text)
    await db.commit()

    yield sse_event("done", {"result": {"content": full_text, "word_count": len(full_text)}})


async def generate_publish_materials_stream(
    db: AsyncSession, project_id: str, user_direction: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在分析小说全文，生成发布素材..."})
    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(
        select(Chapter).where(Chapter.volume_id.in_(
            select(Volume.id).where(Volume.project_id == project_id)
        )).order_by(Chapter.sort_order)
    )
    chapters = result.scalars().all()
    summaries = []
    for ch in chapters:
        if ch.summary:
            summaries.append(f"- {ch.title}: {ch.summary}")
    chapter_summaries = "\n".join(summaries[:60])

    from app.core.prompts.steps import prompt_publish_materials
    user_prompt = prompt_publish_materials(
        genre=ctx["project"].genre or "",
        concept=ctx["project"].concept or "",
        settings_json=json.dumps((ctx["project"].style_config or {}).get("settings", {}), ensure_ascii=False),
        outline_json=ctx["outline_json"],
        characters_json=ctx["characters_json"],
        chapter_summaries=chapter_summaries,
        platform=ctx["project"].target_platform or "",
        user_direction=user_direction,
    )

    full_text = ""
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, max_tokens=4096):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    from app.core.ai.json_parser import extract_json as extract_json_fn
    parsed = extract_json_fn(full_text)
    if parsed:
        style_config = ctx["project"].style_config or {}
        style_config["publish_materials"] = parsed
        ctx["project"].style_config = style_config
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(ctx["project"], "style_config")
        await db.commit()

    yield sse_event("done", {"result": parsed or {}})
