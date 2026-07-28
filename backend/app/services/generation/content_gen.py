from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.prompts.steps import prompt_chapter_content
from app.models import Chapter, Volume

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_chapter_content_stream(
    db: AsyncSession, project_id: str, chapter_id: str, user_direction: str = "",
    custom_word_target: int = 0
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在撰写章节正文..."})

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
        .where(Chapter.project_id == chapter.project_id)
        .order_by(Volume.sort_order, Chapter.sort_order)
    )
    all_list = all_chapters.scalars().all()
    current_idx = next((i for i, c in enumerate(all_list) if c.id == chapter.id), -1)

    prev_summary = ""
    if current_idx > 0:
        parts = []
        lookback = all_list[max(0, current_idx - 3):current_idx]
        for c in lookback:
            parts.append(f"【{c.title}】{c.summary}")
        prev_summary = "\n".join(parts)

        prev_chapter = all_list[current_idx - 1]
        if prev_chapter.content:
            tail = prev_chapter.content[-1500:]
            prev_summary += f"\n\n上一章（{prev_chapter.title}）结尾原文：\n「{tail}」"

    if custom_word_target > 0:
        word_target = custom_word_target
    elif chapter.word_target and chapter.word_target > 0:
        word_target = chapter.word_target
    else:
        word_target = ctx["project"].target_words // max(1, len(ctx["volumes"])) // 10
        word_target = max(2000, min(5000, word_target))

    detailed_outline = chapter.detailed_outline

    from app.services.knowledge_service import get_knowledge_graph
    narrative_state = await get_knowledge_graph(db, project_id)
    has_narrative = bool(narrative_state.get("characters_state") or narrative_state.get("plot_hooks"))

    if current_idx > 0:
        prev_ch = all_list[current_idx - 1]
        if prev_ch.detailed_outline and prev_ch.detailed_outline.get("scenes"):
            last_scene = prev_ch.detailed_outline["scenes"][-1]
            transition = last_scene.get("transition_to_next", "")
            if transition:
                prev_summary += f"\n\n上一章最后场景过渡：{transition}"

    user_prompt = prompt_chapter_content(
        genre=ctx["project"].genre,
        chapter_title=chapter.title,
        chapter_summary=chapter.summary,
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
        prev_summary=prev_summary,
        chapter_word_target=word_target,
        user_direction=user_direction,
        detailed_outline=detailed_outline,
        narrative_state=narrative_state if has_narrative else None,
        is_first_chapter=(current_idx == 0),
        platform=ctx["project"].target_platform or "",
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, temperature=0.88, max_tokens=16384):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    word_count = len(full_text)

    if word_target > 0:
        ratio = word_count / word_target
        if ratio < 0.7:
            yield sse_event("warning", {"message": f"字数偏少（{word_count}/{word_target}字，仅达目标的{int(ratio*100)}%），建议使用「AI续写」补充内容"})
        elif ratio > 1.3:
            yield sse_event("warning", {"message": f"字数偏多（{word_count}/{word_target}字，超出目标{int((ratio-1)*100)}%），建议精简冗余段落"})

    yield sse_event("done", {"result": {"content": full_text, "word_count": word_count}})


async def rewrite_chapter_stream(
    db: AsyncSession, project_id: str, chapter_id: str, instruction: str, selected_text: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在改写..."})
    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter or not chapter.content:
        yield sse_event("error", {"message": "章节不存在或无内容"})
        return

    from app.models.version import Version
    version = Version(chapter_id=chapter_id, content=chapter.content, operation_type="before_rewrite")
    db.add(version)
    await db.commit()

    if selected_text:
        user_prompt = f"""请改写以下小说片段。

改写指令：{instruction}

需要改写的原文：
「{selected_text}」

完整章节上下文（帮助你保持一致性）：
{chapter.content}

要求：
- 只输出改写后的片段，不要输出整章
- 保持与上下文的风格和语气一致
- 严格按照改写指令来修改

直接输出改写后的内容："""
    else:
        user_prompt = f"""请按照以下指令改写整个章节。

改写指令：{instruction}

原文：
{chapter.content}

要求：
- 保持故事主线和关键情节不变
- 按照改写指令调整文风、节奏或细节
- 输出完整的改写后章节

直接输出改写后的内容："""

    full_text = ""
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, temperature=0.88, max_tokens=16384):
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


async def continue_chapter_stream(
    db: AsyncSession, project_id: str, chapter_id: str, user_direction: str = "", word_target: int = 0
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在续写..."})
    ctx = await get_project_context(db, project_id)
    provider = await get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter or not chapter.content:
        yield sse_event("error", {"message": "章节不存在或无内容"})
        return

    from app.models.version import Version
    version = Version(chapter_id=chapter_id, content=chapter.content, operation_type="before_continue")
    db.add(version)
    await db.commit()

    target = word_target if word_target > 0 else 1000
    tail = chapter.content[-2000:]
    direction = f"\n\n用户要求：{user_direction}" if user_direction else ""

    user_prompt = f"""请续写以下小说章节。

章节标题：{chapter.title}
章节摘要：{chapter.summary}
续写目标字数：约{target}字{direction}

当前章节末尾（从这里接着写）：
「{tail}」

要求：
- 无缝衔接当前内容，不要重复已有文字
- 保持一致的文风和叙事节奏
- 推动剧情发展

直接输出续写内容，不要任何标注："""

    full_text = ""
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, temperature=0.88, max_tokens=8192):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    chapter.content = chapter.content + full_text
    chapter.word_count = len(chapter.content)
    await db.commit()

    yield sse_event("done", {"result": {"content": chapter.content, "word_count": chapter.word_count}})
