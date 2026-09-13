import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.identity import User
from app.rbac import permissions as p
from app.rbac.deps import require_permission, require_any_permission
from app.rbac.service import AuthorizationService
from app.secops import schemas
from app.secops.service import SecurityOperationsService, EVIDENCE_UPLOAD_DIR

router = APIRouter()

def _to_security_event_read(evt) -> schemas.SecurityEventRead:
    return schemas.SecurityEventRead(
        id=evt.id,
        business_id=evt.business_id,
        title=evt.title,
        description=evt.description,
        event_type=evt.event_type,
        source=evt.source,
        source_system=evt.source_system,
        severity=evt.severity,
        organization_id=evt.organization_id,
        organization_name=evt.organization.name if evt.organization else None,
        sector_id=evt.sector_id,
        sector_name=evt.sector.name if evt.sector else None,
        raw_metadata=evt.raw_metadata,
        created_at=evt.created_at,
        updated_at=evt.updated_at
    )

def _to_alert_read(alert) -> schemas.AlertRead:
    return schemas.AlertRead(
        id=alert.id,
        business_id=alert.business_id,
        title=alert.title,
        description=alert.description,
        severity=alert.severity,
        priority=alert.priority,
        status=alert.status,
        source=alert.source,
        security_event_id=alert.security_event_id,
        cse_id=alert.cse_id,
        cse_business_id=alert.cse.business_id if alert.cse else None,
        organization_id=alert.organization_id,
        organization_name=alert.organization.name if alert.organization else None,
        sector_id=alert.sector_id,
        sector_name=alert.sector.name if alert.sector else None,
        assigned_to_id=alert.assigned_to_id,
        assigned_to_name=f"{alert.assigned_to.first_name or ''} {alert.assigned_to.last_name or ''}".strip() or alert.assigned_to.username if alert.assigned_to else None,
        triage_notes=alert.triage_notes,
        triage_decision=alert.triage_decision,
        triaged_by_id=alert.triaged_by_id,
        triaged_by_name=f"{alert.triaged_by.first_name or ''} {alert.triaged_by.last_name or ''}".strip() or alert.triaged_by.username if alert.triaged_by else None,
        triaged_at=alert.triaged_at,
        created_at=alert.created_at,
        updated_at=alert.updated_at
    )

def _to_cse_read(cse, db: Session) -> schemas.CSERead:
    # Originating alert
    originating_alert = next((a for a in getattr(cse, "alerts", [])), None)
    
    return schemas.CSERead(
        id=cse.id,
        business_id=cse.business_id,
        title=cse.title,
        description=cse.description,
        severity=cse.severity,
        priority=cse.priority,
        status=cse.status,
        source=cse.source,
        organization_id=cse.organization_id,
        organization_name=cse.organization.name if cse.organization else None,
        sector_id=cse.sector_id,
        sector_name=cse.sector.name if cse.sector else None,
        created_by_id=cse.created_by_id,
        created_by_name=cse.created_by.username if cse.created_by else None,
        assigned_to_id=cse.assigned_to_id,
        assigned_to_name=f"{cse.assigned_to.first_name or ''} {cse.assigned_to.last_name or ''}".strip() or cse.assigned_to.username if cse.assigned_to else None,
        originating_alert_id=originating_alert.id if originating_alert else None,
        originating_alert_business_id=originating_alert.business_id if originating_alert else None,
        investigation_count=len(cse.investigations) if getattr(cse, "investigations", None) else 0,
        evidence_count=len(cse.evidence) if getattr(cse, "evidence", None) else 0,
        escalation_count=0,
        created_at=cse.created_at,
        updated_at=cse.updated_at
    )

def _to_investigation_read(inv) -> schemas.InvestigationRead:
    return schemas.InvestigationRead(
        id=inv.id,
        business_id=inv.business_id,
        title=inv.title,
        description=inv.description,
        status=inv.status,
        cse_id=inv.cse_id,
        cse_business_id=inv.cse.business_id if inv.cse else None,
        cse_title=inv.cse.title if inv.cse else None,
        lead_analyst_id=inv.lead_analyst_id,
        lead_analyst_name=f"{inv.lead_analyst.first_name or ''} {inv.lead_analyst.last_name or ''}".strip() or inv.lead_analyst.username if inv.lead_analyst else None,
        started_at=inv.started_at,
        completed_at=inv.completed_at,
        findings_summary=inv.findings_summary,
        evidence_count=len(inv.evidence) if getattr(inv, "evidence", None) else 0,
        created_at=inv.created_at,
        updated_at=inv.updated_at
    )

