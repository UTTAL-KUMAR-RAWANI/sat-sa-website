import uuid
from typing import Optional, List, Set
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.identity import User
from app.api.deps import get_current_user
from app.rbac.deps import require_permission
from app.rbac.service import AuthorizationService
from app.rbac import permissions as p
from app.findings.schemas import (
    FindingCreate,
    FindingUpdate,
    FindingTransitionRequest,
    FindingAssignRequest,
    FindingCommentCreate,
    FindingRead,
    FindingListResponse,
    FindingStatsResponse,
    FindingCommentRead,
    FindingTimelineEvent,
)
from app.findings.service import FindingsService

router = APIRouter(prefix="/findings", tags=["Findings Management"])

@router.get("", response_model=FindingListResponse)
def list_findings(
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    source_type: Optional[str] = Query(None, description="Filter by source type"),
    search: Optional[str] = Query(None, description="Search keyword"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = FindingsService.list_findings(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        status_filter=status,
        severity_filter=severity,
        priority_filter=priority,
        source_type_filter=source_type,
        search=search,
        page=page,
        page_size=page_size
    )
    return FindingListResponse(items=items, total=total, page=page, page_size=page_size)

@router.get("/stats", response_model=FindingStatsResponse)
def get_finding_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.get_stats(db=db, user=current_user, effective_scope=effective_scope)

@router.post("", response_model=FindingRead, status_code=status.HTTP_201_CREATED)
def create_finding(
    payload: FindingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_CREATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.create_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        data=payload
    )

@router.get("/{finding_id}", response_model=FindingRead)
def get_finding(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.get_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id
    )

@router.patch("/{finding_id}", response_model=FindingRead)
def update_finding(
    finding_id: uuid.UUID,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.update_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id,
        data=payload
    )

@router.post("/{finding_id}/transition", response_model=FindingRead)
def transition_finding(
    finding_id: uuid.UUID,
    payload: FindingTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    permissions = AuthorizationService.get_user_permissions(current_user)
    return FindingsService.transition_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id,
        req=payload,
        user_permissions=permissions
    )

@router.post("/{finding_id}/assign", response_model=FindingRead)
def assign_finding(
    finding_id: uuid.UUID,
    payload: FindingAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.assign_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id,
        req=payload
    )

@router.post("/{finding_id}/comments", response_model=FindingCommentRead, status_code=status.HTTP_201_CREATED)
def add_finding_comment(
    finding_id: uuid.UUID,
    payload: FindingCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.add_comment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id,
        req=payload
    )

@router.post("/{finding_id}/evidence", response_model=FindingRead)
def attach_finding_evidence(
    finding_id: uuid.UUID,
    evidence_id: uuid.UUID = Query(..., description="UUID of evidence to attach"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.attach_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id,
        evidence_id=evidence_id
    )

@router.get("/{finding_id}/timeline", response_model=List[FindingTimelineEvent])
def get_finding_timeline(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.FINDING_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return FindingsService.get_timeline(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        finding_id=finding_id
    )
