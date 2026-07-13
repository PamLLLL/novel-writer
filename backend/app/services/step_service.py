import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter, Outline, Project, Volume, Worldview
from app.models.character import Character
from app.models.version import Version


async def get_settings_data(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {}
    return project.style_config.get("settings", {})


async def save_settings_data(db: AsyncSession, project_id: str, data: dict) -> None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return
    config = project.style_config or {}
    config["settings"] = data
    project.style_config = config
    await db.commit()


async def get_characters(db: AsyncSession, project_id: str) -> list[dict]:
    result = await db.execute(
        select(Character).where(Character.project_id == project_id).order_by(Character.sort_order)
    )
    chars = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "role": c.role,
            "personality": c.personality,
            "background": c.background,
            "appearance": c.appearance,
            "relationships": c.relationships or [],
            "sort_order": c.sort_order,
        }
        for c in chars
    ]


async def save_characters(db: AsyncSession, project_id: str, characters: list[dict]) -> None:
    await db.execute(
        Character.__table__.delete().where(Character.project_id == project_id)
    )
    for i, char_data in enumerate(characters):
        char = Character(
            id=char_data.get("id", str(uuid4())),
            project_id=project_id,
            name=char_data.get("name", ""),
            role=char_data.get("role", "supporting"),
            personality=char_data.get("personality", ""),
            background=char_data.get("background", ""),
            appearance=char_data.get("appearance", ""),
            relationships=char_data.get("relationships", []),
            sort_order=i,
        )
        db.add(char)
    await db.commit()


