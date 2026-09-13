from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.identity import User
from app.models.security import CSE
from app.models.assessment import Assessment
from app.rbac.service import AuthorizationService
from app.rbac.deps import require_permission
from app.rbac import permissions as p

router = APIRouter()

class PermissionCheckRequest(BaseModel):
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None

class PermissionCheckResponse(BaseModel):
    allowed: bool
    action: str
    effective_scope: str
    reason: Optional[str] = None

@router.post("/check", response_model=PermissionCheckResponse)
def check_permission(
    req: PermissionCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resource: Any = None
    if req.resource_type and req.resource_id:
        try:
            res_uuid = uuid.UUID(req.resource_id)
            if req.resource_type.lower() == "cse":
                resource = db.query(CSE).filter(CSE.id == res_uuid).first()
            elif req.resource_type.lower() == "assessment":
                resource = db.query(Assessment).filter(Assessment.id == res_uuid).first()
        except ValueError:
            pass

    user_perms = AuthorizationService.get_user_permissions(current_user)
    effective_scope = AuthorizationService.get_user_effective_scope(current_user)

    if req.action not in user_perms:
        return PermissionCheckResponse(
            allowed=False,
            action=req.action,
            effective_scope=effective_scope,
            reason=f"User lacks '{req.action}' permission"
        )

    # If resource specified, check scope and separation
    if resource is not None:
        try:
            AuthorizationService.authorize(
                user=current_user,
                action=req.action,
                resource=resource,
                db=db,
                raise_exception=True
            )
        except HTTPException as exc:
            return PermissionCheckResponse(
                allowed=False,
                action=req.action,
                effective_scope=effective_scope,
                reason=exc.detail
            )

    return PermissionCheckResponse(
        allowed=True,
        action=req.action,
        effective_scope=effective_scope,
        reason=None
    )

@router.get("/admin/status")
def get_admin_status(
    current_user: User = Depends(require_permission(p.SYSTEM_STATUS_READ))
):
    """Protected administrative route for verifying administrative permission enforcement."""
    return {
        "status": "HEALTHY",
        "authorized_admin": current_user.email,
        "detail": "SAT-SA administrative subsystem operational"
    }

@router.get("/supervision/overview")
def get_supervision_overview(
    current_user: User = Depends(require_permission(p.SUPERVISION_DECISIONS))
):
    """Protected supervision authority route."""
    return {
        "status": "ACTIVE",
        "supervisory_authority": current_user.email,
        "detail": "Supervisory decisions oversight panel"
    }
