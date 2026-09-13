from sqlalchemy import String, ForeignKey, Text, DateTime, BigInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime
from typing import Optional

class SecurityEvent(BaseModel):
    __tablename__ = "security_events"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String, default="GENERIC")
    source: Mapped[str] = mapped_column(String, default="SIEM")
    source_system: Mapped[str] = mapped_column(String, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="MEDIUM")
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Dataset Ingestion Linkage
    dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("datasets.id"), nullable=True, index=True)
    dataset_import_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("dataset_imports.id"), nullable=True, index=True)
    external_event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occurred_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    
    # Canonical Security Event Attributes
    source_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    destination_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    asset_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_identifier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="OBSERVED")
    
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    raw_metadata = mapped_column(JSONB, nullable=True)
    
    organization = relationship("Organization")
    sector = relationship("Sector")
    dataset = relationship("Dataset", back_populates="security_events")
    dataset_import = relationship("DatasetImport", back_populates="security_events")
    alerts = relationship("Alert", back_populates="security_event")

class Alert(BaseModel):
    __tablename__ = "alerts"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="MEDIUM")
    priority: Mapped[str] = mapped_column(String, default="P3")
    status: Mapped[str] = mapped_column(String, default="NEW")
    source: Mapped[str] = mapped_column(String, default="SIEM")
    
    security_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("security_events.id"), nullable=True)
    security_event = relationship("SecurityEvent", back_populates="alerts")
    
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    cse = relationship("CSE", back_populates="alerts")
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    triage_notes: Mapped[str] = mapped_column(Text, nullable=True)
    triage_decision: Mapped[str] = mapped_column(String, nullable=True)
    triaged_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    triaged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    organization = relationship("Organization")
    sector = relationship("Sector")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    triaged_by = relationship("User", foreign_keys=[triaged_by_id])

class CSE(BaseModel):
    __tablename__ = "cses"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="MEDIUM")
    priority: Mapped[str] = mapped_column(String, default="P3")
    status: Mapped[str] = mapped_column(String, default="NEW")
    source: Mapped[str] = mapped_column(String, default="ALERT")
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    organization = relationship("Organization")
    sector = relationship("Sector")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    
    alerts = relationship("Alert", back_populates="cse")
    investigations = relationship("Investigation", back_populates="cse")
    evidence = relationship("Evidence", back_populates="cse")

class Investigation(BaseModel):
    __tablename__ = "investigations"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="OPEN")
    
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"))
    cse = relationship("CSE", back_populates="investigations")
    
    lead_analyst_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    lead_analyst = relationship("User", foreign_keys=[lead_analyst_id])
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    findings_summary: Mapped[str] = mapped_column(Text, nullable=True)
    
    evidence = relationship("Evidence", back_populates="investigation")

class Evidence(BaseModel):
    __tablename__ = "evidence"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    evidence_type: Mapped[str] = mapped_column(String, default="LOG")
    source: Mapped[str] = mapped_column(String, nullable=True)
    
    file_uri: Mapped[str] = mapped_column(String, nullable=True)
    filename: Mapped[str] = mapped_column(String, nullable=True)
    content_type: Mapped[str] = mapped_column(String, nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=True)
    checksum: Mapped[str] = mapped_column(String, nullable=True)
    
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    
    cse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cses.id"), nullable=True)
    cse = relationship("CSE", back_populates="evidence")
    
    investigation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("investigations.id"), nullable=True)
    investigation = relationship("Investigation", back_populates="evidence")
    
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("findings.id"), nullable=True)
    finding = relationship("Finding", back_populates="evidence")
    
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=True)
    assessment = relationship("Assessment", back_populates="evidence")
    
    control_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("controls.id"), nullable=True)
    control = relationship("Control", back_populates="evidence_items")

    remediation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("remediations.id"), nullable=True)
    remediation = relationship("Remediation", back_populates="evidence_items")
    
    verification_status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING, VERIFIED, REJECTED, CHANGES_REQUIRED
    verified_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewer_comments: Mapped[str] = mapped_column(Text, nullable=True)