def _to_evidence_read(evd) -> schemas.EvidenceRead:
    return schemas.EvidenceRead(
        id=evd.id,
        business_id=evd.business_id,
        title=evd.title,
        description=evd.description,
        evidence_type=evd.evidence_type,
        source=evd.source,
        filename=evd.filename,
        content_type=evd.content_type,
        file_size=evd.file_size,
        checksum=evd.checksum,
        uploaded_by_id=evd.uploaded_by_id,
        uploaded_by_name=f"{evd.uploaded_by.first_name or ''} {evd.uploaded_by.last_name or ''}".strip() or evd.uploaded_by.username if evd.uploaded_by else None,
        cse_id=evd.cse_id,
        investigation_id=evd.investigation_id,
        created_at=evd.created_at
    )

def _to_escalation_read(esc) -> schemas.EscalationRead:
    return schemas.EscalationRead(
        id=esc.id,
        business_id=esc.business_id,
        resource_type=esc.resource_type,
        resource_id=esc.resource_id,
        reason=esc.reason,
        severity=esc.severity,
        status=esc.status,
        escalated_by_id=esc.escalated_by_id,
        escalated_by_name=f"{esc.escalated_by.first_name or ''} {esc.escalated_by.last_name or ''}".strip() or esc.escalated_by.username if esc.escalated_by else None,
        escalated_to_id=esc.escalated_to_id,
        escalated_to_name=f"{esc.escalated_to.first_name or ''} {esc.escalated_to.last_name or ''}".strip() or esc.escalated_to.username if esc.escalated_to else None,
        escalated_to_role_id=esc.escalated_to_role_id,
        escalated_to_role_name=esc.escalated_to_role.name if esc.escalated_to_role else None,
        resolution=esc.resolution,
        resolved_at=esc.resolved_at,
        created_at=esc.created_at
    )

# ==================== Security Events Endpoints ====================

