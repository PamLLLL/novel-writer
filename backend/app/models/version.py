from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, _utcnow


class Version(Base, UUIDMixin):
    __tablename__ = "versions"

    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    operation_type: Mapped[str] = mapped_column(String(50), default="auto_save")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, server_default=func.now())

    chapter = relationship("Chapter", back_populates="versions")
