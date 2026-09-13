"""
Pydantic schemas for CISO & Senior Management Executive Dashboards.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class PostureScoreBreakdown(BaseModel):
    score: Optional[int] = Field(
        None,
        description="Overall security posture score from 0 to 100, or None if insufficient data exists.",
    )
    risk_health: int = Field(..., ge=0, le=100)
    findings_health: int = Field(..., ge=0, le=100)
    remediation_health: int = Field(..., ge=0, le=100)
    assessment_health: int = Field(..., ge=0, le=100)
    detection_health: int = Field(..., ge=0, le=100)
    weights: Dict[str, float]
    status: str  # OPTIMAL, STABLE, ELEVATED_RISK, CRITICAL_EXPOSURE, INSUFFICIENT_DATA
    description: str
    formula: str


class AttentionRequiredItem(BaseModel):
    id: str
    type: str  # CRITICAL_RISK, CRITICAL_FINDING, OVERDUE_REMEDIATION, DETECTION_GAP, SUPERVISORY_DECISION
    business_id: str
    title: str
    severity: str
    age_days: Optional[int] = None
    owner: Optional[str] = None
    status: str
    required_action: str
    link_url: str


class CISOSummaryKPIs(BaseModel):
    critical_cses: int
    high_critical_findings: int
    critical_risks: int
    open_remediations: int
    overdue_remediations: int
    active_supervisory_cases: int
    high_critical_signals: int


class CISOSummaryResponse(BaseModel):
    posture: PostureScoreBreakdown
    kpis: CISOSummaryKPIs
    attention_required: List[AttentionRequiredItem]
    last_updated: datetime


class ManagementSummaryKPIs(BaseModel):
    overall_risk_exposure: str
    critical_risks: int
    high_critical_findings: int
    critical_open_issues: int
    overdue_critical_remediation: int
    open_risk_exceptions: int
    active_supervisory_cases: int
    pending_executive_decisions: int


class ManagementSummaryResponse(BaseModel):
    posture: PostureScoreBreakdown
    kpis: ManagementSummaryKPIs
    remediation_progress_pct: float
    major_issues: List[AttentionRequiredItem]
    last_updated: datetime


class ExecutiveRiskOverview(BaseModel):
    by_level: Dict[str, int]
    requiring_treatment: int
    accepted_risks: int
    open_exceptions: int
    overdue_reviews: int
    by_category: Dict[str, int]
    by_organization: Dict[str, int]
    by_sector: Dict[str, int]


class ExecutiveFindingsOverview(BaseModel):
    by_severity: Dict[str, int]
    aging_over_30d: int
    aging_over_60d: int
    requiring_remediation: int
    linked_to_critical_risks: int
    negative_space_findings: int


class ExecutiveRemediationOverview(BaseModel):
    by_status: Dict[str, int]
    completion_rate_pct: float
    overdue_count: int
    blocked_count: int
    critical_high_count: int
    average_age_days: Optional[float] = None


class ExecutiveAssessmentOverview(BaseModel):
    assessments_completed: int
    assessments_in_progress: int
    assessments_under_review: int
    changes_requested: int
    overdue_assessments: int
    control_effectiveness: Dict[str, int]  # EFFECTIVE, PARTIALLY_EFFECTIVE, INEFFECTIVE, NOT_ASSESSED


class ExecutiveNegativeSpaceOverview(BaseModel):
    assessments_run: int
    coverage_gaps_count: int
    high_critical_signals: int
    signals_under_review: int
    validated_signals: int
    converted_to_findings: int


class ExecutiveSupervisionOverview(BaseModel):
    open_cases: int
    critical_escalations: int
    pending_decisions: int
    cases_awaiting_review: int
    cases_under_monitoring: int
    recent_decisions: List[Dict[str, Any]]


class ExecutiveTrendsResponse(BaseModel):
    period_days: int
    insufficient_data: bool
    message: Optional[str] = None
    dates: List[str]
    cses: List[int]
    findings: List[int]
    risks: List[int]
    remediations_completed: List[int]
    negative_space_signals: List[int]
    supervisory_escalations: List[int]


class ExecutiveComparisonResponse(BaseModel):
    organizations: List[Dict[str, Any]]
    sectors: List[Dict[str, Any]]
