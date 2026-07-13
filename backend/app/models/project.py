from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    genre: Mapped[str] = mapped_column(String(100), default="")
    concept: Mapped[str] = mapped_column(Text, default="")
    target_words: Mapped[int] = mapped_column(Integer, default=200000)
    target_platform: Mapped[str] = mapped_column(String(100), default="")
    style_config: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(50), default="created")

    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    worldview = relationship("Worldview", back_populates="project", uselist=False, cascade="all, delete-orphan")
    outline = relationship("Outline", back_populates="project", uselist=False, cascade="all, delete-orphan")
    volumes = relationship("Volume", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    knowledge_graph = relationship("KnowledgeGraph", back_populates="project", uselist=False, cascade="all, delete-orphan")
    quality_reports = relationship("QualityReport", back_populates="project", cascade="all, delete-orphan")
