from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.identity import User
from app.models.risk import Risk, RiskTreatment, RiskException
from app.api.deps import get_current_user
from app.rbac.deps import require_permission
from app.rbac import permissions as p
from app.rbac.service import AuthorizationService
from app.risks.service import RisksService
from app.risks.schemas import (
    RiskCreate,
    RiskUpdate,
    RiskResponse,
    RiskDetailResponse,
    RiskStatsResponse,
    RiskTimelineEvent,
    InherentAssessmentPayload,
    ResidualAssessmentPayload,
    RiskTreatmentDecisionPayload,
    RiskAcceptancePayload,
    RiskTransitionPayload,
    RiskTreatmentCreate,
    RiskTreatmentUpdate,
    RiskTreatmentResponse,
    RiskExceptionCreate,
    RiskExceptionDecision,
    RiskExceptionResponse,
)

risks_router = APIRouter(prefix="/risks", tags=["Risks & GRC"])
treatments_router = APIRouter(prefix="/risk-treatments", tags=["Risk Treatments"])
exceptions_router = APIRouter(prefix="/risk-exceptions", tags=["Risk Exceptions"])


def _serialize_risk(risk: Risk, include_details: bool = False) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    is_overdue = bool(risk.target_date and risk.target_date < now and risk.status != "CLOSED")

    data = {
        "id": risk.id,
        "business_id": risk.business_id,
        "title": risk.title,
        "description": risk.description,
        "category": risk.category,
        "source": risk.source,
        "source_reference": risk.source_reference,
        "source_id": risk.source_id,
        "status": risk.status,
        "finding_id": risk.finding_id,
        "finding_business_id": risk.finding.business_id if risk.finding else None,
        "finding_title": risk.finding.title if risk.finding else None,
        "assessment_id": risk.assessment_id,
        "assessment_business_id": risk.assessment.business_id if risk.assessment else None,
        "assessment_title": risk.assessment.title if risk.assessment else None,
        "control_id": risk.control_id,
        "control_business_id": risk.control.business_id if risk.control else None,
        "control_name": risk.control.name if risk.control else None,
        "cse_id": risk.cse_id,
        "cse_business_id": risk.cse.business_id if risk.cse else None,
        "cse_title": risk.cse.title if risk.cse else None,
        "organization_id": risk.organization_id,
        "organization_name": risk.organization.name if risk.organization else None,
        "sector_id": risk.sector_id,
        "sector_name": risk.sector.name if risk.sector else None,
        "asset_or_system": risk.asset_or_system,
        "owner_id": risk.owner_id,
        "owner_name": f"{risk.owner.first_name} {risk.owner.last_name}" if risk.owner else None,
        "identified_by_id": risk.identified_by_id,
        "identified_by_name": f"{risk.identified_by.first_name} {risk.identified_by.last_name}" if risk.identified_by else None,
        "accepted_by_id": risk.accepted_by_id,
        "accepted_by_name": f"{risk.accepted_by.first_name} {risk.accepted_by.last_name}" if risk.accepted_by else None,
        "likelihood": risk.likelihood,
        "impact": risk.impact,
        "inherent_score": risk.inherent_score,
        "inherent_risk_level": risk.inherent_risk_level,
        "existing_controls_description": risk.existing_controls_description,
        "residual_likelihood": risk.residual_likelihood,
        "residual_impact": risk.residual_impact,
        "residual_score": risk.residual_score,
        "residual_risk_level": risk.residual_risk_level,
        "treatment_strategy": risk.treatment_strategy,
        "treatment_owner_id": risk.treatment_owner_id,
        "treatment_owner_name": f"{risk.treatment_owner.first_name} {risk.treatment_owner.last_name}" if risk.treatment_owner else None,
        "treatment_target_date": risk.treatment_target_date,
        "treatment_description": risk.treatment_description,
        "acceptance_justification": risk.acceptance_justification,
        "accepted_at": risk.accepted_at,
        "review_date": risk.review_date,
        "target_date": risk.target_date,
        "is_overdue": is_overdue,
        "treatments_count": len(risk.treatments) if risk.treatments else 0,
        "exceptions_count": len(risk.exceptions) if risk.exceptions else 0,
        "created_at": risk.created_at,
        "updated_at": risk.updated_at,
    }

    if include_details:
        data["treatments"] = [
            RiskTreatmentResponse(
                id=t.id,
                business_id=t.business_id,
                risk_id=t.risk_id,
                title=t.title,
                description=t.description,
                strategy=t.strategy,
                status=t.status,
                mitigation_actions=t.mitigation_actions,
                transfer_details=t.transfer_details,
                avoidance_details=t.avoidance_details,
                justification=t.justification,
                target_date=t.target_date,
                owner_id=t.owner_id,
                owner_name=f"{t.owner.first_name} {t.owner.last_name}" if t.owner else None,
                created_by_id=t.created_by_id,
                created_by_name=f"{t.created_by.first_name} {t.created_by.last_name}" if t.created_by else None,
                created_at=t.created_at,
                updated_at=t.updated_at
            ) for t in (risk.treatments or [])
        ]
        data["exceptions"] = [
            RiskExceptionResponse(
                id=e.id,
                business_id=e.business_id,
                risk_id=e.risk_id,
                title=e.title,
                justification=e.justification,
                requested_by_id=e.requested_by_id,
                requested_by_name=f"{e.requested_by.first_name} {e.requested_by.last_name}" if e.requested_by else None,
                owner_id=e.owner_id,
                owner_name=f"{e.owner.first_name} {e.owner.last_name}" if e.owner else None,
                approved_by_id=e.approved_by_id,
                approved_by_name=f"{e.approved_by.first_name} {e.approved_by.last_name}" if e.approved_by else None,
                start_date=e.start_date,
                expiry_date=e.expiry_date,
                status=e.status,
                reviewed_at=e.reviewed_at,
                reviewer_comments=e.reviewer_comments,
                created_at=e.created_at,
                updated_at=e.updated_at
            ) for e in (risk.exceptions or [])
        ]

    return data


# ----------------------------------------------------
# Risks Endpoints
# ----------------------------------------------------
@risks_router.get("", response_model=List[RiskResponse])
def get_risks(
    status: Optional[str] = None,
    category: Optional[str] = None,
    level: Optional[str] = None,
    source: Optional[str] = None,
    organization_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risks = RisksService.get_risks(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        status=status,
        category=category,
        level=level,
        source=source,
        organization_id=organization_id,
        search=search,
        skip=skip,
        limit=limit
    )
    return [_serialize_risk(r) for r in risks]


@risks_router.get("/stats", response_model=RiskStatsResponse)
def get_risk_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    return RisksService.get_stats(db=db, user=current_user, effective_scope=effective_scope)


@risks_router.get("/{id}", response_model=RiskDetailResponse)
def get_risk_detail(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_READ))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.get_risk_by_id(db=db, user=current_user, effective_scope=effective_scope, risk_id=id)
    return _serialize_risk(risk, include_details=True)


@risks_router.post("", response_model=RiskResponse)
def create_risk(
    payload: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_CREATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.create_risk(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.patch("/{id}", response_model=RiskResponse)
def update_risk(
    id: uuid.UUID,
    payload: RiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.update_risk(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.post("/{id}/assess-inherent", response_model=RiskResponse)
def assess_inherent(
    id: uuid.UUID,
    payload: InherentAssessmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_ASSESS))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.assess_inherent(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.post("/{id}/assess-residual", response_model=RiskResponse)
def assess_residual(
    id: uuid.UUID,
    payload: ResidualAssessmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_ASSESS))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.assess_residual(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.post("/{id}/treatment", response_model=RiskResponse)
def decide_treatment(
    id: uuid.UUID,
    payload: RiskTreatmentDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_TREAT))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.decide_treatment(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.post("/{id}/accept", response_model=RiskResponse)
def accept_risk(
    id: uuid.UUID,
    payload: RiskAcceptancePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_ACCEPT))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.accept_risk(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        payload=payload
    )
    return _serialize_risk(risk)


@risks_router.post("/{id}/transition", response_model=RiskResponse)
def transition_risk(
    id: uuid.UUID,
    payload: RiskTransitionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_UPDATE))
):
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)
    risk = RisksService.transition_risk(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        risk_id=id,
        target_state=payload.target_state,
        reason=payload.reason
    )
    return _serialize_risk(risk)


