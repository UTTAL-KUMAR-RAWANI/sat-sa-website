from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.identity import User
from app.models.remediation import Remediation
from app.models.security import Evidence
from app.api.deps import get_current_user
from app.rbac.deps import require_permission
from app.rbac import permissions as p
from app.rbac.service import AuthorizationService
from app.remediations.service import RemediationService
from app.remediations.schemas import (
    RemediationCreate,
    RemediationUpdate,
    RemediationAssignPayload,
    RemediationBlockPayload,
    RemediationUnblockPayload,
    RemediationEvidenceSubmitPayload,
    RemediationValidationDecision,
    RemediationClosePayload,
    RemediationEvidenceCreate,
    RemediationEvidenceReview,
    EvidenceItemResponse,
    RemediationResponse,
    RemediationDetailResponse,
    RemediationStatsResponse,
    RemediationTimelineEvent,
)

router = APIRouter(prefix="/remediations", tags=["Remediations"])


def _serialize_remediation(r: Remediation, include_details: bool = False) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    target = r.target_date or r.due_date
    is_overdue = bool(target and target < now and r.status not in ["VERIFIED", "CLOSED"])

    data = {
        "id": r.id,
        "business_id": r.business_id,
        "title": r.title,
        "description": r.description,
        "priority": r.priority,
        "status": r.status,
        "source": r.source,
        "source_id": r.source_id,

        "finding_id": r.finding_id,
        "finding_business_id": r.finding.business_id if r.finding else None,
        "finding_title": r.finding.title if r.finding else None,

        "risk_id": r.risk_id,
        "risk_business_id": r.risk.business_id if r.risk else None,
        "risk_title": r.risk.title if r.risk else None,

        "risk_treatment_id": r.risk_treatment_id,
        "risk_treatment_business_id": r.risk_treatment.business_id if r.risk_treatment else None,

        "control_id": r.control_id,
        "control_business_id": r.control.business_id if r.control else None,
        "control_name": r.control.name if r.control else None,

        "organization_id": r.organization_id,
        "organization_name": r.organization.name if r.organization else None,
        "sector_id": r.sector_id,
        "sector_name": r.sector.name if r.sector else None,

        "owner_id": r.owner_id,
        "owner_name": f"{r.owner.first_name} {r.owner.last_name}" if r.owner else None,
        "assigned_team": r.assigned_team,
        "assigned_by_id": r.assigned_by_id,
        "assigned_by_name": f"{r.assigned_by.first_name} {r.assigned_by.last_name}" if r.assigned_by else None,
        "assigned_at": r.assigned_at,

        "due_date": r.due_date,
        "target_date": r.target_date,
        "started_at": r.started_at,
        "completed_at": r.completed_at,

        "blocked_reason": r.blocked_reason,
        "blocked_by_id": r.blocked_by_id,
        "blocked_by_name": f"{r.blocked_by.first_name} {r.blocked_by.last_name}" if r.blocked_by else None,
        "blocked_at": r.blocked_at,

        "verified_at": r.verified_at,
        "verified_by_id": r.verified_by_id,
        "verified_by_name": f"{r.verified_by.first_name} {r.verified_by.last_name}" if r.verified_by else None,
        "validator_comments": r.validator_comments,
        "validation_decision": r.validation_decision,

        "closed_at": r.closed_at,
        "closed_by_id": r.closed_by_id,
        "closed_by_name": f"{r.closed_by.first_name} {r.closed_by.last_name}" if r.closed_by else None,

        "required_evidence_types": r.required_evidence_types,
        "evidence_count": len(r.evidence_items) if r.evidence_items else 0,
        "is_overdue": is_overdue,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }

    if include_details:
        data["corrective_action"] = r.corrective_action
        data["root_cause"] = r.root_cause
        data["implementation_steps"] = r.implementation_steps
        data["expected_outcome"] = r.expected_outcome
        data["completion_criteria"] = r.completion_criteria
        data["dependencies"] = r.dependencies

        evidence_list = []
        submitted_types = set()
        for ev in (r.evidence_items or []):
            submitted_types.add(ev.evidence_type.upper())
            evidence_list.append(
                EvidenceItemResponse(
                    id=ev.id,
                    business_id=ev.business_id,
                    remediation_id=ev.remediation_id,
                    title=ev.title,
                    description=ev.description,
                    evidence_type=ev.evidence_type,
                    file_uri=ev.file_uri,
                    filename=ev.filename,
                    file_size=ev.file_size,
                    checksum=ev.checksum,
                    verification_status=ev.verification_status,
                    reviewer_comments=ev.reviewer_comments,
                    verified_at=ev.verified_at,
                    verified_by_id=ev.verified_by_id,
                    verified_by_name=f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else None,
                    uploaded_by_id=ev.uploaded_by_id,
                    uploaded_by_name=f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None,
                    created_at=ev.created_at
                )
            )
        data["evidence_items"] = evidence_list

        # Missing required evidence types
        missing = []
        if r.required_evidence_types:
            reqs = [x.strip().upper() for x in r.required_evidence_types.split(",") if x.strip()]
            for req in reqs:
                if not any(req in st for st in submitted_types):
                    missing.append(req)
        data["missing_evidence_types"] = missing

    return data


