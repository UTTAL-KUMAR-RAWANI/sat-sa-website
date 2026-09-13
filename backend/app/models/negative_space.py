import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, ForeignKey, Text, Boolean, DateTime, Integer, Float, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import BaseModel


class NegativeSpaceAssessment(BaseModel):
    __tablename__ = "negative_space_assessments"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment_type: Mapped[str] = mapped_column(
        String, default="TELEMETRY_COVERAGE"
    )  # TELEMETRY_COVERAGE, AUTHENTICATION_BASELINE, SOURCE_SILENCE, ALERT_GAP, CUSTOM

    status: Mapped[str] = mapped_column(
        String, default="DRAFT"
    )  # DRAFT, CONFIGURED, RUNNING, COMPLETED, REVIEW_REQUIRED, CLOSED

    # Linkages
    dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True
    )
    analytics_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("analytics_runs.id", ondelete="SET NULL"), nullable=True
    )
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    sector_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("sectors.id"), nullable=True
    )
    initiated_by_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    # Time Windows
    baseline_window_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    baseline_window_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comparison_window_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comparison_window_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Definition & Execution Config
    configuration = mapped_column(JSONB, nullable=True)  # threshold_pct, min_observations, dimensions
    expected_activity_definition = mapped_column(JSONB, nullable=True)
    observed_activity_definition = mapped_column(JSONB, nullable=True)
    assessment_summary = mapped_column(JSONB, nullable=True)

    # Metrics
    gap_count: Mapped[int] = mapped_column(Integer, default=0)
    signal_count: Mapped[int] = mapped_column(Integer, default=0)
    potential_missed_threat_count: Mapped[int] = mapped_column(Integer, default=0)

    # Execution Lifecycle
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    dataset = relationship("Dataset")
    analytics_run = relationship("AnalyticsRun")
    organization = relationship("Organization")
    sector = relationship("Sector")
    initiated_by = relationship("User", foreign_keys=[initiated_by_id])
    signals = relationship(
        "NegativeSpaceSignal",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="NegativeSpaceSignal.created_at.desc()",
    )


class NegativeSpaceSignal(BaseModel):
    __tablename__ = "negative_space_signals"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("negative_space_assessments.id", ondelete="CASCADE"), nullable=False
    )

    # Category & Signal Semantics
    category: Mapped[str] = mapped_column(
        String
    )  # MONITORING_BLIND_SPOT, TELEMETRY_SILENCE, AUTHENTICATION_DEFICIT, ALERT_DEFICIT, CONTROL_ABSENCE, COVERAGE_DEGRADATION

    expected_activity = mapped_column(JSONB, nullable=True)
    observed_activity = mapped_column(JSONB, nullable=True)
    gap_description: Mapped[str] = mapped_column(Text)
    gap_percentage: Mapped[float] = mapped_column(Float, default=0.0)

    severity: Mapped[str] = mapped_column(
        String, default="MEDIUM"
    )  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: Mapped[str] = mapped_column(
        String, default="MEDIUM"
    )  # LOW, MEDIUM, HIGH

    # Temporal Context
    time_window_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    time_window_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Entity Attributes
    affected_asset: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    affected_user: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Supporting Evidence & Associations
    supporting_event_refs = mapped_column(JSONB, nullable=True)
    related_alert_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True
    )
    related_cse_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("cses.id", ondelete="SET NULL"), nullable=True
    )
    converted_finding_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )

    # Data Quality Safety Guard
    data_quality_concern: Mapped[bool] = mapped_column(Boolean, default=False)
    data_quality_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Human Review Lifecycle
    status: Mapped[str] = mapped_column(
        String, default="DETECTED"
    )  # DETECTED, REVIEWING, VALIDATED, DISMISSED, CONVERTED_TO_FINDING

    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dismissal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    assessment = relationship("NegativeSpaceAssessment", back_populates="signals")
    related_alert = relationship("Alert")
    related_cse = relationship("CSE")
    converted_finding = relationship("Finding")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
