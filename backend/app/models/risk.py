from sqlalchemy import String, ForeignKey, Text, Integer, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime

class Risk(BaseModel):
    __tablename__ = "risks"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Source context
    source: Mapped[str] = mapped_column(String, default="MANUAL") # FINDING, ASSESSMENT, CONTROL, CSE, MANUAL
    source_reference: Mapped[str] = mapped_column(String, nullable=True) # e.g. "FND-2026-00001"
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True)
    
    # Foreign keys to source entities
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"), nullable=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=True)
    control_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("controls.id"), nullable=True)
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    
    # Scope & Tenancy
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    asset_or_system: Mapped[str] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String, default="Cybersecurity") # Cybersecurity, Operational, Compliance, Technology, Data Security, Access Control, Infrastructure, Third Party, Business Continuity, Privacy
    
    # Ownership & Governance
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    identified_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    accepted_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Inherent Risk Assessment (1-5 scoring)
    likelihood: Mapped[int] = mapped_column(Integer, default=3) # 1-5
    impact: Mapped[int] = mapped_column(Integer, default=3) # 1-5
    inherent_score: Mapped[int] = mapped_column(Integer, default=9) # likelihood * impact (1-25)
    inherent_risk_level: Mapped[str] = mapped_column(String, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    
    # Existing Controls Context
    existing_controls_description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Residual Risk Assessment (1-5 scoring after controls)
    residual_likelihood: Mapped[int] = mapped_column(Integer, nullable=True)
    residual_impact: Mapped[int] = mapped_column(Integer, nullable=True)
    residual_score: Mapped[int] = mapped_column(Integer, nullable=True) # residual_likelihood * residual_impact
    residual_risk_level: Mapped[str] = mapped_column(String, nullable=True) # LOW, MEDIUM, HIGH, CRITICAL
    
    # Treatment Strategy & Decisions
    treatment_strategy: Mapped[str] = mapped_column(String, nullable=True) # MITIGATE, ACCEPT, TRANSFER, AVOID
    treatment_owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    treatment_target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    treatment_description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Risk Acceptance Context
    acceptance_justification: Mapped[str] = mapped_column(Text, nullable=True)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    review_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Lifecycle Status
    status: Mapped[str] = mapped_column(String, default="IDENTIFIED") # IDENTIFIED, ASSESSED, TREATMENT_REQUIRED, TREATMENT_PLANNED, MONITORED, ACCEPTED, CLOSED
    
    # Relationships
    finding = relationship("Finding", foreign_keys=[finding_id], back_populates="risks")
    assessment = relationship("Assessment", foreign_keys=[assessment_id], back_populates="risks")
    control = relationship("Control", foreign_keys=[control_id], back_populates="risks")
    cse = relationship("CSE", foreign_keys=[cse_id])
    organization = relationship("Organization")
    sector = relationship("Sector")
    owner = relationship("User", foreign_keys=[owner_id])
    identified_by = relationship("User", foreign_keys=[identified_by_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_id])
    treatment_owner = relationship("User", foreign_keys=[treatment_owner_id])
    
    treatments = relationship("RiskTreatment", back_populates="risk", cascade="all, delete-orphan", order_by="RiskTreatment.created_at.desc()")
    exceptions = relationship("RiskException", back_populates="risk", cascade="all, delete-orphan", order_by="RiskException.created_at.desc()")
    remediations = relationship("Remediation", back_populates="risk")


class RiskTreatment(BaseModel):
    __tablename__ = "risk_treatments"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    risk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risks.id"))
    
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    strategy: Mapped[str] = mapped_column(String) # MITIGATE, ACCEPT, TRANSFER, AVOID
    status: Mapped[str] = mapped_column(String, default="PLANNED") # PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
    
    # Specific Treatment Context
    mitigation_actions: Mapped[str] = mapped_column(Text, nullable=True)
    transfer_details: Mapped[str] = mapped_column(Text, nullable=True) # Third-party vendor, insurance policy, etc.
    avoidance_details: Mapped[str] = mapped_column(Text, nullable=True) # Activity or system decommission
    justification: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Ownership & Dates
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    risk = relationship("Risk", back_populates="treatments")
    remediations = relationship("Remediation", back_populates="risk_treatment")
    owner = relationship("User", foreign_keys=[owner_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class RiskException(BaseModel):
    __tablename__ = "risk_exceptions"
    
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    risk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risks.id"))
    
    title: Mapped[str] = mapped_column(String)
    justification: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Governance & Ownership
    requested_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Dates
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Lifecycle
    status: Mapped[str] = mapped_column(String, default="REQUESTED") # REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, EXPIRED, CLOSED
    reviewer_comments: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Relationships
    risk = relationship("Risk", back_populates="exceptions")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    owner = relationship("User", foreign_keys=[owner_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
