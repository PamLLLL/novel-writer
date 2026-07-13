import json
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.json_parser import extract_json
from app.core.prompts.base import build_system_prompt
from app.models import Chapter, KnowledgeGraph, Project, Volume
from app.services.generation_service import _get_provider_from_settings, _get_project_context, _sse_event


async def get_knowledge_graph(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(select(KnowledgeGraph).where(KnowledgeGraph.project_id == project_id))
    kg = result.scalar_one_or_none()
    if not kg:
        return {"characters_state": {}, "plot_hooks": [], "timeline": [], "items": [], "rules": []}
    return {
        "characters_state": kg.characters_state or {},
        "plot_hooks": kg.plot_hooks or [],
        "timeline": kg.timeline or [],
        "items": kg.items or [],
        "rules": kg.rules or [],
    }


async def build_knowledge_graph_stream(db: AsyncSession, project_id: str) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在分析全文，构建知识图谱..."})

    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    chapters = (await db.execute(
        select(Chapter)
        .join(Volume, Chapter.volume_id == Volume.id)
        .where(Chapter.project_id == project_id, Chapter.content != "")
        .order_by(Volume.sort_order, Chapter.sort_order)
    )).scalars().all()

    if not chapters:
        yield _sse_event("error", {"message": "暂无已写章节"})
        return

    chapter_summaries = "\n".join([f"【{c.title}】{c.content[:500]}..." for c in chapters[:30]])

    user_prompt = f"""请分析以下小说内容，提取故事知识图谱。

小说类型：{ctx["project"].genre}
人物设定：{ctx["characters_json"]}

章节内容概要：
{chapter_summaries}

请以JSON格式返回知识图谱：
{{
  "characters_state": {{
    "角色名": [
      {{"chapter": "章节标题", "location": "所在位置", "state": "状态描述", "emotion": "情绪", "relationships_change": "关系变化"}}
    ]
  }},
  "plot_hooks": [
    {{"setup_chapter": "埋设章节", "description": "伏笔内容", "resolved": false, "resolve_chapter": ""}}
  ],
  "timeline": [
    {{"chapter": "章节标题", "story_time": "故事内时间", "events": "关键事件"}}
  ],
  "items": [
    {{"name": "物品名", "first_appear": "首次出现章节", "current_holder": "当前持有者", "status": "状态"}}
  ],
  "rules": [
    {{"rule": "世界观规则描述", "source": "来源章节"}}
  ]
}}"""

    system_prompt = ctx["system_prompt"]
    full_text = ""
    async for chunk in provider.stream_generate(system_prompt, user_prompt, max_tokens=8192):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        result = await db.execute(select(KnowledgeGraph).where(KnowledgeGraph.project_id == project_id))
        kg = result.scalar_one_or_none()
        if kg:
            kg.characters_state = parsed.get("characters_state", {})
            kg.plot_hooks = parsed.get("plot_hooks", [])
            kg.timeline = parsed.get("timeline", [])
            kg.items = parsed.get("items", [])
            kg.rules = parsed.get("rules", [])
        else:
            kg = KnowledgeGraph(
                project_id=project_id,
                characters_state=parsed.get("characters_state", {}),
                plot_hooks=parsed.get("plot_hooks", []),
                timeline=parsed.get("timeline", []),
                items=parsed.get("items", []),
                rules=parsed.get("rules", []),
            )
            db.add(kg)
        await db.commit()
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})


async def cascade_analysis_stream(db: AsyncSession, project_id: str, chapter_id: str) -> AsyncIterator[str]:
    yield _sse_event("progress", {"message": "正在分析修改影响范围..."})

    ctx = await _get_project_context(db, project_id)
    provider = await _get_provider_from_settings(db)

    target = (await db.execute(select(Chapter).where(Chapter.id == chapter_id))).scalar_one_or_none()
    if not target:
        yield _sse_event("error", {"message": "章节不存在"})
        return

    kg = await get_knowledge_graph(db, project_id)

    later_chapters = (await db.execute(
        select(Chapter)
        .join(Volume, Chapter.volume_id == Volume.id)
        .where(Chapter.project_id == project_id, Chapter.content != "")
        .order_by(Volume.sort_order, Chapter.sort_order)
    )).scalars().all()

    target_idx = next((i for i, c in enumerate(later_chapters) if c.id == chapter_id), -1)
    affected_chapters = later_chapters[target_idx + 1:target_idx + 21] if target_idx >= 0 else []

    if not affected_chapters:
        yield _sse_event("done", {"result": {"affected": [], "summary": "后续无已写章节，无需级联更新"}})
        return

    chapters_info = "\n".join([f"- {c.title}: {c.content[:200]}..." for c in affected_chapters[:10]])

    user_prompt = f"""分析以下章节修改可能对后续章节产生的影响。

被修改的章节：{target.title}
修改后的内容：{target.content[:2000]}...

知识图谱：{json.dumps(kg, ensure_ascii=False)[:3000]}

后续章节：
{chapters_info}

请以JSON格式返回影响分析：
{{
  "affected": [
    {{
      "chapter_title": "受影响章节标题",
      "impact": "影响描述",
      "severity": "high/medium/low",
      "suggestion": "建议修改方式"
    }}
  ],
  "summary": "整体影响评估"
}}"""

    full_text = ""
    async for chunk in provider.stream_generate(ctx["system_prompt"], user_prompt, max_tokens=4096):
        full_text += chunk
        yield _sse_event("content", {"text": chunk})

    parsed = extract_json(full_text)
    if parsed:
        yield _sse_event("done", {"result": parsed})
    else:
        yield _sse_event("done", {"result": {"raw_text": full_text}})
