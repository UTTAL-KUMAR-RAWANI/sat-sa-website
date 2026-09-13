"""
Pydantic schemas for Negative-Space Assessment and Signals.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class AssessmentConfig(BaseModel):
    volume_threshold_pct: float = Field(default=50.0, ge=1.0, le=100.0)
    silence_threshold_pct: float = Field(default=90.0, ge=1.0, le=100.0)
    auth_drop_threshold_pct: float = Field(default=60.0, ge=1.0, le=100.0)
    min_baseline_events: int = Field(default=5, ge=1)
    dimensions: List[str] = Field(
        default_factory=lambda: ["event_type", "source", "asset", "auth"]
    )


class NegativeSpaceAssessmentCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    assessment_type: str = Field(
        default="TELEMETRY_COVERAGE",
        description="TELEMETRY_COVERAGE, AUTHENTICATION_BASELINE, SOURCE_SILENCE, ALERT_GAP, CUSTOM",
    )
    dataset_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None

    baseline_window_start: Optional[datetime] = None
    baseline_window_end: Optional[datetime] = None
    comparison_window_start: Optional[datetime] = None
    comparison_window_end: Optional[datetime] = None

    configuration: Optional[AssessmentConfig] = None
    expected_activity_definition: Optional[Dict[str, Any]] = None


class NegativeSpaceAssessmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assessment_type: Optional[str] = None
    dataset_id: Optional[uuid.UUID] = None
    baseline_window_start: Optional[datetime] = None
    baseline_window_end: Optional[datetime] = None
    comparison_window_start: Optional[datetime] = None
    comparison_window_end: Optional[datetime] = None
    configuration: Optional[Dict[str, Any]] = None
    expected_activity_definition: Optional[Dict[str, Any]] = None


class NegativeSpaceAssessmentRunRequest(BaseModel):
    configuration: Optional[AssessmentConfig] = None
    recalculate_baseline: bool = True


# Signal Review & Action Schemas
class NegativeSpaceSignalReviewRequest(BaseModel):
    review_comments: str = Field(..., min_length=3, max_length=2000)


class NegativeSpaceSignalValidateRequest(BaseModel):
    notes: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")


class NegativeSpaceSignalDismissRequest(BaseModel):
    dismissal_reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Mandatory justification for dismissing this negative space signal.",
    )


class NegativeSpaceSignalConvertFindingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    priority: Optional[str] = Field("MEDIUM", pattern="^(P1|P2|P3|P4|LOW|MEDIUM|HIGH|CRITICAL)$")
    remediation_required: bool = True
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[uuid.UUID] = None


class NegativeSpaceSignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    assessment_id: uuid.UUID
    category: str
    gap_description: str
    gap_percentage: float
    severity: str
    confidence: str

    expected_activity: Optional[Dict[str, Any]] = None
    observed_activity: Optional[Dict[str, Any]] = None

    time_window_start: Optional[datetime] = None
    time_window_end: Optional[datetime] = None
    affected_asset: Optional[str] = None
    affected_user: Optional[str] = None
    source: Optional[str] = None

    supporting_event_refs: Optional[Dict[str, Any]] = None
    related_alert_id: Optional[uuid.UUID] = None
    related_cse_id: Optional[uuid.UUID] = None
    converted_finding_id: Optional[uuid.UUID] = None

    data_quality_concern: bool = False
    data_quality_notes: Optional[str] = None

    status: str
    reviewed_by_id: Optional[uuid.UUID] = None
    review_comments: Optional[str] = None
    dismissal_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class NegativeSpaceAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    name: str
    description: Optional[str] = None
    assessment_type: str
    status: str

    dataset_id: Optional[uuid.UUID] = None
    analytics_run_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    initiated_by_id: uuid.UUID

    baseline_window_start: Optional[datetime] = None
    baseline_window_end: Optional[datetime] = None
    comparison_window_start: Optional[datetime] = None
    comparison_window_end: Optional[datetime] = None

    configuration: Optional[Dict[str, Any]] = None
    expected_activity_definition: Optional[Dict[str, Any]] = None
    observed_activity_definition: Optional[Dict[str, Any]] = None
    assessment_summary: Optional[Dict[str, Any]] = None

    gap_count: int = 0
    signal_count: int = 0
    potential_missed_threat_count: int = 0
    completed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class NegativeSpaceAssessmentDetailRead(NegativeSpaceAssessmentRead):
    signals: List[NegativeSpaceSignalRead] = []


class NegativeSpaceAssessmentListResponse(BaseModel):
    items: List[NegativeSpaceAssessmentRead]
    total: int
    skip: int
    limit: int


class NegativeSpaceSignalListResponse(BaseModel):
    items: List[NegativeSpaceSignalRead]
    total: int
    skip: int
    limit: int


class NegativeSpaceKPIsResponse(BaseModel):
    total_assessments: int
    total_signals: int
    active_signals: int
    validated_signals: int
    dismissed_signals: int
    converted_to_findings: int
    high_critical_signals: int
    data_quality_concerns: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
