import uuid
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.rbac.deps import require_permission
from app.rbac.service import AuthorizationService
from app.rbac import permissions as p
from app.models.identity import User
from app.models.assessment import Assessment, AssessmentControl
from app.models.security import Evidence
from app.assessments.schemas import (
    AssessmentCreate,
    AssessmentUpdate,
    AssessmentResponse,
    AssessmentListResponse,
    AssessmentStatsResponse,
    AssessmentControlCreate,
    AssessmentControlUpdate,
    AssessmentControlResponse,
    AssessmentEvidenceItem,
    AssessmentFindingItem,
    AssessmentFindingLinkPayload,
    AssessmentTransitionPayload,
    AssessmentAssignPayload,
    EvidenceVerifyPayload,
    AssessmentTimelineEvent,
    AssessmentStatus
)
from app.assessments.service import AssessmentsService
from app.secops.service import SecurityOperationsService

router = APIRouter(tags=["Assessments"])


def _serialize_assessment(assessment: Assessment) -> AssessmentResponse:
    now = datetime.now(timezone.utc)
    is_overdue = bool(
        assessment.due_date and
        assessment.due_date < now and
        assessment.status.upper() not in [AssessmentStatus.APPROVED, AssessmentStatus.CLOSED]
    )

    controls_res = []
    evaluated_count = 0
    if assessment.assessment_controls:
        for ac in assessment.assessment_controls:
            c_name = ac.control.name if ac.control else None
            c_bid = ac.control.business_id if ac.control else None
            c_cat = ac.control.category if ac.control else None
            ev_name = f"{ac.evaluator.first_name} {ac.evaluator.last_name}" if ac.evaluator else None
            f_bid = ac.finding.business_id if ac.finding else None
            f_title = ac.finding.title if ac.finding else None

            if ac.status != "NOT_STARTED":
                evaluated_count += 1

            controls_res.append(AssessmentControlResponse(
                id=ac.id,
                assessment_id=ac.assessment_id,
                control_id=ac.control_id,
                control_business_id=c_bid,
                control_name=c_name,
                control_category=c_cat,
                evaluator_id=ac.evaluator_id,
                evaluator_name=ev_name,
                finding_id=ac.finding_id,
                finding_business_id=f_bid,
                finding_title=f_title,
                status=ac.status or "NOT_STARTED",
                effectiveness=ac.effectiveness or "NOT_ASSESSED",
                evaluation_notes=ac.evaluation_notes,
                reviewer_comments=ac.reviewer_comments,
                evidence=ac.evidence,
                evidence_required=ac.evidence_required or False,
                evidence_submitted=ac.evidence_submitted or False,
                evidence_verified=ac.evidence_verified or False,
                evaluated_at=ac.evaluated_at,
                reviewed_at=ac.reviewed_at,
                created_at=ac.created_at,
                updated_at=ac.updated_at
            ))

    evidence_res = []
    if assessment.evidence:
        for ev in assessment.evidence:
            up_name = f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None
            ver_name = f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else None
            c_bid = ev.control.business_id if ev.control else None
            evidence_res.append(AssessmentEvidenceItem(
                id=ev.id,
                business_id=ev.business_id,
                title=ev.title,
                description=ev.description,
                evidence_type=ev.evidence_type,
                file_uri=ev.file_uri,
                filename=ev.filename,
                file_size=ev.file_size,
                checksum=ev.checksum,
                control_id=ev.control_id,
                control_business_id=c_bid,
                verification_status=ev.verification_status or "PENDING",
                verified_by_id=ev.verified_by_id,
                verified_by_name=ver_name,
                verified_at=ev.verified_at,
                reviewer_comments=ev.reviewer_comments,
                uploaded_by_id=ev.uploaded_by_id,
                uploaded_by_name=up_name,
                created_at=ev.created_at
            ))

    findings_res = []
    if assessment.findings:
        for f in assessment.findings:
            c_bid = f.control.business_id if f.control else None
            findings_res.append(AssessmentFindingItem(
                id=f.id,
                business_id=f.business_id,
                title=f.title,
                severity=f.severity,
                priority=f.priority,
                status=f.status,
                source_type=f.source_type,
                control_id=f.control_id,
                control_business_id=c_bid,
                created_at=f.created_at
            ))

    return AssessmentResponse(
        id=assessment.id,
        business_id=assessment.business_id,
        title=assessment.title,
        description=assessment.description,
        assessment_type=assessment.assessment_type,
        status=assessment.status,
        priority=assessment.priority,
        scope=assessment.scope,
        organization_id=assessment.organization_id,
        organization_name=assessment.organization.name if assessment.organization else None,
        sector_id=assessment.sector_id,
        sector_name=assessment.sector.name if assessment.sector else None,
        cse_id=assessment.cse_id,
        cse_business_id=assessment.cse.business_id if assessment.cse else None,
        cse_title=assessment.cse.title if assessment.cse else None,
        investigation_id=assessment.investigation_id,
        investigation_business_id=assessment.investigation.business_id if assessment.investigation else None,
        investigation_title=assessment.investigation.title if assessment.investigation else None,
        assessor_id=assessment.assessor_id,
        assessor_name=f"{assessment.assessor.first_name} {assessment.assessor.last_name}" if assessment.assessor else None,
        reviewer_id=assessment.reviewer_id,
        reviewer_name=f"{assessment.reviewer.first_name} {assessment.reviewer.last_name}" if assessment.reviewer else None,
        created_by_id=assessment.created_by_id,
        created_by_name=f"{assessment.created_by.first_name} {assessment.created_by.last_name}" if assessment.created_by else None,
        start_date=assessment.start_date,
        due_date=assessment.due_date,
        submitted_date=assessment.submitted_date,
        approved_date=assessment.approved_date,
        closed_date=assessment.closed_date,
        is_overdue=is_overdue,
        controls_count=len(controls_res),
        evaluated_controls_count=evaluated_count,
        evidence_count=len(evidence_res),
        findings_count=len(findings_res),
        controls=controls_res,
        evidence=evidence_res,
        findings=findings_res,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at
    )