@router.get("/security-events", response_model=schemas.PaginatedResponse[schemas.SecurityEventRead])
def list_security_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.ALERTS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_security_events(db, current_user, scope, page, limit)
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[_to_security_event_read(x) for x in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.post("/security-events", response_model=schemas.SecurityEventRead)
def create_security_event(
    req: schemas.SecurityEventCreate,
    current_user: User = Depends(require_permission(p.ALERTS_MANAGE)),
    db: Session = Depends(get_db)
):
    evt = SecurityOperationsService.create_security_event(db, current_user, req)
    return _to_security_event_read(evt)

# ==================== Alerts Endpoints ====================

@router.get("/alerts", response_model=schemas.PaginatedResponse[schemas.AlertRead])
def list_alerts(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    organization_id: Optional[uuid.UUID] = Query(None),
    sector_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.ALERTS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_alerts(
        db, current_user, scope,
        search=search, status_filter=status, severity=severity, priority=priority,
        organization_id=organization_id, sector_id=sector_id, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[_to_alert_read(x) for x in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.get("/alerts/{alert_id}", response_model=schemas.AlertRead)
def get_alert(
    alert_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.ALERTS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    alert = SecurityOperationsService.get_alert(db, current_user, scope, alert_id)
    return _to_alert_read(alert)

@router.post("/alerts", response_model=schemas.AlertRead)
def create_alert(
    req: schemas.AlertCreate,
    current_user: User = Depends(require_permission(p.ALERTS_MANAGE)),
    db: Session = Depends(get_db)
):
    alert = SecurityOperationsService.create_alert(db, current_user, req)
    return _to_alert_read(alert)

@router.post("/alerts/{alert_id}/triage", response_model=schemas.AlertRead)
def triage_alert(
    alert_id: uuid.UUID,
    req: schemas.AlertTriageRequest,
    current_user: User = Depends(require_permission(p.ALERTS_MANAGE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    alert, _ = SecurityOperationsService.triage_alert(db, current_user, scope, alert_id, req)
    return _to_alert_read(alert)

@router.post("/alerts/{alert_id}/transition", response_model=schemas.AlertRead)
def transition_alert(
    alert_id: uuid.UUID,
    req: schemas.AlertTransitionRequest,
    current_user: User = Depends(require_permission(p.ALERTS_MANAGE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    alert = SecurityOperationsService.transition_alert(db, current_user, scope, alert_id, req.to_status, req.reason)
    return _to_alert_read(alert)

# ==================== CSE Endpoints ====================

@router.get("/cse", response_model=schemas.PaginatedResponse[schemas.CSERead])
def list_cses(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    organization_id: Optional[uuid.UUID] = Query(None),
    sector_id: Optional[uuid.UUID] = Query(None),
    assigned_to_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.CSE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_cses(
        db, current_user, scope,
        search=search, status_filter=status, severity=severity, priority=priority,
        organization_id=organization_id, sector_id=sector_id, assigned_to_id=assigned_to_id,
        page=page, limit=limit
    )
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[_to_cse_read(x, db) for x in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.get("/cse/{cse_id}", response_model=schemas.CSERead)
def get_cse(
    cse_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.CSE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    cse = SecurityOperationsService.get_cse(db, current_user, scope, cse_id)
    return _to_cse_read(cse, db)

@router.post("/cse", response_model=schemas.CSERead)
def create_cse(
    req: schemas.CSECreate,
    current_user: User = Depends(require_permission(p.CSE_CREATE)),
    db: Session = Depends(get_db)
):
    cse = SecurityOperationsService.create_cse(db, current_user, req)
    return _to_cse_read(cse, db)

@router.patch("/cse/{cse_id}", response_model=schemas.CSERead)
def update_cse(
    cse_id: uuid.UUID,
    req: schemas.CSEUpdateRequest,
    current_user: User = Depends(require_permission(p.CSE_UPDATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    cse = SecurityOperationsService.update_cse(db, current_user, scope, cse_id, req)
    return _to_cse_read(cse, db)

@router.post("/cse/{cse_id}/assign", response_model=schemas.CSERead)
def assign_cse(
    cse_id: uuid.UUID,
    req: schemas.CSEAssignRequest,
    current_user: User = Depends(require_permission(p.CSE_ASSIGN)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    cse = SecurityOperationsService.assign_cse(db, current_user, scope, cse_id, req)
    return _to_cse_read(cse, db)

@router.post("/cse/{cse_id}/transition", response_model=schemas.CSERead)
def transition_cse(
    cse_id: uuid.UUID,
    req: schemas.CSETransitionRequest,
    current_user: User = Depends(require_any_permission(p.CSE_UPDATE, p.CSE_CLOSE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    cse = SecurityOperationsService.transition_cse(db, current_user, scope, cse_id, req.to_status, req.reason)
    return _to_cse_read(cse, db)

@router.post("/cse/{cse_id}/escalate", response_model=schemas.EscalationRead)
def escalate_cse(
    cse_id: uuid.UUID,
    req: schemas.CSEEscalateRequest,
    current_user: User = Depends(require_permission(p.CSE_ESCALATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    esc_data = schemas.EscalationCreate(
        resource_type="CSE",
        resource_id=cse_id,
        reason=req.reason,
        severity=req.severity,
        escalated_to_id=req.escalated_to_user_id
    )
    esc = SecurityOperationsService.escalate_cse(db, current_user, scope, cse_id, esc_data)
    return _to_escalation_read(esc)

@router.get("/cse/{cse_id}/timeline", response_model=List[schemas.TimelineEventRead])
def get_cse_timeline(
    cse_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.CSE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    # Ensure user has access to CSE
    SecurityOperationsService.get_cse(db, current_user, scope, cse_id)
    return SecurityOperationsService.get_timeline(db, current_user, scope, "CSE", cse_id)

# ==================== Investigations Endpoints ====================

@router.get("/investigations", response_model=schemas.PaginatedResponse[schemas.InvestigationRead])
def list_investigations(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    cse_id: Optional[uuid.UUID] = Query(None),
    lead_analyst_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_investigations(
        db, current_user, scope,
        search=search, status_filter=status, cse_id=cse_id, lead_analyst_id=lead_analyst_id,
        page=page, limit=limit
    )
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[_to_investigation_read(x) for x in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.get("/investigations/{inv_id}", response_model=schemas.InvestigationRead)
def get_investigation(
    inv_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    inv = SecurityOperationsService.get_investigation(db, current_user, scope, inv_id)
    return _to_investigation_read(inv)

@router.post("/investigations", response_model=schemas.InvestigationRead)
def create_investigation(
    req: schemas.InvestigationCreate,
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_CREATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    inv = SecurityOperationsService.create_investigation(db, current_user, scope, req)
    return _to_investigation_read(inv)

@router.patch("/investigations/{inv_id}", response_model=schemas.InvestigationRead)
def update_investigation(
    inv_id: uuid.UUID,
    req: schemas.InvestigationUpdateRequest,
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_UPDATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    inv = SecurityOperationsService.update_investigation(db, current_user, scope, inv_id, req)
    return _to_investigation_read(inv)

@router.post("/investigations/{inv_id}/transition", response_model=schemas.InvestigationRead)
def transition_investigation(
    inv_id: uuid.UUID,
    req: schemas.InvestigationTransitionRequest,
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_UPDATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    inv = SecurityOperationsService.transition_investigation(db, current_user, scope, inv_id, req.to_status, req.reason)
    return _to_investigation_read(inv)

@router.get("/investigations/{inv_id}/timeline", response_model=List[schemas.TimelineEventRead])
def get_investigation_timeline(
    inv_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.INVESTIGATIONS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    SecurityOperationsService.get_investigation(db, current_user, scope, inv_id)
    return SecurityOperationsService.get_timeline(db, current_user, scope, "INVESTIGATION", inv_id)

# ==================== Evidence Endpoints ====================

@router.post("/evidence/upload", response_model=schemas.EvidenceRead)
async def upload_evidence(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    evidence_type: str = Form("LOG"),
    source: Optional[str] = Form(None),
    cse_id: Optional[uuid.UUID] = Form(None),
    investigation_id: Optional[uuid.UUID] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_permission(p.EVIDENCE_CREATE)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    evd = SecurityOperationsService.upload_evidence(
        db, current_user, scope,
        title=title, description=description, evidence_type=evidence_type,
        source=source, cse_id=cse_id, investigation_id=investigation_id, file=file
    )
    return _to_evidence_read(evd)

@router.get("/evidence/{evidence_id}", response_model=schemas.EvidenceRead)
def get_evidence(
    evidence_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.EVIDENCE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    evd = SecurityOperationsService.get_evidence(db, current_user, scope, evidence_id)
    return _to_evidence_read(evd)

@router.get("/evidence/{evidence_id}/download")
def download_evidence(
    evidence_id: uuid.UUID,
    current_user: User = Depends(require_permission(p.EVIDENCE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    evd = SecurityOperationsService.get_evidence(db, current_user, scope, evidence_id)
    
    if not evd.file_uri:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No file attached to this evidence record")
    
    file_path = os.path.join(EVIDENCE_UPLOAD_DIR, evd.file_uri)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file could not be found")
    
    return FileResponse(
        path=file_path,
        media_type=evd.content_type or "application/octet-stream",
        filename=evd.filename or "evidence.bin"
    )

# ==================== Escalations Endpoints ====================

@router.get("/escalations", response_model=schemas.PaginatedResponse[schemas.EscalationRead])
def list_escalations(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.CSE_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_escalations(db, current_user, scope, status_filter=status, page=page, limit=limit)
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[_to_escalation_read(x) for x in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.post("/escalations/{escalation_id}/resolve", response_model=schemas.EscalationRead)
def resolve_escalation(
    escalation_id: uuid.UUID,
    req: schemas.EscalationResolveRequest,
    current_user: User = Depends(require_any_permission(p.CSE_ESCALATE, p.SUPERVISION_DECISIONS)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    esc = SecurityOperationsService.resolve_escalation(db, current_user, scope, escalation_id, req)
    return _to_escalation_read(esc)

# ==================== Assignments Endpoints ====================

@router.get("/assignments", response_model=schemas.PaginatedResponse[schemas.AssignmentRead])
def list_assignments(
    user_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(p.ASSIGNMENTS_READ)),
    db: Session = Depends(get_db)
):
    scope = AuthorizationService.get_user_effective_scope(current_user)
    items, total = SecurityOperationsService.list_assignments(db, current_user, scope, user_id=user_id, page=page, limit=limit)
    pages = (total + limit - 1) // limit if limit else 1
    return schemas.PaginatedResponse(
        items=[
            schemas.AssignmentRead(
                id=a.id,
                resource_type=a.resource_type,
                resource_id=a.resource_id,
                assigned_to_id=a.assigned_to_id,
                assigned_to_name=f"{a.assigned_to.first_name or ''} {a.assigned_to.last_name or ''}".strip() or a.assigned_to.username if a.assigned_to else None,
                assigned_by_id=a.assigned_by_id,
                assigned_by_name=f"{a.assigned_by.first_name or ''} {a.assigned_by.last_name or ''}".strip() or a.assigned_by.username if a.assigned_by else None,
                assignment_type=a.assignment_type,
                status=a.status,
                notes=a.notes,
                due_at=a.due_at,
                created_at=a.created_at
            )
            for a in items
        ],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )
