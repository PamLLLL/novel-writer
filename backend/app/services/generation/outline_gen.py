import json
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import prompt_outline

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_outline_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在构思故事大纲..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

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
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})


async def generate_outline_act_stream(
    db: AsyncSession, project_id: str, act: str, user_direction: str = "", existing_outline: dict = {}
) -> AsyncIterator[str]:
    act_labels = {"act_one": "第一幕（开端）", "act_two": "第二幕（发展）", "act_three": "第三幕（高潮与结局）"}
    act_label = act_labels.get(act, act)
    yield sse_event("progress", {"message": f"正在生成{act_label}..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

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
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})


async def generate_outline_item_stream(
    db: AsyncSession, project_id: str, item_type: str, act: str = "", existing_outline: dict = {}
) -> AsyncIterator[str]:
    type_labels = {"key_event": "关键事件", "subplot": "副线剧情", "foreshadowing": "伏笔"}
    yield sse_event("progress", {"message": f"正在生成新的{type_labels.get(item_type, '内容')}..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

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
        yield sse_event("error", {"message": f"未知类型: {item_type}"})
        return

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, prompt, max_tokens=1024):
        full_text += chunk
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})
