import json
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import (
    prompt_chapter_outlines,
    prompt_detailed_outline,
    prompt_volumes,
)
from app.models import Chapter, Volume

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_volumes_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在规划分卷结构..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

    settings_content = project.style_config.get("settings", {})
    user_prompt = prompt_volumes(
        genre=project.genre,
        concept=project.concept,
        outline_json=ctx["outline_json"],
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
        settings_json=json.dumps(settings_content, ensure_ascii=False),
        target_words=project.target_words,
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


async def generate_chapter_outlines_stream(
    db: AsyncSession, project_id: str, volume_id: str, user_direction: str = "",
    chapter_word_target: int = 0
) -> AsyncIterator[str]:
    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Volume).where(Volume.id == volume_id))
    volume = result.scalar_one_or_none()
    if not volume:
        yield sse_event("error", {"message": "分卷不存在"})
        return

    yield sse_event("progress", {"message": f"正在为「{volume.title}」生成章节大纲..."})

    all_volumes = ctx["volumes"]
    word_target = chapter_word_target if chapter_word_target > 0 else ctx["project"].target_words // max(1, len(all_volumes))
    all_volumes_info = json.dumps(
        [{"title": v.title, "summary": v.summary, "is_current": v.id == volume_id} for v in all_volumes],
        ensure_ascii=False
    )

    start_chapter_num = 1
    for v in all_volumes:
        if v.id == volume_id:
            break
        prev_chapters = await db.execute(
            select(Chapter).where(Chapter.volume_id == v.id, Chapter.project_id == project_id)
        )
        start_chapter_num += len(prev_chapters.scalars().all())

    user_prompt = prompt_chapter_outlines(
        genre=ctx["project"].genre,
        volume_title=volume.title,
        volume_summary=volume.summary,
        outline_json=ctx["outline_json"],
        characters_json=ctx["characters_json"],
        volume_word_target=word_target,
        all_volumes_json=all_volumes_info,
        user_direction=user_direction,
        start_chapter_num=start_chapter_num,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})


async def generate_detailed_outline_stream(
    db: AsyncSession, project_id: str, chapter_id: str, user_direction: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在生成场景细纲..."})

    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        yield sse_event("error", {"message": "章节不存在"})
        return

    all_chapters = await db.execute(
        select(Chapter)
        .join(Volume, Chapter.volume_id == Volume.id)
        .where(Chapter.project_id == project_id)
        .order_by(Volume.sort_order, Chapter.sort_order)
    )
    all_list = all_chapters.scalars().all()
    current_idx = next((i for i, c in enumerate(all_list) if c.id == chapter.id), -1)

    prev_outline = None
    next_summary = ""
    if current_idx > 0:
        prev_outline = all_list[current_idx - 1].detailed_outline
    if current_idx < len(all_list) - 1:
        next_summary = all_list[current_idx + 1].summary or ""

    user_prompt = prompt_detailed_outline(
        genre=ctx["project"].genre,
        chapter_title=chapter.title,
        chapter_summary=chapter.summary,
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
        outline_json=ctx["outline_json"],
        prev_chapter_outline=prev_outline,
        next_chapter_summary=next_summary,
        user_direction=user_direction,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        chapter.detailed_outline = parsed
        await db.commit()
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})


async def generate_batch_detailed_outlines_stream(
    db: AsyncSession, project_id: str, volume_id: str, user_direction: str = ""
) -> AsyncIterator[str]:
    result = await db.execute(
        select(Chapter)
        .where(Chapter.volume_id == volume_id, Chapter.project_id == project_id)
        .order_by(Chapter.sort_order)
    )
    chapters = result.scalars().all()

    if not chapters:
        yield sse_event("error", {"message": "该卷暂无章节"})
        return

    yield sse_event("progress", {"message": f"开始为 {len(chapters)} 个章节生成场景细纲..."})

    for i, chapter in enumerate(chapters):
        yield sse_event("progress", {"message": f"正在生成第 {i + 1}/{len(chapters)} 章「{chapter.title}」的场景细纲..."})
        async for event in generate_detailed_outline_stream(db, project_id, chapter.id, user_direction):
            if '"done"' not in event and '"error"' not in event:
                yield event

        await db.refresh(chapter)
        if chapter.detailed_outline:
            yield sse_event("chapter_done", {
                "chapter_id": chapter.id,
                "chapter_title": chapter.title,
                "index": i,
                "total": len(chapters),
                "detailed_outline": chapter.detailed_outline,
            })

    yield sse_event("done", {"result": {"total": len(chapters), "message": "所有章节细纲生成完成"}})
