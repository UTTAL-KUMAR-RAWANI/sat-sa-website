from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid

class AccessRequest(BaseModel):
    __tablename__ = "access_requests"
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    requested_role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=True)
    requested_organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    requested_sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    reason: Mapped[str] = mapped_column(String, nullable=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    requester = relationship("User", foreign_keys=[requester_id])
    requested_role = relationship("Role", foreign_keys=[requested_role_id])
    requested_organization = relationship("Organization", foreign_keys=[requested_organization_id])
    requested_sector = relationship("Sector", foreign_keys=[requested_sector_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
