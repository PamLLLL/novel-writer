from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Worldview(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "worldviews"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    content: Mapped[dict] = mapped_column(JSON, default=dict)

    project = relationship("Project", back_populates="worldview")
