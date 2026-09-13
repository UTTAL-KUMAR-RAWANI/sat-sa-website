from sqlalchemy import String, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime

class Assessment(BaseModel):
    __tablename__ = "assessments"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    assessment_type: Mapped[str] = mapped_column(String, default="SECURITY_CONTROL_ASSESSMENT")
    status: Mapped[str] = mapped_column(String, default="DRAFT")
    priority: Mapped[str] = mapped_column(String, default="MEDIUM")
    scope: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Tenancy & Scope
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    
    # Source / Security Event Links
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    investigation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("investigations.id"), nullable=True)
    
    # Ownership & Governance
    assessor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Dates
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization")
    sector = relationship("Sector")
    cse = relationship("CSE")
    investigation = relationship("Investigation")
    assessor = relationship("User", foreign_keys=[assessor_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    
    assessment_controls = relationship("AssessmentControl", back_populates="assessment", cascade="all, delete-orphan")
    findings = relationship("Finding", foreign_keys="Finding.assessment_id", back_populates="assessment")
    evidence = relationship("Evidence", back_populates="assessment")
    risks = relationship("Risk", foreign_keys="Risk.assessment_id", back_populates="assessment")


class AssessmentControl(BaseModel):
    __tablename__ = "assessment_controls"
    
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"))
    control_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("controls.id"))
    evaluator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"), nullable=True)
    
    status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    effectiveness: Mapped[str] = mapped_column(String, default="NOT_ASSESSED")
    evaluation_notes: Mapped[str] = mapped_column(Text, nullable=True)
    reviewer_comments: Mapped[str] = mapped_column(Text, nullable=True)
    evidence: Mapped[str] = mapped_column(Text, nullable=True)
    
    evidence_required: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    assessment = relationship("Assessment", back_populates="assessment_controls")
    control = relationship("Control", back_populates="assessment_controls")
    evaluator = relationship("User", foreign_keys=[evaluator_id])
    finding = relationship("Finding", foreign_keys=[finding_id])
