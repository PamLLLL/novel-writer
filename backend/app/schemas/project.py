from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    genre: str = ""
    concept: str = ""
    target_words: int = 200000
    target_platform: str = ""
    style_config: dict = {}


class ProjectUpdate(BaseModel):
    name: str | None = None
    genre: str | None = None
    concept: str | None = None
    target_words: int | None = None
    target_platform: str | None = None
    style_config: dict | None = None
    status: str | None = None


class ProjectSummary(BaseModel):
    id: str
    name: str
    genre: str
    concept: str
    target_words: int
    target_platform: str
    status: str
    chapter_count: int = 0
    total_word_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetail(ProjectSummary):
    style_config: dict = {}
