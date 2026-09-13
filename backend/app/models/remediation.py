from sqlalchemy import String, ForeignKey, Text, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
from datetime import datetime
import uuid

class Remediation(BaseModel):
    __tablename__ = "remediations"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String, default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW
    status: Mapped[str] = mapped_column(String, default="OPEN")     # OPEN, ASSIGNED, IN_PROGRESS, BLOCKED, EVIDENCE_SUBMITTED, VALIDATION, VERIFIED, CLOSED

    # Corrective Action & Implementation Plan
    corrective_action: Mapped[str] = mapped_column(Text, nullable=True)
    root_cause: Mapped[str] = mapped_column(Text, nullable=True)
    implementation_steps: Mapped[str] = mapped_column(Text, nullable=True)
    expected_outcome: Mapped[str] = mapped_column(Text, nullable=True)
    completion_criteria: Mapped[str] = mapped_column(Text, nullable=True)
    dependencies: Mapped[str] = mapped_column(Text, nullable=True)
    required_evidence_types: Mapped[str] = mapped_column(Text, nullable=True)

    # Source Traceability
    source: Mapped[str] = mapped_column(String, default="FINDING") # FINDING, RISK, ASSESSMENT, MANUAL
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True)

    # Linked Entities
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"), nullable=True)
    risk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risks.id"), nullable=True)
    risk_treatment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risk_treatments.id"), nullable=True)
    control_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("controls.id"), nullable=True)

    # Scope & Tenancy
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)

    # Ownership & Assignment
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_team: Mapped[str] = mapped_column(String, nullable=True) # e.g. "IT Infrastructure Team"
    assigned_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Dates & Timestamps
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Blocked State Context
    blocked_reason: Mapped[str] = mapped_column(Text, nullable=True)
    blocked_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    blocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Validation & Verification Governance
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    validator_comments: Mapped[str] = mapped_column(Text, nullable=True)
    validation_decision: Mapped[str] = mapped_column(String, nullable=True) # VERIFIED, RETURNED_FOR_CORRECTION

    # Closure
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Relationships
    finding = relationship("Finding", back_populates="remediations")
    risk = relationship("Risk", back_populates="remediations")
    risk_treatment = relationship("RiskTreatment", back_populates="remediations")
    control = relationship("Control", foreign_keys=[control_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    sector = relationship("Sector", foreign_keys=[sector_id])

    owner = relationship("User", foreign_keys=[owner_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    blocked_by = relationship("User", foreign_keys=[blocked_by_id])

    evidence_items = relationship("Evidence", back_populates="remediation", cascade="all, delete-orphan", order_by="Evidence.created_at.desc()")
    legacy_evidence = relationship("RemediationEvidence", back_populates="remediation")


class RemediationEvidence(BaseModel):
    __tablename__ = "remediation_evidence"
    description: Mapped[str] = mapped_column(Text)
    file_uri: Mapped[str] = mapped_column(String, nullable=True)

    remediation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("remediations.id"))
    remediation = relationship("Remediation", back_populates="legacy_evidence")
