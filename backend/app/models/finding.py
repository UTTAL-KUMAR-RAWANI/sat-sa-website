from sqlalchemy import String, ForeignKey, Text, Boolean, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime

class Finding(BaseModel):
    __tablename__ = "findings"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="MEDIUM")
    priority: Mapped[str] = mapped_column(String, default="MEDIUM")
    status: Mapped[str] = mapped_column(String, default="IDENTIFIED")
    classification: Mapped[str] = mapped_column(String, default="Security")
    source_type: Mapped[str] = mapped_column(String)  # CSE, INVESTIGATION, ASSESSMENT, AUDIT, RISK_ANALYSIS, NEGATIVE_SPACE, SUPERVISORY_REVIEW
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True)
    
    # Explicit source / domain linkages
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    investigation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("investigations.id"), nullable=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=True)
    control_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("controls.id"), nullable=True)
    
    # Scope & Tenancy
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    
    # Ownership & Governance
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    remediation_required: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    organization = relationship("Organization")
    sector = relationship("Sector")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    
    cse = relationship("CSE", foreign_keys=[cse_id])
    investigation = relationship("Investigation", foreign_keys=[investigation_id])
    assessment = relationship("Assessment", foreign_keys=[assessment_id], back_populates="findings")
    control = relationship("Control", foreign_keys=[control_id], back_populates="findings")
    
    evidence = relationship("Evidence", back_populates="finding")
    comments = relationship("FindingComment", back_populates="finding", cascade="all, delete-orphan", order_by="FindingComment.created_at.desc()")
    risks = relationship("Risk", back_populates="finding")
    remediations = relationship("Remediation", back_populates="finding")


class FindingComment(BaseModel):
    __tablename__ = "finding_comments"
    
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    comment: Mapped[str] = mapped_column(Text)
    comment_type: Mapped[str] = mapped_column(String, default="GENERAL_COMMENT")  # REVIEW_NOTE, CHANGE_REQUEST, DECISION_NOTE, GENERAL_COMMENT
    
    finding = relationship("Finding", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
