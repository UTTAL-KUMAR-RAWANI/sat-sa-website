from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.identity import User
from app.rbac.deps import require_permission, require_any_permission
from app.rbac import permissions as p
from app.rbac.scopes import ScopeType
from app.rbac.service import AuthorizationService
from app.supervision.service import SupervisionService
from app.supervision.escalation_engine import EscalationEngine

def get_user_effective_scope(current_user: User = Depends(get_current_user)) -> ScopeType:
    raw = AuthorizationService.get_user_effective_scope(current_user)
    for s in ScopeType:
        if s.value == raw:
            return s
    return ScopeType.ORGANIZATION
from app.supervision.schemas import (
    SupervisoryCaseCreate,
    SupervisoryCaseUpdate,
    SupervisoryCaseResponse,
    CaseAssignRequest,
    CaseStartReviewRequest,
    CaseRecommendationRequest,
    CaseRequestReviewRequest,
    CaseDecisionRequest,
    CaseCloseRequest,
    EscalationCreate,
    EscalationAssignRequest,
    EscalationResolveRequest,
    EscalationResponse,
    SupervisoryDecisionCreate,
    SupervisoryDecisionResponse,
    SupervisoryFindingCreate,
    SupervisionSummaryResponse,
)

router = APIRouter(prefix="/supervision", tags=["supervision"])

# ==================== SUMMARY ====================

@router.get("/summary", response_model=SupervisionSummaryResponse)
def get_supervision_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_READ,
        p.SUPERVISORY_CASE_READ,
        p.ESCALATION_READ,
        p.SUPERVISION_DECISIONS
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.get_summary(db, current_user, effective_scope)

# ==================== CASES ====================