async def get_worldview(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(select(Worldview).where(Worldview.project_id == project_id))
    wv = result.scalar_one_or_none()
    return wv.content if wv else {}


async def save_worldview(db: AsyncSession, project_id: str, data: dict) -> None:
    result = await db.execute(select(Worldview).where(Worldview.project_id == project_id))
    wv = result.scalar_one_or_none()
    if wv:
        wv.content = data
    else:
        wv = Worldview(project_id=project_id, content=data)
        db.add(wv)
    await db.commit()


async def get_outline(db: AsyncSession, project_id: str) -> dict:
    result = await db.execute(select(Outline).where(Outline.project_id == project_id))
    ol = result.scalar_one_or_none()
    return ol.content if ol else {}


async def save_outline(db: AsyncSession, project_id: str, data: dict) -> None:
    result = await db.execute(select(Outline).where(Outline.project_id == project_id))
    ol = result.scalar_one_or_none()
    if ol:
        ol.content = data
    else:
        ol = Outline(project_id=project_id, content=data)
        db.add(ol)
    await db.commit()


async def get_volumes(db: AsyncSession, project_id: str) -> list[dict]:
    result = await db.execute(
        select(Volume).where(Volume.project_id == project_id).order_by(Volume.sort_order)
    )
    vols = result.scalars().all()
    return [
        {"id": v.id, "title": v.title, "summary": v.summary, "sort_order": v.sort_order}
        for v in vols
    ]


async def save_volumes(db: AsyncSession, project_id: str, volumes: list[dict]) -> list[dict]:
    await db.execute(Volume.__table__.delete().where(Volume.project_id == project_id))
    result = []
    for i, vol_data in enumerate(volumes):
        vol = Volume(
            id=vol_data.get("id", str(uuid4())),
            project_id=project_id,
            title=vol_data.get("title", f"第{i + 1}卷"),
            summary=vol_data.get("summary", ""),
            sort_order=i,
        )
        db.add(vol)
        result.append({"id": vol.id, "title": vol.title, "summary": vol.summary, "sort_order": i})
    await db.commit()
    return result


async def get_chapters(db: AsyncSession, project_id: str, volume_id: str | None = None) -> list[dict]:
    query = select(Chapter).join(Volume, Chapter.volume_id == Volume.id).where(Chapter.project_id == project_id)
    if volume_id:
        query = query.where(Chapter.volume_id == volume_id)
    query = query.order_by(Volume.sort_order, Chapter.sort_order)
    result = await db.execute(query)
    chapters = result.scalars().all()
    return [
        {
            "id": c.id,
            "volume_id": c.volume_id,
            "title": c.title,
            "summary": c.summary,
            "content": c.content,
            "word_count": c.word_count,
            "word_target": c.word_target,
            "sort_order": c.sort_order,
            "status": c.status,
        }
        for c in chapters
    ]


async def save_chapter_outlines(db: AsyncSession, project_id: str, volume_id: str, chapters: list[dict]) -> None:
    await db.execute(
        Chapter.__table__.delete().where(
            Chapter.project_id == project_id, Chapter.volume_id == volume_id
        )
    )
    for i, ch_data in enumerate(chapters):
        ch = Chapter(
            id=ch_data.get("id", str(uuid4())),
            volume_id=volume_id,
            project_id=project_id,
            title=ch_data.get("title", f"第{i + 1}章"),
            summary=ch_data.get("summary", ""),
            word_target=ch_data.get("word_target", 3000),
            sort_order=i,
            status=ch_data.get("status", "pending"),
            content=ch_data.get("content", ""),
            word_count=ch_data.get("word_count", 0),
        )
        db.add(ch)
    await db.commit()


async def get_chapter(db: AsyncSession, chapter_id: str) -> dict | None:
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    c = result.scalar_one_or_none()
    if not c:
        return None
    return {
        "id": c.id,
        "volume_id": c.volume_id,
        "title": c.title,
        "summary": c.summary,
        "content": c.content,
        "word_count": c.word_count,
        "word_target": c.word_target,
        "sort_order": c.sort_order,
        "status": c.status,
    }


async def save_chapter_content(db: AsyncSession, chapter_id: str, content: str) -> None:
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    ch = result.scalar_one_or_none()
    if not ch:
        return
    if ch.content:
        version = Version(
            chapter_id=chapter_id,
            content=ch.content,
            operation_type="auto_save",
        )
        db.add(version)
    ch.content = content
    ch.word_count = len(content)
    ch.status = "completed"
    await db.commit()


async def update_chapter(db: AsyncSession, chapter_id: str, data: dict) -> dict | None:
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    ch = result.scalar_one_or_none()
    if not ch:
        return None
    if "content" in data and data["content"] is not None:
        old_content = ch.content
        if old_content and old_content != data["content"]:
            version = Version(chapter_id=chapter_id, content=old_content, operation_type="before_edit")
            db.add(version)
        ch.word_count = len(data["content"])
    for key in ("title", "summary", "content", "status", "word_target"):
        if key in data:
            setattr(ch, key, data[key])
    await db.commit()
    return await get_chapter(db, chapter_id)


async def list_versions(db: AsyncSession, chapter_id: str) -> list[dict]:
    result = await db.execute(
        select(Version).where(Version.chapter_id == chapter_id).order_by(Version.created_at.desc())
    )
    versions = result.scalars().all()
    return [
        {
            "id": v.id,
            "operation_type": v.operation_type,
            "word_count": len(v.content),
            "created_at": v.created_at.isoformat() if v.created_at else "",
            "preview": v.content[:200] + "..." if len(v.content) > 200 else v.content,
        }
        for v in versions
    ]


async def get_version_content(db: AsyncSession, version_id: str) -> str | None:
    result = await db.execute(select(Version).where(Version.id == version_id))
    v = result.scalar_one_or_none()
    return v.content if v else None


async def rollback_version(db: AsyncSession, chapter_id: str, version_id: str) -> dict | None:
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    ch = result.scalar_one_or_none()
    if not ch:
        return None

    result = await db.execute(select(Version).where(Version.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        return None

    if ch.content:
        save_current = Version(chapter_id=chapter_id, content=ch.content, operation_type="before_rollback")
        db.add(save_current)

    ch.content = version.content
    ch.word_count = len(version.content)
    await db.commit()
    return await get_chapter(db, chapter_id)