@risks_router.get("/{id}/timeline", response_model=List[RiskTimelineEvent])
def get_risk_timeline(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_READ))
):
    return RisksService.get_timeline(db=db, risk_id=id)


# ----------------------------------------------------
# Risk Treatments Endpoints
# ----------------------------------------------------
@treatments_router.get("", response_model=List[RiskTreatmentResponse])
def get_treatments(
    risk_id: Optional[uuid.UUID] = None,
    strategy: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_TREATMENT_READ))
):
    treatments = RisksService.get_treatments(db=db, risk_id=risk_id, strategy=strategy, status=status)
    return [
        RiskTreatmentResponse(
            id=t.id,
            business_id=t.business_id,
            risk_id=t.risk_id,
            title=t.title,
            description=t.description,
            strategy=t.strategy,
            status=t.status,
            mitigation_actions=t.mitigation_actions,
            transfer_details=t.transfer_details,
            avoidance_details=t.avoidance_details,
            justification=t.justification,
            target_date=t.target_date,
            owner_id=t.owner_id,
            owner_name=f"{t.owner.first_name} {t.owner.last_name}" if t.owner else None,
            created_by_id=t.created_by_id,
            created_by_name=f"{t.created_by.first_name} {t.created_by.last_name}" if t.created_by else None,
            created_at=t.created_at,
            updated_at=t.updated_at
        ) for t in treatments
    ]


@treatments_router.patch("/{id}", response_model=RiskTreatmentResponse)
def update_treatment(
    id: uuid.UUID,
    payload: RiskTreatmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_TREATMENT_UPDATE))
):
    t = RisksService.update_treatment(db=db, user=current_user, treatment_id=id, payload=payload)
    return RiskTreatmentResponse(
        id=t.id,
        business_id=t.business_id,
        risk_id=t.risk_id,
        title=t.title,
        description=t.description,
        strategy=t.strategy,
        status=t.status,
        mitigation_actions=t.mitigation_actions,
        transfer_details=t.transfer_details,
        avoidance_details=t.avoidance_details,
        justification=t.justification,
        target_date=t.target_date,
        owner_id=t.owner_id,
        owner_name=f"{t.owner.first_name} {t.owner.last_name}" if t.owner else None,
        created_by_id=t.created_by_id,
        created_by_name=f"{t.created_by.first_name} {t.created_by.last_name}" if t.created_by else None,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@treatments_router.post("/risk/{risk_id}", response_model=RiskTreatmentResponse)
def create_treatment(
    risk_id: uuid.UUID,
    payload: RiskTreatmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_TREATMENT_CREATE))
):
    t = RisksService.create_treatment(db=db, user=current_user, risk_id=risk_id, payload=payload)
    return RiskTreatmentResponse(
        id=t.id,
        business_id=t.business_id,
        risk_id=t.risk_id,
        title=t.title,
        description=t.description,
        strategy=t.strategy,
        status=t.status,
        mitigation_actions=t.mitigation_actions,
        transfer_details=t.transfer_details,
        avoidance_details=t.avoidance_details,
        justification=t.justification,
        target_date=t.target_date,
        owner_id=t.owner_id,
        owner_name=f"{t.owner.first_name} {t.owner.last_name}" if t.owner else None,
        created_by_id=t.created_by_id,
        created_by_name=f"{t.created_by.first_name} {t.created_by.last_name}" if t.created_by else None,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


# ----------------------------------------------------
# Risk Exceptions Endpoints
# ----------------------------------------------------
@exceptions_router.get("", response_model=List[RiskExceptionResponse])
def get_exceptions(
    risk_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_EXCEPTION_READ))
):
    exceptions = RisksService.get_exceptions(db=db, risk_id=risk_id, status_filter=status)
    return [
        RiskExceptionResponse(
            id=e.id,
            business_id=e.business_id,
            risk_id=e.risk_id,
            title=e.title,
            justification=e.justification,
            requested_by_id=e.requested_by_id,
            requested_by_name=f"{e.requested_by.first_name} {e.requested_by.last_name}" if e.requested_by else None,
            owner_id=e.owner_id,
            owner_name=f"{e.owner.first_name} {e.owner.last_name}" if e.owner else None,
            approved_by_id=e.approved_by_id,
            approved_by_name=f"{e.approved_by.first_name} {e.approved_by.last_name}" if e.approved_by else None,
            start_date=e.start_date,
            expiry_date=e.expiry_date,
            status=e.status,
            reviewed_at=e.reviewed_at,
            reviewer_comments=e.reviewer_comments,
            created_at=e.created_at,
            updated_at=e.updated_at
        ) for e in exceptions
    ]


