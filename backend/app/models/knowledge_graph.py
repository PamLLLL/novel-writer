from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, _utcnow


class KnowledgeGraph(Base, UUIDMixin):
    __tablename__ = "knowledge_graphs"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    characters_state: Mapped[dict] = mapped_column(JSON, default=dict)
    plot_hooks: Mapped[list] = mapped_column(JSON, default=list)
    timeline: Mapped[list] = mapped_column(JSON, default=list)
    items: Mapped[list] = mapped_column(JSON, default=list)
    rules: Mapped[list] = mapped_column(JSON, default=list)
    last_updated_chapter_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow, server_default=func.now())

    project = relationship("Project", back_populates="knowledge_graph")
