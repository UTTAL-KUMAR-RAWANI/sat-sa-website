import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, Text, Boolean, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class Notification(BaseModel):
    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String, default="NORMAL", index=True)  # LOW, NORMAL, HIGH, CRITICAL
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    resource_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True, index=True)
    business_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    action_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    recipient = relationship("User", foreign_keys=[recipient_id])
