import json
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.ai.registry import get_provider
from app.core.prompts.base import build_system_prompt
from app.core.style.compiler import compile_style, get_platform_rules
from app.core.prompts.steps import (
    prompt_chapter_content,
    prompt_chapter_outlines,
    prompt_characters,
    prompt_outline,
    prompt_quality_check,
    prompt_settings,
    prompt_volumes,
    prompt_worldview,
)
from app.models import Chapter, GlobalSettings, Outline, Project, Volume, Worldview
from app.models.character import Character


async def _get_provider_from_settings(db: AsyncSession):
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


async def _get_project_context(db: AsyncSession, project_id: str) -> dict:
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
        ),
    }


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def generate_settings_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在分析创意，生成基础设定..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

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
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_single_character_stream(
    db: AsyncSession, project_id: str, name: str = "", role: str = "", relationship: str = ""
) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": f"正在为「{name or '新角色'}」生成详细设定..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

    settings_content = project.style_config.get("settings", {})
    existing_chars = ctx["characters_json"]

    user_prompt = f"""基于以下小说设定，为一个角色生成详细信息。

小说类型：{project.genre}
核心创意：{project.concept}
基础设定：{json.dumps(settings_content, ensure_ascii=False)}
已有角色：{existing_chars}

需要补全的角色：
- 姓名：{name or "（请取一个合适的名字）"}
- 角色定位：{role or "（根据故事需要决定）"}
- 与主角的关系：{relationship or "（根据故事需要决定）"}

请以JSON格式返回这个角色的完整信息：
{{
  "name": "{name or '角色姓名'}",
  "role": "{role or 'supporting'}",
  "personality": "性格特点（具体、多层次，150字以上）",
  "background": "人物背景故事（200字以上）",
  "appearance": "外貌描写（100字以上）",
  "motivation": "核心动机/目标",
  "arc": "角色成长弧线",
  "relationships": [
    {{"target": "其他角色名", "relation": "关系描述", "dynamic": "关系变化趋势"}}
  ]
}}

要求：
- 角色要与已有角色产生化学反应，不能孤立存在
- 性格要立体，有优点也有缺点
- 背景故事要与小说世界观契合
- 与主角的关系要有戏剧张力和发展空间"""

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=4096):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_characters_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在构思人物体系..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

    settings_content = project.style_config.get("settings", {})
    user_prompt = prompt_characters(
        genre=project.genre,
        concept=project.concept,
        settings_json=json.dumps(settings_content, ensure_ascii=False),
        target_words=project.target_words,
        user_direction=user_direction,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_worldview_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在构建世界观..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

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
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_outline_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在构思故事大纲..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

    settings_content = project.style_config.get("settings", {})
    user_prompt = prompt_outline(
        genre=project.genre,
        concept=project.concept,
        settings_json=json.dumps(settings_content, ensure_ascii=False),
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
        target_words=project.target_words,
        user_direction=user_direction,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_outline_act_stream(
    db: AsyncSession, project_id: str, act: str, user_direction: str = "", existing_outline: dict = {}
) -> AsyncIterator[str]:
    act_labels = {"act_one": "第一幕（开端）", "act_two": "第二幕（发展）", "act_three": "第三幕（高潮与结局）"}
    act_label = act_labels.get(act, act)
    yield _sse_event("progress", {"message": f"正在生成{act_label}..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

    other_acts = {k: v for k, v in existing_outline.items() if k != act and k.startswith("act_")}
    other_info = json.dumps(other_acts, ensure_ascii=False) if other_acts else "暂无"

    direction_text = f"\n\n用户特别要求：{user_direction}" if user_direction else ""

    user_prompt = f"""基于以下小说设定，只生成故事大纲中的 **{act_label}** 部分。

小说类型：{project.genre}
核心创意：{project.concept}
人物体系：{ctx["characters_json"]}
世界观：{ctx["worldview_json"]}
已有的其他幕内容（请保持衔接）：{other_info}{direction_text}

请以JSON格式返回这一幕的内容：
{{
  "title": "本幕标题",
  "summary": "本幕概述（300字以上）",
  "key_events": ["关键事件1", "关键事件2", "关键事件3"],
  "turning_point": "本幕转折点"
}}

要求：
- 与已有的其他幕内容保持逻辑衔接
- 关键事件必须是具体的字符串描述，不要用对象
- 转折点要有戏剧张力"""

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=4096):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_outline_item_stream(
    db: AsyncSession, project_id: str, item_type: str, act: str = "", existing_outline: dict = {}
) -> AsyncIterator[str]:
    type_labels = {"key_event": "关键事件", "subplot": "副线剧情", "foreshadowing": "伏笔"}
    yield _sse_event("progress", {"message": f"正在生成新的{type_labels.get(item_type, '内容')}..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

    outline_info = json.dumps(existing_outline, ensure_ascii=False)

    if item_type == "key_event":
        act_labels = {"act_one": "第一幕", "act_two": "第二幕", "act_three": "第三幕"}
        act_data = existing_outline.get(act, {})
        existing_events = act_data.get("key_events", [])
        prompt = f"""基于现有的故事大纲，为{act_labels.get(act, act)}新增一个关键事件。

小说类型：{project.genre}
核心创意：{project.concept}
人物体系：{ctx["characters_json"]}
当前大纲：{outline_info}
本幕已有事件：{json.dumps(existing_events, ensure_ascii=False)}

要求：
- 新事件必须与本幕已有事件和整体剧情逻辑连贯
- 不要重复已有的事件
- 要推动剧情发展或深化角色关系

请只返回一个JSON对象：
{{"event": "新的关键事件描述（一句话，50-100字）"}}"""

    elif item_type == "subplot":
        existing_subplots = existing_outline.get("subplots", [])
        prompt = f"""基于现有的故事大纲，新增一条副线剧情。

小说类型：{project.genre}
核心创意：{project.concept}
人物体系：{ctx["characters_json"]}
当前大纲：{outline_info}
已有副线：{json.dumps(existing_subplots, ensure_ascii=False)}

要求：
- 副线要与主线产生交集，不能完全独立
- 不要重复已有的副线
- 要有明确的起承转合

请只返回一个JSON对象：
{{"name": "副线名称", "description": "副线描述（100-200字，说明这条线的起因、发展和与主线的关系）"}}"""

    elif item_type == "foreshadowing":
        existing_foreshadowing = existing_outline.get("foreshadowing", [])
        prompt = f"""基于现有的故事大纲，设计一个新的伏笔。

小说类型：{project.genre}
核心创意：{project.concept}
人物体系：{ctx["characters_json"]}
当前大纲：{outline_info}
已有伏笔：{json.dumps(existing_foreshadowing, ensure_ascii=False)}

要求：
- 伏笔要自然，读者第一次看到时不会起疑
- 回收时要有恍然大悟的感觉
- 不要重复已有的伏笔

请只返回一个JSON对象：
{{"setup": "伏笔埋设（在哪里埋下什么线索，50-100字）", "payoff": "伏笔回收（在哪里以什么方式揭示，50-100字）"}}"""
    else:
        yield _sse_event("error", {"message": f"未知类型: {item_type}"})
        return

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, prompt, max_tokens=1024):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_volumes_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在规划分卷结构..."})

    ctx = await _get_project_context(db, project_id)
    project = ctx["project"]
    provider = await _get_provider_from_settings(db)

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
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_chapter_outlines_stream(
    db: AsyncSession, project_id: str, volume_id: str, user_direction: str = "",
    chapter_word_target: int = 0
) -> AsyncIterator[str]:
    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    result = await db.execute(select(Volume).where(Volume.id == volume_id))
    volume = result.scalar_one_or_none()
    if not volume:
        yield _sse_event("error", {"message": "分卷不存在"})
        return

    yield _sse_event("progress", {"message": f"正在为「{volume.title}」生成章节大纲..."})

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
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def generate_chapter_content_stream(
    db: AsyncSession, project_id: str, chapter_id: str, user_direction: str = "",
    custom_word_target: int = 0
) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在撰写章节正文..."})

    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        yield _sse_event("error", {"message": "章节不存在"})
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

    user_prompt = prompt_chapter_content(
        genre=ctx["project"].genre,
        chapter_title=chapter.title,
        chapter_summary=chapter.summary,
        characters_json=ctx["characters_json"],
        worldview_json=ctx["worldview_json"],
        prev_summary=prev_summary,
        chapter_word_target=word_target,
        user_direction=user_direction,
    )

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=16384):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    word_count = len(full_text)
    yield _sse_event("done", {"result": {"content": full_text, "word_count": word_count}})


async def rewrite_chapter_stream(
    db: AsyncSession, project_id: str, chapter_id: str, instruction: str, selected_text: str = ""
) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在改写..."})
    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter or not chapter.content:
        yield _sse_event("error", {"message": "章节不存在或无内容"})
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
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, max_tokens=16384):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    if selected_text and full_text:
        new_content = chapter.content.replace(selected_text, full_text, 1)
        chapter.content = new_content
    elif full_text:
        chapter.content = full_text
    chapter.word_count = len(chapter.content)
    await db.commit()

    yield _sse_event("done", {"result": {"content": chapter.content, "word_count": chapter.word_count}})


async def continue_chapter_stream(
    db: AsyncSession, project_id: str, chapter_id: str, user_direction: str = "", word_target: int = 0
) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在续写..."})
    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter or not chapter.content:
        yield _sse_event("error", {"message": "章节不存在或无内容"})
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
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, max_tokens=8192):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    chapter.content = chapter.content + full_text
    chapter.word_count = len(chapter.content)
    await db.commit()

    yield _sse_event("done", {"result": {"content": chapter.content, "word_count": chapter.word_count}})


async def generate_quality_check_stream(db: AsyncSession, project_id: str) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在进行全文质量检查..."})

    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    chapters = await db.execute(
        select(Chapter)
        .where(Chapter.project_id == project_id, Chapter.content != "")
        .order_by(Chapter.sort_order)
    )
    chapter_list = chapters.scalars().all()

    if not chapter_list:
        yield _sse_event("error", {"message": "暂无已写章节，无法进行质量检查"})
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
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_response)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_response}})


async def apply_quality_fix_stream(
    db: AsyncSession, project_id: str, chapter_id: str,
    issue_description: str, suggestion: str, original_text: str = ""
) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在应用修改建议..."})

    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        yield _sse_event("error", {"message": "章节不存在"})
        return

    if not chapter.content:
        yield _sse_event("error", {"message": "章节暂无内容，无法修改"})
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
        yield _sse_event("content", {"text": chunk})

    chapter.content = full_text
    chapter.word_count = len(full_text)
    await db.commit()

    yield _sse_event("done", {"result": {"content": full_text, "word_count": len(full_text)}})
