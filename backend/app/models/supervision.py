from sqlalchemy import String, ForeignKey, Text, Uuid, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime

class SupervisoryCase(BaseModel):
    __tablename__ = "supervisory_cases"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)  # SUP-2026-00001
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String, default="HIGH")  # LOW, MEDIUM, HIGH, CRITICAL
    status: Mapped[str] = mapped_column(String, default="OPEN")
    # OPEN, ASSIGNED, UNDER_REVIEW, RECOMMENDATION_READY, AUTHORITY_REVIEW, DECISION_REQUIRED, ACTION_REQUIRED, MONITORING, CLOSED
    trigger_type: Mapped[str] = mapped_column(String, default="MANUAL_ESCALATION")
    # CRITICAL_CSE, HIGH_FINDING, CRITICAL_RISK, OVERDUE_REMEDIATION, SLA_BREACH, REPEATED_FAILURE, MANUAL_ESCALATION
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_analyst_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    supervisory_authority_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Source entity links
    source_cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    source_finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"), nullable=True)
    source_risk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risks.id"), nullable=True)
    source_remediation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("remediations.id"), nullable=True)
    source_assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=True)
    
    # Workflow & Analysis fields
    analyst_notes: Mapped[str] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=True)
    recommendation_submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    final_decision: Mapped[str] = mapped_column(String, nullable=True)
    # CLOSE, CONTINUE_MONITORING, REQUIRE_ACTION, ESCALATE, ACCEPT_RISK, REQUEST_REVIEW
    decision_reason: Mapped[str] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization")
    sector = relationship("Sector")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_analyst = relationship("User", foreign_keys=[assigned_analyst_id])
    supervisory_authority = relationship("User", foreign_keys=[supervisory_authority_id])
    decided_by = relationship("User", foreign_keys=[decided_by_id])
    
    source_cse = relationship("CSE", foreign_keys=[source_cse_id])
    source_finding = relationship("Finding", foreign_keys=[source_finding_id])
    source_risk = relationship("Risk", foreign_keys=[source_risk_id])
    source_remediation = relationship("Remediation", foreign_keys=[source_remediation_id])
    source_assessment = relationship("Assessment", foreign_keys=[source_assessment_id])
    
    escalations = relationship("Escalation", back_populates="supervisory_case")
    decisions = relationship("SupervisoryDecision", back_populates="supervisory_case", cascade="all, delete-orphan")


class SupervisoryDecision(BaseModel):
    __tablename__ = "supervisory_decisions"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)  # DEC-2026-00001
    supervisory_case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supervisory_cases.id"))
    
    decision_type: Mapped[str] = mapped_column(String)  # CLOSE, CONTINUE_MONITORING, REQUIRE_ACTION, ESCALATE, ACCEPT_RISK, REQUEST_REVIEW
    status: Mapped[str] = mapped_column(String, default="DRAFT")  # DRAFT, SUBMITTED, APPROVED, ACTIVE, COMPLETED
    
    decision_maker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    rationale: Mapped[str] = mapped_column(Text)
    conditions: Mapped[str] = mapped_column(Text, nullable=True)
    action_required: Mapped[str] = mapped_column(Text, nullable=True)
    
    effective_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    review_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    
    # Relationships
    supervisory_case = relationship("SupervisoryCase", back_populates="decisions")
    decision_maker = relationship("User", foreign_keys=[decision_maker_id])
    organization = relationship("Organization")
    sector = relationship("Sector")