@router.get("", response_model=List[RemediationResponse])
def get_remediations(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None,
    owner_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    items = RemediationService.get_remediations(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        status_filter=status,
        priority_filter=priority,
        source_filter=source,
        owner_id=owner_id,
        organization_id=organization_id,
        search=search,
        skip=skip,
        limit=limit
    )
    return [_serialize_remediation(r) for r in items]


@router.get("/stats", response_model=RemediationStatsResponse)
def get_remediation_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return RemediationService.get_stats(db=db, user=current_user, effective_scope=effective_scope)


@router.get("/{id}", response_model=RemediationDetailResponse)
def get_remediation_detail(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.get_by_id(db=db, user=current_user, effective_scope=effective_scope, remediation_id=id)
    return _serialize_remediation(r, include_details=True)


@router.post("", response_model=RemediationResponse)
def create_remediation(
    payload: RemediationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_CREATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.create_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        payload=payload
    )
    return _serialize_remediation(r)


@router.patch("/{id}", response_model=RemediationResponse)
def update_remediation(
    id: uuid.UUID,
    payload: RemediationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.update_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        payload=payload
    )
    return _serialize_remediation(r)


@router.post("/{id}/assign", response_model=RemediationResponse)
def assign_remediation(
    id: uuid.UUID,
    payload: RemediationAssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_ASSIGN))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.assign_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        payload=payload
    )
    return _serialize_remediation(r)


@router.post("/{id}/start", response_model=RemediationResponse)
def start_remediation(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_START))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.start_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id
    )
    return _serialize_remediation(r)


@router.post("/{id}/block", response_model=RemediationResponse)
def block_remediation(
    id: uuid.UUID,
    payload: RemediationBlockPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_BLOCK))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.block_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        payload=payload
    )
    return _serialize_remediation(r)


@router.post("/{id}/unblock", response_model=RemediationResponse)
def unblock_remediation(
    id: uuid.UUID,
    payload: Optional[RemediationUnblockPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_START))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    notes = payload.unblock_notes if payload else None
    r = RemediationService.unblock_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        notes=notes
    )
    return _serialize_remediation(r)


@router.post("/{id}/submit-evidence", response_model=RemediationResponse)
def submit_evidence(
    id: uuid.UUID,
    payload: Optional[RemediationEvidenceSubmitPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_SUBMIT_EVIDENCE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    notes = payload.submission_notes if payload else None
    r = RemediationService.submit_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        notes=notes
    )
    return _serialize_remediation(r)


@router.post("/{id}/validate", response_model=RemediationResponse)
def begin_validation(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_VALIDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.begin_validation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id
    )
    return _serialize_remediation(r)


@router.post("/{id}/verify", response_model=RemediationResponse)
@router.post("/{id}/validate-decision", response_model=RemediationResponse)
def verify_remediation(
    id: uuid.UUID,
    payload: RemediationValidationDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_VERIFY))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.verify_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        payload=payload
    )
    return _serialize_remediation(r)


