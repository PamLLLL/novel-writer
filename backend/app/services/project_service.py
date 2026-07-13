from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectDetail, ProjectSummary, ProjectUpdate


async def list_projects(db: AsyncSession) -> list[ProjectSummary]:
    stmt = (
        select(
            Project,
            func.count(Chapter.id).label("chapter_count"),
            func.coalesce(func.sum(Chapter.word_count), 0).label("total_word_count"),
        )
        .outerjoin(Chapter, Chapter.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        ProjectSummary(
            id=p.id,
            name=p.name,
            genre=p.genre,
            concept=p.concept[:200] if p.concept else "",
            target_words=p.target_words,
            target_platform=p.target_platform,
            status=p.status,
            chapter_count=chapter_count,
            total_word_count=total_word_count,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p, chapter_count, total_word_count in rows
    ]


async def create_project(db: AsyncSession, data: ProjectCreate) -> ProjectDetail:
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _to_detail(project, 0, 0)


async def get_project(db: AsyncSession, project_id: str) -> ProjectDetail | None:
    stmt = (
        select(
            Project,
            func.count(Chapter.id).label("chapter_count"),
            func.coalesce(func.sum(Chapter.word_count), 0).label("total_word_count"),
        )
        .outerjoin(Chapter, Chapter.project_id == Project.id)
        .where(Project.id == project_id)
        .group_by(Project.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        return None
    p, chapter_count, total_word_count = row
    return _to_detail(p, chapter_count, total_word_count)


async def update_project(db: AsyncSession, project_id: str, data: ProjectUpdate) -> ProjectDetail | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return await get_project(db, project_id)


async def delete_project(db: AsyncSession, project_id: str) -> bool:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        return False
    await db.delete(project)
    await db.commit()
    return True


def _to_detail(p: Project, chapter_count: int, total_word_count: int) -> ProjectDetail:
    return ProjectDetail(
        id=p.id,
        name=p.name,
        genre=p.genre,
        concept=p.concept,
        target_words=p.target_words,
        target_platform=p.target_platform,
        style_config=p.style_config or {},
        status=p.status,
        chapter_count=chapter_count,
        total_word_count=total_word_count,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )
