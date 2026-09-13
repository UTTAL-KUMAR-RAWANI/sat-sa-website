"""
REST API Router for CISO & Senior Management Executive Dashboards.
Base prefix: /executive
"""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.identity import User
from app.rbac.deps import require_permission, require_any_permission, get_effective_scope
from app.rbac import permissions as p
from app.executive.schemas import (
    CISOSummaryResponse,
    ManagementSummaryResponse,
    ExecutiveRiskOverview,
    ExecutiveFindingsOverview,
    ExecutiveRemediationOverview,
    ExecutiveAssessmentOverview,
    ExecutiveNegativeSpaceOverview,
    ExecutiveSupervisionOverview,
    ExecutiveTrendsResponse,
    ExecutiveComparisonResponse,
)
from app.executive.service import ExecutiveService

executive_router = APIRouter(prefix="/executive", tags=["Executive Dashboards"])


# =============================================================================
# CISO LEADERSHIP DASHBOARD ENDPOINTS
# =============================================================================

@executive_router.get(
    "/ciso/summary",
    response_model=CISOSummaryResponse,
    summary="Get CISO summary with explainable posture score and prioritized attention items",
)
def get_ciso_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_summary(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/risks",
    response_model=ExecutiveRiskOverview,
    summary="Get comprehensive CISO risk overview and distribution",
)
def get_ciso_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_risks(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/findings",
    response_model=ExecutiveFindingsOverview,
    summary="Get high-value critical and aging findings breakdown",
)
def get_ciso_findings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_findings(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/remediation",
    response_model=ExecutiveRemediationOverview,
    summary="Get remediation pipeline health, completion rate, and overdue status",
)
def get_ciso_remediation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_remediation(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/assessments",
    response_model=ExecutiveAssessmentOverview,
    summary="Get assessment compliance progress and control effectiveness summary",
)
def get_ciso_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_assessments(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/negative-space",
    response_model=ExecutiveNegativeSpaceOverview,
    summary="Get executive summary of negative-space assessments and detection coverage gaps",
)
def get_ciso_negative_space(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_negative_space(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/supervision",
    response_model=ExecutiveSupervisionOverview,
    summary="Get supervisory cases, critical escalations, and pending decisions",
)
def get_ciso_supervision(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_supervision(db, current_user, effective_scope)


@executive_router.get(
    "/ciso/trends",
    response_model=ExecutiveTrendsResponse,
    summary="Get real 7d/30d/90d time-series trends without artificial data fabrication",
)
def get_ciso_trends(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_CISO_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_trends(db, current_user, effective_scope, days=days)


# =============================================================================
# SENIOR MANAGEMENT DASHBOARD ENDPOINTS
# =============================================================================

@executive_router.get(
    "/management/summary",
    response_model=ManagementSummaryResponse,
    summary="Get high-level Senior Management business risk and executive posture summary",
)
def get_management_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_MANAGEMENT_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_management_summary(db, current_user, effective_scope)


@executive_router.get(
    "/management/risks",
    response_model=ExecutiveRiskOverview,
    summary="Get high-level strategic business risk overview",
)
def get_management_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_MANAGEMENT_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_risks(db, current_user, effective_scope)


@executive_router.get(
    "/management/remediation",
    response_model=ExecutiveRemediationOverview,
    summary="Get strategic remediation progress and completion percentages",
)
def get_management_remediation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_MANAGEMENT_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_ciso_remediation(db, current_user, effective_scope)


@executive_router.get(
    "/management/issues",
    summary="Get prioritized major issues requiring executive leadership awareness",
)
def get_management_issues(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_MANAGEMENT_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_attention_required(db, current_user, effective_scope, limit=10)


@executive_router.get(
    "/management/trends",
    response_model=ExecutiveTrendsResponse,
    summary="Get high-level trend analysis for Senior Management",
)
def get_management_trends(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_MANAGEMENT_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_trends(db, current_user, effective_scope, days=days)


# =============================================================================
# CROSS-ORGANIZATIONAL / SECTOR COMPARISON
# =============================================================================

@executive_router.get(
    "/comparison",
    response_model=ExecutiveComparisonResponse,
    summary="Get comparative security posture metrics across organizations and sectors within scope",
)
def get_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(p.EXECUTIVE_CISO_READ, p.EXECUTIVE_MANAGEMENT_READ)
    ),
    effective_scope: str = Depends(get_effective_scope),
):
    return ExecutiveService.get_comparison(db, current_user, effective_scope)


# =============================================================================
# EXECUTIVE CSV EXPORT WITH AUDIT LOGGING
# =============================================================================

@executive_router.get(
    "/export",
    summary="Export executive summary as CSV with mandatory audit logging",
)
def export_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EXECUTIVE_EXPORT)),
    effective_scope: str = Depends(get_effective_scope),
):
    csv_data = ExecutiveService.export_summary_csv(db, current_user, effective_scope)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sat_sa_executive_summary.csv"},
    )