@router.post("/{id}/close", response_model=RemediationResponse)
def close_remediation(
    id: uuid.UUID,
    payload: Optional[RemediationClosePayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_CLOSE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    notes = payload.closure_notes if payload else None
    r = RemediationService.close_remediation(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        closure_notes=notes
    )
    return _serialize_remediation(r)



# ----------------------------------------------------
# Evidence Endpoints
# ----------------------------------------------------
@router.get("/{id}/evidence", response_model=List[EvidenceItemResponse])
def get_remediation_evidence(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_EVIDENCE_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    r = RemediationService.get_by_id(db=db, user=current_user, effective_scope=effective_scope, remediation_id=id)
    return [
        EvidenceItemResponse(
            id=ev.id,
            business_id=ev.business_id,
            remediation_id=ev.remediation_id,
            title=ev.title,
            description=ev.description,
            evidence_type=ev.evidence_type,
            file_uri=ev.file_uri,
            filename=ev.filename,
            file_size=ev.file_size,
            checksum=ev.checksum,
            verification_status=ev.verification_status,
            reviewer_comments=ev.reviewer_comments,
            verified_at=ev.verified_at,
            verified_by_id=ev.verified_by_id,
            verified_by_name=f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else None,
            uploaded_by_id=ev.uploaded_by_id,
            uploaded_by_name=f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None,
            created_at=ev.created_at
        ) for ev in (r.evidence_items or [])
    ]


@router.post("/{id}/evidence", response_model=EvidenceItemResponse)
def add_evidence(
    id: uuid.UUID,
    payload: RemediationEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_EVIDENCE_CREATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    ev = RemediationService.add_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        payload=payload
    )
    return EvidenceItemResponse(
        id=ev.id,
        business_id=ev.business_id,
        remediation_id=ev.remediation_id,
        title=ev.title,
        description=ev.description,
        evidence_type=ev.evidence_type,
        file_uri=ev.file_uri,
        filename=ev.filename,
        file_size=ev.file_size,
        checksum=ev.checksum,
        verification_status=ev.verification_status,
        reviewer_comments=ev.reviewer_comments,
        verified_at=ev.verified_at,
        verified_by_id=ev.verified_by_id,
        verified_by_name=f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else None,
        uploaded_by_id=ev.uploaded_by_id,
        uploaded_by_name=f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None,
        created_at=ev.created_at
    )


@router.patch("/{id}/evidence/{evidence_id}", response_model=EvidenceItemResponse)
@router.post("/{id}/evidence/{evidence_id}/review", response_model=EvidenceItemResponse)
def review_evidence(
    id: uuid.UUID,
    evidence_id: uuid.UUID,
    payload: RemediationEvidenceReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_EVIDENCE_VERIFY))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    ev = RemediationService.review_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        remediation_id=id,
        evidence_id=evidence_id,
        payload=payload
    )
    return EvidenceItemResponse(
        id=ev.id,
        business_id=ev.business_id,
        remediation_id=ev.remediation_id,
        title=ev.title,
        description=ev.description,
        evidence_type=ev.evidence_type,
        file_uri=ev.file_uri,
        filename=ev.filename,
        file_size=ev.file_size,
        checksum=ev.checksum,
        verification_status=ev.verification_status,
        reviewer_comments=ev.reviewer_comments,
        verified_at=ev.verified_at,
        verified_by_id=ev.verified_by_id,
        verified_by_name=f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else None,
        uploaded_by_id=ev.uploaded_by_id,
        uploaded_by_name=f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None,
        created_at=ev.created_at
    )


@router.get("/{id}/timeline", response_model=List[RemediationTimelineEvent])
@router.get("/{id}/history", response_model=List[RemediationTimelineEvent])
def get_timeline(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.REMEDIATION_READ))
):
    return RemediationService.get_timeline(db=db, remediation_id=id)