# ----------------------------------------------------
# Assessment Endpoints
# ----------------------------------------------------
@router.get("", response_model=AssessmentListResponse)
def list_assessments(
    status: Optional[str] = Query(None),
    assessment_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assessor_id: Optional[uuid.UUID] = Query(None),
    reviewer_id: Optional[uuid.UUID] = Query(None),
    organization_id: Optional[uuid.UUID] = Query(None),
    sector_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = AssessmentsService.get_assessments(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        status=status,
        assessment_type=assessment_type,
        priority=priority,
        assessor_id=assessor_id,
        reviewer_id=reviewer_id,
        organization_id=organization_id,
        sector_id=sector_id,
        search=search,
        page=page,
        page_size=page_size
    )
    return AssessmentListResponse(
        items=[_serialize_assessment(a) for a in items],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/stats", response_model=AssessmentStatsResponse)
def get_assessment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    stats = AssessmentsService.get_stats(db=db, user=current_user, effective_scope=effective_scope)
    return AssessmentStatsResponse(**stats)


@router.get("/review-queue", response_model=List[AssessmentResponse])
def get_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_REVIEW))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    items = AssessmentsService.get_review_queue(db=db, user=current_user, effective_scope=effective_scope)
    return [_serialize_assessment(a) for a in items]


@router.get("/{id}", response_model=AssessmentResponse)
def get_assessment(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.get_assessment_by_id(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id
    )
    return _serialize_assessment(assessment)


@router.post("", response_model=AssessmentResponse)
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_CREATE))
):
    assessment = AssessmentsService.create_assessment(
        db=db,
        user=current_user,
        payload=payload
    )
    return _serialize_assessment(assessment)


