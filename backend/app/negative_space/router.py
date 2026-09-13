"""
REST API Router for Negative-Space Assessment and Signals.
Base prefix: /negative-space
"""

from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid

from app.core.database import get_db
from app.models.identity import User
from app.rbac.deps import require_permission, require_any_permission, get_effective_scope
from app.rbac import permissions as p
from app.negative_space.schemas import (
    NegativeSpaceAssessmentCreate,
    NegativeSpaceAssessmentUpdate,
    NegativeSpaceAssessmentRunRequest,
    NegativeSpaceAssessmentRead,
    NegativeSpaceAssessmentDetailRead,
    NegativeSpaceAssessmentListResponse,
    NegativeSpaceSignalRead,
    NegativeSpaceSignalListResponse,
    NegativeSpaceSignalReviewRequest,
    NegativeSpaceSignalValidateRequest,
    NegativeSpaceSignalDismissRequest,
    NegativeSpaceSignalConvertFindingRequest,
    NegativeSpaceKPIsResponse,
)
from app.negative_space.service import NegativeSpaceService

negative_space_router = APIRouter(prefix="/negative-space", tags=["Negative-Space Assessment"])


# =============================================================================
# KPIs / METRICS
# =============================================================================

@negative_space_router.get(
    "/kpis",
    response_model=NegativeSpaceKPIsResponse,
    summary="Get aggregated KPIs for Negative-Space Assessments and Signals",
)
def get_negative_space_kpis(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.get_kpis(db, current_user, effective_scope)


# =============================================================================
# ASSESSMENTS
# =============================================================================

@negative_space_router.post(
    "/assessments",
    response_model=NegativeSpaceAssessmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Negative-Space Assessment specification",
)
def create_assessment(
    req: NegativeSpaceAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_CREATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.create_assessment(db, req, current_user, effective_scope)


@negative_space_router.get(
    "/assessments",
    response_model=NegativeSpaceAssessmentListResponse,
    summary="List all Negative-Space Assessments in user scope",
)
def list_assessments(
    status_filter: Optional[str] = Query(None, alias="status"),
    assessment_type: Optional[str] = Query(None),
    dataset_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    items, total = NegativeSpaceService.list_assessments(
        db=db,
        current_user=current_user,
        effective_scope=effective_scope,
        status_filter=status_filter,
        assessment_type=assessment_type,
        dataset_id=dataset_id,
        search=search,
        skip=skip,
        limit=limit,
    )
    return NegativeSpaceAssessmentListResponse(items=items, total=total, skip=skip, limit=limit)


@negative_space_router.get(
    "/assessments/{assessment_id}",
    response_model=NegativeSpaceAssessmentDetailRead,
    summary="Get assessment details by ID",
)
def get_assessment(
    assessment_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.get_assessment(db, assessment_id, current_user, effective_scope)


@negative_space_router.patch(
    "/assessments/{assessment_id}",
    response_model=NegativeSpaceAssessmentRead,
    summary="Update assessment configuration or metadata",
)
def update_assessment(
    assessment_id: uuid.UUID = Path(...),
    req: NegativeSpaceAssessmentUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_CREATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.update_assessment(db, assessment_id, req, current_user, effective_scope)


@negative_space_router.post(
    "/assessments/{assessment_id}/run",
    response_model=NegativeSpaceAssessmentRead,
    summary="Execute Negative-Space assessment rule comparison against telemetry",
)
def run_assessment(
    assessment_id: uuid.UUID = Path(...),
    req: Optional[NegativeSpaceAssessmentRunRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_RUN)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.run_assessment(db, assessment_id, req, current_user, effective_scope)


# =============================================================================
# SIGNALS (HUMAN REVIEW WORKSPACE)
# =============================================================================

@negative_space_router.get(
    "/signals",
    response_model=NegativeSpaceSignalListResponse,
    summary="List Negative-Space Signals with multi-dimensional filtering",
)
def list_signals(
    assessment_id: Optional[uuid.UUID] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    data_quality_concern: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_SIGNAL_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    items, total = NegativeSpaceService.list_signals(
        db=db,
        current_user=current_user,
        effective_scope=effective_scope,
        assessment_id=assessment_id,
        category=category,
        severity=severity,
        status_filter=status_filter,
        data_quality_concern=data_quality_concern,
        search=search,
        skip=skip,
        limit=limit,
    )
    return NegativeSpaceSignalListResponse(items=items, total=total, skip=skip, limit=limit)


@negative_space_router.get(
    "/signals/{signal_id}",
    response_model=NegativeSpaceSignalRead,
    summary="Get detailed signal record and review status",
)
def get_signal(
    signal_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_SIGNAL_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.get_signal(db, signal_id, current_user, effective_scope)


@negative_space_router.post(
    "/signals/{signal_id}/review",
    response_model=NegativeSpaceSignalRead,
    summary="Start analyst review or append review notes",
)
def review_signal(
    signal_id: uuid.UUID = Path(...),
    req: NegativeSpaceSignalReviewRequest = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_SIGNAL_REVIEW)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.review_signal(db, signal_id, req, current_user, effective_scope)


@negative_space_router.post(
    "/signals/{signal_id}/validate",
    response_model=NegativeSpaceSignalRead,
    summary="Validate signal as a genuine negative-space gap",
)
def validate_signal(
    signal_id: uuid.UUID = Path(...),
    req: NegativeSpaceSignalValidateRequest = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_SIGNAL_VALIDATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.validate_signal(db, signal_id, req, current_user, effective_scope)


@negative_space_router.post(
    "/signals/{signal_id}/dismiss",
    response_model=NegativeSpaceSignalRead,
    summary="Dismiss signal with mandatory justification",
)
def dismiss_signal(
    signal_id: uuid.UUID = Path(...),
    req: NegativeSpaceSignalDismissRequest = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_SIGNAL_DISMISS)),
    effective_scope: str = Depends(get_effective_scope),
):
    return NegativeSpaceService.dismiss_signal(db, signal_id, req, current_user, effective_scope)


@negative_space_router.post(
    "/signals/{signal_id}/convert-finding",
    summary="Convert validated negative-space signal into a formal Finding",
)
def convert_signal_to_finding(
    signal_id: uuid.UUID = Path(...),
    req: NegativeSpaceSignalConvertFindingRequest = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.NEGATIVE_SPACE_CONVERT_FINDING)),
    effective_scope: str = Depends(get_effective_scope),
):
    signal, finding = NegativeSpaceService.convert_signal_to_finding(
        db, signal_id, req, current_user, effective_scope
    )
    return {
        "message": f"Signal converted to Finding successfully",
        "signal": NegativeSpaceSignalRead.model_validate(signal),
        "finding_id": str(finding.id),
        "finding_business_id": finding.business_id,
    }
