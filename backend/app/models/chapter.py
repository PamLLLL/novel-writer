from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Chapter(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chapters"

    volume_id: Mapped[str] = mapped_column(String(36), ForeignKey("volumes.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    word_target: Mapped[int] = mapped_column(Integer, default=3000)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="pending")

    volume = relationship("Volume", back_populates="chapters")
    project = relationship("Project", back_populates="chapters")
    versions = relationship("Version", back_populates="chapter", cascade="all, delete-orphan")
