import uuid
from typing import Optional
from sqlalchemy import String, ForeignKey, Uuid, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, index=True)
    resource_type: Mapped[str] = mapped_column(String, index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True, index=True)
    business_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    old_value = mapped_column(JSONB, nullable=True)
    new_value = mapped_column(JSONB, nullable=True)
    metadata_json = mapped_column(JSONB, nullable=True)

    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    sector_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sectors.id"), nullable=True, index=True)

    # Relationships
    actor_user = relationship("User", foreign_keys=[actor_user_id])
    organization = relationship("Organization")
    sector = relationship("Sector")