@exceptions_router.post("/risk/{risk_id}", response_model=RiskExceptionResponse)
def create_exception(
    risk_id: uuid.UUID,
    payload: RiskExceptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_EXCEPTION_CREATE))
):
    e = RisksService.create_exception(db=db, user=current_user, risk_id=risk_id, payload=payload)
    return RiskExceptionResponse(
        id=e.id,
        business_id=e.business_id,
        risk_id=e.risk_id,
        title=e.title,
        justification=e.justification,
        requested_by_id=e.requested_by_id,
        requested_by_name=f"{e.requested_by.first_name} {e.requested_by.last_name}" if e.requested_by else None,
        owner_id=e.owner_id,
        owner_name=f"{e.owner.first_name} {e.owner.last_name}" if e.owner else None,
        approved_by_id=e.approved_by_id,
        approved_by_name=f"{e.approved_by.first_name} {e.approved_by.last_name}" if e.approved_by else None,
        start_date=e.start_date,
        expiry_date=e.expiry_date,
        status=e.status,
        reviewed_at=e.reviewed_at,
        reviewer_comments=e.reviewer_comments,
        created_at=e.created_at,
        updated_at=e.updated_at
    )


@exceptions_router.post("/{id}/decision", response_model=RiskExceptionResponse)
def decide_exception(
    id: uuid.UUID,
    payload: RiskExceptionDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.RISK_EXCEPTION_APPROVE))
):
    e = RisksService.decide_exception(
        db=db,
        user=current_user,
        exception_id=id,
        decision=payload.decision,
        reviewer_comments=payload.reviewer_comments
    )
    return RiskExceptionResponse(
        id=e.id,
        business_id=e.business_id,
        risk_id=e.risk_id,
        title=e.title,
        justification=e.justification,
        requested_by_id=e.requested_by_id,
        requested_by_name=f"{e.requested_by.first_name} {e.requested_by.last_name}" if e.requested_by else None,
        owner_id=e.owner_id,
        owner_name=f"{e.owner.first_name} {e.owner.last_name}" if e.owner else None,
        approved_by_id=e.approved_by_id,
        approved_by_name=f"{e.approved_by.first_name} {e.approved_by.last_name}" if e.approved_by else None,
        start_date=e.start_date,
        expiry_date=e.expiry_date,
        status=e.status,
        reviewed_at=e.reviewed_at,
        reviewer_comments=e.reviewer_comments,
        created_at=e.created_at,
        updated_at=e.updated_at
    )
