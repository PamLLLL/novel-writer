import json
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.steps import prompt_characters

from .helpers import get_project_context, get_provider_from_settings, sse_event


async def generate_single_character_stream(
    db: AsyncSession, project_id: str, name: str = "", role: str = "", relationship: str = ""
) -> AsyncIterator[str]:
    yield sse_event("progress", {"message": f"正在为「{name or '新角色'}」生成详细设定..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

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
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})


async def generate_characters_stream(db: AsyncSession, project_id: str, user_direction: str = "") -> AsyncIterator[str]:
    yield sse_event("progress", {"message": "正在构思人物体系..."})

    ctx = await get_project_context(db, project_id)
    project = ctx["project"]
    provider = await get_provider_from_settings(db)

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
        yield sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield sse_event("done", {"result": parsed})
    else:
        yield sse_event("done", {"result": {"raw_text": full_text}})