@router.get("/cases", response_model=List[SupervisoryCaseResponse])
def list_supervisory_cases(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    trigger_type: Optional[str] = Query(None),
    sector_id: Optional[uuid.UUID] = Query(None),
    organization_id: Optional[uuid.UUID] = Query(None),
    assigned_analyst_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_READ,
        p.SUPERVISION_READ,
        p.SUPERVISION_DECISIONS
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.list_cases(
        db, current_user, effective_scope,
        status=status,
        priority=priority,
        trigger_type=trigger_type,
        sector_id=sector_id,
        organization_id=organization_id,
        assigned_analyst_id=assigned_analyst_id,
        search=search,
        skip=skip,
        limit=limit
    )

@router.post("/cases", response_model=SupervisoryCaseResponse, status_code=status.HTTP_201_CREATED)
def create_supervisory_case(
    payload: SupervisoryCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_CREATE,
        p.SUPERVISION_CREATE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.create_case(db, payload, current_user, effective_scope)

@router.get("/cases/{case_id}", response_model=SupervisoryCaseResponse)
def get_supervisory_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_READ,
        p.SUPERVISION_READ
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.get_case(db, case_id, current_user, effective_scope)

@router.patch("/cases/{case_id}", response_model=SupervisoryCaseResponse)
def update_supervisory_case(
    case_id: uuid.UUID,
    payload: SupervisoryCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_UPDATE,
        p.SUPERVISION_REVIEW
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.update_case(db, case_id, payload, current_user, effective_scope)

@router.post("/cases/{case_id}/assign", response_model=SupervisoryCaseResponse)
def assign_supervisory_case(
    case_id: uuid.UUID,
    payload: CaseAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_ASSIGN,
        p.SUPERVISION_ASSIGN
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.assign_case(db, case_id, payload, current_user, effective_scope)

@router.post("/cases/{case_id}/start-review", response_model=SupervisoryCaseResponse)
def start_case_review(
    case_id: uuid.UUID,
    payload: Optional[CaseStartReviewRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_REVIEW,
        p.SUPERVISION_REVIEW
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    req = payload or CaseStartReviewRequest()
    return SupervisionService.start_case_review(db, case_id, req, current_user, effective_scope)

@router.post("/cases/{case_id}/submit-recommendation", response_model=SupervisoryCaseResponse)
def submit_case_recommendation(
    case_id: uuid.UUID,
    payload: CaseRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_RECOMMEND,
        p.SUPERVISORY_CASE_REVIEW
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.submit_case_recommendation(db, case_id, payload, current_user, effective_scope)

@router.post("/cases/{case_id}/request-review", response_model=SupervisoryCaseResponse)
def request_case_review(
    case_id: uuid.UUID,
    payload: CaseRequestReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_DECIDE,
        p.SUPERVISION_APPROVE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.request_case_review(db, case_id, payload, current_user, effective_scope)

@router.post("/cases/{case_id}/record-decision", response_model=SupervisoryCaseResponse)
@router.post("/cases/{case_id}/decision", response_model=SupervisoryCaseResponse)
def record_case_decision(
    case_id: uuid.UUID,
    payload: CaseDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_DECIDE,
        p.SUPERVISION_APPROVE,
        p.SUPERVISION_DECISIONS
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.record_case_decision(db, case_id, payload, current_user, effective_scope)

@router.post("/cases/{case_id}/close", response_model=SupervisoryCaseResponse)
def close_supervisory_case(
    case_id: uuid.UUID,
    payload: Optional[CaseCloseRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_CLOSE,
        p.SUPERVISION_CLOSE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    req = payload or CaseCloseRequest()
    return SupervisionService.close_case(db, case_id, req, current_user, effective_scope)

@router.post("/cases/{case_id}/finding", status_code=status.HTTP_201_CREATED)
def create_supervisory_finding(
    case_id: uuid.UUID,
    payload: SupervisoryFindingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_REVIEW,
        p.FINDING_CREATE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.create_supervisory_finding(db, case_id, payload, current_user, effective_scope)

@router.get("/cases/{case_id}/timeline")
@router.get("/cases/{case_id}/history")
def get_case_timeline(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_CASE_READ,
        p.SUPERVISION_READ
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.get_case_timeline(db, case_id, current_user, effective_scope)

# ==================== ESCALATIONS ====================

@router.get("/escalations", response_model=List[EscalationResponse])
def list_escalations(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_READ,
        p.SUPERVISION_READ
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.list_escalations(
        db, current_user, effective_scope,
        status=status,
        severity=severity,
        level=level,
        resource_type=resource_type,
        search=search,
        skip=skip,
        limit=limit
    )

@router.post("/escalations", response_model=EscalationResponse, status_code=status.HTTP_201_CREATED)
def create_escalation(
    payload: EscalationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_CREATE,
        p.SUPERVISION_ESCALATE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.create_escalation(db, payload, current_user, effective_scope)

@router.get("/escalations/{escalation_id}", response_model=EscalationResponse)
def get_escalation(
    escalation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_READ,
        p.SUPERVISION_READ
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.get_escalation(db, escalation_id, current_user, effective_scope)

@router.post("/escalations/{escalation_id}/acknowledge", response_model=EscalationResponse)
def acknowledge_escalation(
    escalation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_ASSIGN,
        p.SUPERVISION_ASSIGN,
        p.SUPERVISION_REVIEW
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.acknowledge_escalation(db, escalation_id, current_user, effective_scope)

@router.post("/escalations/{escalation_id}/assign", response_model=EscalationResponse)
def assign_escalation(
    escalation_id: uuid.UUID,
    payload: EscalationAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_ASSIGN,
        p.SUPERVISION_ASSIGN
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.assign_escalation(db, escalation_id, payload, current_user, effective_scope)

@router.post("/escalations/{escalation_id}/resolve", response_model=EscalationResponse)
def resolve_escalation(
    escalation_id: uuid.UUID,
    payload: EscalationResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_RESOLVE,
        p.SUPERVISION_DECIDE,
        p.SUPERVISION_APPROVE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.resolve_escalation(db, escalation_id, payload, current_user, effective_scope)

@router.post("/escalations/{escalation_id}/close", response_model=EscalationResponse)
def close_escalation(
    escalation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.ESCALATION_CLOSE,
        p.SUPERVISION_CLOSE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.close_escalation(db, escalation_id, current_user, effective_scope)

@router.post("/escalations/trigger-scan")
def run_automatic_escalation_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISION_CREATE,
        p.SUPERVISION_ESCALATE
    )),
):
    results = EscalationEngine.evaluate_automatic_triggers(db, current_user)
    return {"status": "success", "triggered_count": len(results), "triggered": results}

# ==================== DECISIONS ====================

@router.get("/decisions", response_model=List[SupervisoryDecisionResponse])
def list_supervisory_decisions(
    status: Optional[str] = Query(None),
    decision_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_DECISION_READ,
        p.SUPERVISION_DECISIONS,
        p.SUPERVISION_READ
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.list_decisions(
        db, current_user, effective_scope,
        status=status,
        decision_type=decision_type,
        skip=skip,
        limit=limit
    )

@router.get("/decisions/{decision_id}", response_model=SupervisoryDecisionResponse)
def get_supervisory_decision(
    decision_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_DECISION_READ,
        p.SUPERVISION_DECISIONS
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.get_decision(db, decision_id, current_user, effective_scope)

@router.post("/decisions/{decision_id}/approve", response_model=SupervisoryDecisionResponse)
def approve_supervisory_decision(
    decision_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        p.SUPERVISORY_DECISION_APPROVE,
        p.SUPERVISION_APPROVE
    )),
    effective_scope: ScopeType = Depends(get_user_effective_scope),
):
    return SupervisionService.approve_decision(db, decision_id, current_user, effective_scope)
