import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.identity import User
from app.models.audit import AuditLog
from app.rbac import permissions as p
from app.rbac.deps import require_permission, get_effective_scope, get_current_user
from app.audit.service import AuditService
from app.audit.schemas import (
    AuditLogItem,
    PaginatedAuditLogsResponse,
    ResourceHistoryItem,
)

audit_router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@audit_router.get(
    "",
    response_model=PaginatedAuditLogsResponse,
    summary="List platform-wide audit logs with filtering and scope isolation",
)
def list_audit_logs(
    actor_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    organization_id: Optional[str] = Query(None),
    sector_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.AUDIT_LOGS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return AuditService.list_audit_logs(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
        organization_id=organization_id,
        sector_id=sector_id,
        page=page,
        limit=limit,
    )


@audit_router.get(
    "/export",
    summary="Export filtered audit logs as CSV with immutable self-audit trail",
)
def export_audit_logs(
    actor_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.AUDIT_LOGS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    csv_content = AuditService.export_audit_logs_csv(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    filename = f"sat_sa_audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@audit_router.get(
    "/resource/{resource_type}/{resource_id}",
    response_model=List[ResourceHistoryItem],
    summary="Get unified activity timeline and audit history for a specific workflow resource",
)
def get_resource_history(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AuditService.get_resource_history(
        db=db,
        resource_type=resource_type,
        resource_id=resource_id,
    )


@audit_router.get(
    "/{id}",
    response_model=AuditLogItem,
    summary="Get single audit log entry by ID",
)
def get_audit_log(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.AUDIT_LOGS_READ)),
):
    log_entry = db.query(AuditLog).filter(AuditLog.id == id).first()
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log record not found.",
        )
    return log_entry
