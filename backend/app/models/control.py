from sqlalchemy import String, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid

class Control(BaseModel):
    __tablename__ = "controls"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
    
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    
    findings = relationship("Finding", back_populates="control")
    assessment_controls = relationship("AssessmentControl", back_populates="control")
    evidence_items = relationship("Evidence", back_populates="control")
    risks = relationship("Risk", foreign_keys="Risk.control_id", back_populates="control")
    remediations = relationship("Remediation", back_populates="control")