@router.patch("/{id}", response_model=AssessmentResponse)
def update_assessment(
    id: uuid.UUID,
    payload: AssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.update_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        payload=payload
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/assign", response_model=AssessmentResponse)
def assign_assessment(
    id: uuid.UUID,
    payload: AssessmentAssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_ASSIGN))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.assign_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        payload=payload
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/transition", response_model=AssessmentResponse)
def transition_assessment(
    id: uuid.UUID,
    payload: AssessmentTransitionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    permissions = AuthorizationService.get_user_permissions(current_user)

    # Enforce specific permissions based on target transition
    target = payload.target_state.upper()
    if target == AssessmentStatus.SUBMITTED:
        if p.ASSESSMENT_SUBMIT not in permissions:
            raise HTTPException(status_code=403, detail="Permission denied: Missing assessment.submit")
    elif target in [AssessmentStatus.UNDER_REVIEW, AssessmentStatus.CHANGES_REQUESTED]:
        if p.ASSESSMENT_REVIEW not in permissions:
            raise HTTPException(status_code=403, detail="Permission denied: Missing assessment.review")
    elif target == AssessmentStatus.APPROVED:
        if p.ASSESSMENT_APPROVE not in permissions:
            raise HTTPException(status_code=403, detail="Permission denied: Missing assessment.approve")
    elif target == AssessmentStatus.CLOSED:
        if p.ASSESSMENT_CLOSE not in permissions:
            raise HTTPException(status_code=403, detail="Permission denied: Missing assessment.close")

    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=target,
        reason=payload.reason,
        comments=payload.comments
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/start", response_model=AssessmentResponse)
def start_assessment(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.IN_PROGRESS,
        reason="Assessor started evaluation"
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/submit", response_model=AssessmentResponse)
def submit_assessment(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_SUBMIT))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.SUBMITTED,
        reason="Assessment submitted for Auditor Review"
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/request-changes", response_model=AssessmentResponse)
def request_changes(
    id: uuid.UUID,
    payload: AssessmentTransitionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_REVIEW))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.CHANGES_REQUESTED,
        reason=payload.reason,
        comments=payload.comments
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/resubmit", response_model=AssessmentResponse)
def resubmit_assessment(
    id: uuid.UUID,
    payload: Optional[AssessmentTransitionPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_SUBMIT))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    # Route through RESUBMITTED to UNDER_REVIEW
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.RESUBMITTED,
        reason=payload.reason if payload else "Addressed requested changes",
        comments=payload.comments if payload else None
    )
    # Move automatically to UNDER_REVIEW
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.UNDER_REVIEW,
        reason="Awaiting secondary review"
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/approve", response_model=AssessmentResponse)
def approve_assessment(
    id: uuid.UUID,
    payload: Optional[AssessmentTransitionPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_APPROVE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.APPROVED,
        reason=payload.reason if payload else "Formal auditor approval granted",
        comments=payload.comments if payload else None
    )
    return _serialize_assessment(assessment)


@router.post("/{id}/close", response_model=AssessmentResponse)
def close_assessment(
    id: uuid.UUID,
    payload: Optional[AssessmentTransitionPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_CLOSE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.transition_assessment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        target_state=AssessmentStatus.CLOSED,
        reason=payload.reason if payload else "Assessment closed"
    )
    return _serialize_assessment(assessment)


# ----------------------------------------------------
# Control Evaluation Endpoints
# ----------------------------------------------------
@router.post("/{id}/controls", response_model=AssessmentControlResponse)
def add_control_to_assessment(
    id: uuid.UUID,
    payload: AssessmentControlCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_CONTROLS_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    ac = AssessmentsService.add_control(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        payload=payload
    )
    c_name = ac.control.name if ac.control else None
    c_bid = ac.control.business_id if ac.control else None
    c_cat = ac.control.category if ac.control else None
    ev_name = f"{ac.evaluator.first_name} {ac.evaluator.last_name}" if ac.evaluator else None
    return AssessmentControlResponse(
        id=ac.id,
        assessment_id=ac.assessment_id,
        control_id=ac.control_id,
        control_business_id=c_bid,
        control_name=c_name,
        control_category=c_cat,
        evaluator_id=ac.evaluator_id,
        evaluator_name=ev_name,
        finding_id=ac.finding_id,
        status=ac.status,
        effectiveness=ac.effectiveness,
        evaluation_notes=ac.evaluation_notes,
        reviewer_comments=ac.reviewer_comments,
        evidence=ac.evidence,
        evidence_required=ac.evidence_required,
        evidence_submitted=ac.evidence_submitted,
        evidence_verified=ac.evidence_verified,
        evaluated_at=ac.evaluated_at,
        reviewed_at=ac.reviewed_at,
        created_at=ac.created_at,
        updated_at=ac.updated_at
    )


@router.patch("/{id}/controls/{control_id}", response_model=AssessmentControlResponse)
def update_assessment_control(
    id: uuid.UUID,
    control_id: uuid.UUID,
    payload: AssessmentControlUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_CONTROLS_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    ac = AssessmentsService.update_control(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        assessment_control_id=control_id,
        payload=payload
    )
    c_name = ac.control.name if ac.control else None
    c_bid = ac.control.business_id if ac.control else None
    c_cat = ac.control.category if ac.control else None
    ev_name = f"{ac.evaluator.first_name} {ac.evaluator.last_name}" if ac.evaluator else None
    f_bid = ac.finding.business_id if ac.finding else None
    f_title = ac.finding.title if ac.finding else None

    return AssessmentControlResponse(
        id=ac.id,
        assessment_id=ac.assessment_id,
        control_id=ac.control_id,
        control_business_id=c_bid,
        control_name=c_name,
        control_category=c_cat,
        evaluator_id=ac.evaluator_id,
        evaluator_name=ev_name,
        finding_id=ac.finding_id,
        finding_business_id=f_bid,
        finding_title=f_title,
        status=ac.status,
        effectiveness=ac.effectiveness,
        evaluation_notes=ac.evaluation_notes,
        reviewer_comments=ac.reviewer_comments,
        evidence=ac.evidence,
        evidence_required=ac.evidence_required,
        evidence_submitted=ac.evidence_submitted,
        evidence_verified=ac.evidence_verified,
        evaluated_at=ac.evaluated_at,
        reviewed_at=ac.reviewed_at,
        created_at=ac.created_at,
        updated_at=ac.updated_at
    )


# ----------------------------------------------------
# Evidence Endpoints
# ----------------------------------------------------
@router.post("/{id}/evidence", response_model=AssessmentEvidenceItem)
async def upload_assessment_evidence(
    id: uuid.UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    evidence_type: str = Form("LOG"),
    control_id: Optional[uuid.UUID] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EVIDENCE_CREATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    assessment = AssessmentsService.get_assessment_by_id(db, current_user, effective_scope, id)

    evidence = SecurityOperationsService.upload_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        title=title,
        description=description,
        evidence_type=evidence_type,
        source="ASSESSMENT",
        cse_id=assessment.cse_id,
        investigation_id=assessment.investigation_id,
        file=file
    )
    # Link to assessment & control
    evidence.assessment_id = assessment.id
    if control_id:
        evidence.control_id = control_id
        # Mark evidence submitted on assessment control
        ac = (
            db.query(AssessmentControl)
            .filter(
                AssessmentControl.assessment_id == assessment.id,
                AssessmentControl.control_id == control_id
            )
            .first()
        )
        if ac:
            ac.evidence_submitted = True

    db.commit()
    db.refresh(evidence)

    up_name = f"{current_user.first_name} {current_user.last_name}"
    return AssessmentEvidenceItem(
        id=evidence.id,
        business_id=evidence.business_id,
        title=evidence.title,
        description=evidence.description,
        evidence_type=evidence.evidence_type,
        file_uri=evidence.file_uri,
        filename=evidence.filename,
        file_size=evidence.file_size,
        checksum=evidence.checksum,
        control_id=evidence.control_id,
        verification_status=evidence.verification_status,
        uploaded_by_id=current_user.id,
        uploaded_by_name=up_name,
        created_at=evidence.created_at
    )


@router.post("/{id}/evidence/{evidence_id}/verify", response_model=AssessmentEvidenceItem)
def verify_assessment_evidence(
    id: uuid.UUID,
    evidence_id: uuid.UUID,
    payload: EvidenceVerifyPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.EVIDENCE_VERIFY))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    ev = AssessmentsService.verify_evidence(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        evidence_id=evidence_id,
        payload=payload
    )
    up_name = f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else None
    ver_name = f"{current_user.first_name} {current_user.last_name}"
    c_bid = ev.control.business_id if ev.control else None
    return AssessmentEvidenceItem(
        id=ev.id,
        business_id=ev.business_id,
        title=ev.title,
        description=ev.description,
        evidence_type=ev.evidence_type,
        file_uri=ev.file_uri,
        filename=ev.filename,
        file_size=ev.file_size,
        checksum=ev.checksum,
        control_id=ev.control_id,
        control_business_id=c_bid,
        verification_status=ev.verification_status,
        verified_by_id=current_user.id,
        verified_by_name=ver_name,
        verified_at=ev.verified_at,
        reviewer_comments=ev.reviewer_comments,
        uploaded_by_id=ev.uploaded_by_id,
        uploaded_by_name=up_name,
        created_at=ev.created_at
    )


# ----------------------------------------------------
# Finding Connection Endpoints
# ----------------------------------------------------
@router.post("/{id}/findings", response_model=AssessmentFindingItem)
def link_finding_to_assessment(
    id: uuid.UUID,
    payload: AssessmentFindingLinkPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    finding = AssessmentsService.link_finding(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id,
        finding_id=payload.finding_id
    )
    c_bid = finding.control.business_id if finding.control else None
    return AssessmentFindingItem(
        id=finding.id,
        business_id=finding.business_id,
        title=finding.title,
        severity=finding.severity,
        priority=finding.priority,
        status=finding.status,
        source_type=finding.source_type,
        control_id=finding.control_id,
        control_business_id=c_bid,
        created_at=finding.created_at
    )


# ----------------------------------------------------
# Timeline Endpoint
# ----------------------------------------------------
@router.get("/{id}/timeline", response_model=List[AssessmentTimelineEvent])
def get_assessment_timeline(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ASSESSMENT_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return AssessmentsService.get_timeline(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        assessment_id=id
    )
