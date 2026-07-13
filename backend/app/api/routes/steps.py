from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.services import step_service, generation_service

router = APIRouter()


class GenerateRequest(BaseModel):
    user_direction: str = ""
    word_target: int = 0


class GenerateActRequest(BaseModel):
    act: str
    user_direction: str = ""
    existing_outline: dict = {}


class ChapterOutlinesRequest(BaseModel):
    volume_id: str
    user_direction: str = ""
    chapter_word_target: int = 0


class GenerateOutlineItemRequest(BaseModel):
    item_type: str  # "key_event", "subplot", "foreshadowing"
    act: str = ""   # for key_event: which act
    existing_outline: dict = {}


class CompleteCharacterRequest(BaseModel):
    name: str = ""
    role: str = ""
    relationship: str = ""


class SaveDataRequest(BaseModel):
    data: dict | list


class SaveChapterContentRequest(BaseModel):
    content: str


class UpdateChapterRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    status: str | None = None


# --- Settings (Step 1) ---

@router.get("/{project_id}/settings")
async def get_settings(project_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.get_settings_data(db, project_id)


@router.put("/{project_id}/settings")
async def save_settings(project_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    await step_service.save_settings_data(db, project_id, req.data)
    return {"status": "ok"}


@router.post("/{project_id}/generate/settings")
async def generate_settings(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_settings_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


# --- Characters (Step 2) ---

@router.get("/{project_id}/characters")
async def get_characters(project_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.get_characters(db, project_id)


@router.put("/{project_id}/characters")
async def save_characters(project_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    await step_service.save_characters(db, project_id, req.data)
    return {"status": "ok"}


@router.post("/{project_id}/generate/characters")
async def generate_characters(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_characters_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/complete-character")
async def complete_character(project_id: str, req: CompleteCharacterRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_single_character_stream(
            db, project_id, name=req.name, role=req.role, relationship=req.relationship
        ),
        media_type="text/event-stream",
    )


# --- Worldview (Step 3) ---

@router.get("/{project_id}/worldview")
async def get_worldview(project_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.get_worldview(db, project_id)


@router.put("/{project_id}/worldview")
async def save_worldview(project_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    await step_service.save_worldview(db, project_id, req.data)
    return {"status": "ok"}


@router.post("/{project_id}/generate/worldview")
async def generate_worldview(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_worldview_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


# --- Outline (Step 4) ---

@router.get("/{project_id}/outline")
async def get_outline(project_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.get_outline(db, project_id)


@router.put("/{project_id}/outline")
async def save_outline(project_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    await step_service.save_outline(db, project_id, req.data)
    return {"status": "ok"}


@router.post("/{project_id}/generate/outline")
async def generate_outline(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_outline_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/outline-act")
async def generate_outline_act(project_id: str, req: GenerateActRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_outline_act_stream(
            db, project_id, act=req.act, user_direction=req.user_direction,
            existing_outline=req.existing_outline
        ),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/outline-item")
async def generate_outline_item(project_id: str, req: GenerateOutlineItemRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_outline_item_stream(
            db, project_id, item_type=req.item_type, act=req.act,
            existing_outline=req.existing_outline
        ),
        media_type="text/event-stream",
    )


# --- Volumes (Step 5) ---

@router.get("/{project_id}/volumes")
async def get_volumes(project_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.get_volumes(db, project_id)


@router.put("/{project_id}/volumes")
async def save_volumes(project_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    result = await step_service.save_volumes(db, project_id, req.data)
    return result


@router.post("/{project_id}/generate/volumes")
async def generate_volumes(project_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_volumes_stream(db, project_id, req.user_direction),
        media_type="text/event-stream",
    )


# --- Chapters (Step 6) ---

@router.get("/{project_id}/chapters")
async def get_chapters(project_id: str, volume_id: str | None = None, db: AsyncSession = Depends(get_db)):
    return await step_service.get_chapters(db, project_id, volume_id)


@router.put("/{project_id}/chapters/{volume_id}")
async def save_chapter_outlines(project_id: str, volume_id: str, req: SaveDataRequest, db: AsyncSession = Depends(get_db)):
    await step_service.save_chapter_outlines(db, project_id, volume_id, req.data)
    return {"status": "ok"}


@router.post("/{project_id}/generate/chapter-outlines")
async def generate_chapter_outlines(project_id: str, req: ChapterOutlinesRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_chapter_outlines_stream(
            db, project_id, req.volume_id, req.user_direction, req.chapter_word_target
        ),
        media_type="text/event-stream",
    )


# --- Chapter Content (Step 7) ---

@router.get("/{project_id}/chapter/{chapter_id}")
async def get_chapter(project_id: str, chapter_id: str, db: AsyncSession = Depends(get_db)):
    chapter = await step_service.get_chapter(db, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.put("/{project_id}/chapter/{chapter_id}")
async def update_chapter(project_id: str, chapter_id: str, req: UpdateChapterRequest, db: AsyncSession = Depends(get_db)):
    data = req.model_dump(exclude_unset=True)
    result = await step_service.update_chapter(db, chapter_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return result


@router.post("/{project_id}/generate/chapter/{chapter_id}")
async def generate_chapter(project_id: str, chapter_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_chapter_content_stream(
            db, project_id, chapter_id, req.user_direction, req.word_target
        ),
        media_type="text/event-stream",
    )


class RewriteRequest(BaseModel):
    instruction: str
    selected_text: str = ""


@router.post("/{project_id}/generate/rewrite/{chapter_id}")
async def rewrite_chapter(project_id: str, chapter_id: str, req: RewriteRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.rewrite_chapter_stream(db, project_id, chapter_id, req.instruction, req.selected_text),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/continue/{chapter_id}")
async def continue_chapter(project_id: str, chapter_id: str, req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.continue_chapter_stream(db, project_id, chapter_id, req.user_direction, req.word_target),
        media_type="text/event-stream",
    )


# --- Versions ---

@router.get("/{project_id}/chapter/{chapter_id}/versions")
async def list_versions(project_id: str, chapter_id: str, db: AsyncSession = Depends(get_db)):
    return await step_service.list_versions(db, chapter_id)


@router.get("/{project_id}/version/{version_id}")
async def get_version(project_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    content = await step_service.get_version_content(db, version_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"content": content}


@router.post("/{project_id}/chapter/{chapter_id}/rollback/{version_id}")
async def rollback_version(project_id: str, chapter_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    result = await step_service.rollback_version(db, chapter_id, version_id)
    if not result:
        raise HTTPException(status_code=404, detail="Chapter or version not found")
    return result


class ApplyFixRequest(BaseModel):
    chapter_id: str
    issue_description: str
    suggestion: str
    original_text: str = ""


# --- Quality Check (Step 8) ---

@router.post("/{project_id}/generate/quality-check")
async def generate_quality_check(project_id: str, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.generate_quality_check_stream(db, project_id),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/apply-fix")
async def apply_fix(project_id: str, req: ApplyFixRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        generation_service.apply_quality_fix_stream(
            db, project_id, req.chapter_id, req.issue_description, req.suggestion, req.original_text
        ),
        media_type="text/event-stream",
    )


# --- Detailed Outlines (Scene-Level) ---

class DetailedOutlineRequest(BaseModel):
    user_direction: str = ""


class BatchDetailedOutlineRequest(BaseModel):
    volume_id: str
    user_direction: str = ""


class SaveDetailedOutlineRequest(BaseModel):
    detailed_outline: dict


@router.post("/{project_id}/generate/detailed-outline/{chapter_id}")
async def generate_detailed_outline(
    project_id: str, chapter_id: str, req: DetailedOutlineRequest,
    db: AsyncSession = Depends(get_db)
):
    return StreamingResponse(
        generation_service.generate_detailed_outline_stream(
            db, project_id, chapter_id, req.user_direction
        ),
        media_type="text/event-stream",
    )


@router.post("/{project_id}/generate/batch-detailed-outlines")
async def batch_detailed_outlines(
    project_id: str, req: BatchDetailedOutlineRequest,
    db: AsyncSession = Depends(get_db)
):
    return StreamingResponse(
        generation_service.generate_batch_detailed_outlines_stream(
            db, project_id, req.volume_id, req.user_direction
        ),
        media_type="text/event-stream",
    )


@router.put("/{project_id}/chapter/{chapter_id}/detailed-outline")
async def save_detailed_outline(
    project_id: str, chapter_id: str, req: SaveDetailedOutlineRequest,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    from app.models import Chapter
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    chapter.detailed_outline = req.detailed_outline
    await db.commit()
    return {"status": "ok"}


# --- Polish ---

class PolishRequest(BaseModel):
    selected_text: str = ""
    user_direction: str = ""


@router.post("/{project_id}/generate/polish/{chapter_id}")
async def polish_chapter(
    project_id: str, chapter_id: str, req: PolishRequest,
    db: AsyncSession = Depends(get_db)
):
    return StreamingResponse(
        generation_service.polish_chapter_stream(
            db, project_id, chapter_id, req.selected_text, req.user_direction
        ),
        media_type="text/event-stream",
    )


# --- Staleness Check ---

@router.get("/{project_id}/staleness")
async def check_staleness(project_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models import Chapter, Outline, Project, Volume, Worldview

    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    outline = (await db.execute(select(Outline).where(Outline.project_id == project_id))).scalar_one_or_none()
    worldview = (await db.execute(select(Worldview).where(Worldview.project_id == project_id))).scalar_one_or_none()

    upstream_times = []
    if project and project.updated_at:
        upstream_times.append(project.updated_at)
    if outline and outline.updated_at:
        upstream_times.append(outline.updated_at)
    if worldview and worldview.updated_at:
        upstream_times.append(worldview.updated_at)

    latest_upstream = max(upstream_times) if upstream_times else None

    chapters = (await db.execute(
        select(Chapter)
        .join(Volume, Chapter.volume_id == Volume.id)
        .where(Chapter.project_id == project_id)
        .order_by(Volume.sort_order, Chapter.sort_order)
    )).scalars().all()

    stale_chapters = []
    for ch in chapters:
        if latest_upstream and ch.content and ch.updated_at and ch.updated_at < latest_upstream:
            stale_chapters.append({
                "id": ch.id,
                "title": ch.title,
            })

    return {
        "stale_chapters": stale_chapters,
        "upstream_updated": latest_upstream.isoformat() if latest_upstream else None,
    }
