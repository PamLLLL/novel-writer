from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, _utcnow


class GlobalSettings(Base):
    __tablename__ = "global_settings"
    __table_args__ = (CheckConstraint("id = 1", name="singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    api_keys: Mapped[dict] = mapped_column(JSON, default=dict)
    default_provider: Mapped[str] = mapped_column(String(50), default="anthropic")
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow, server_default=func.now())
