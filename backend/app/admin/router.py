from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.identity import User
from app.rbac import permissions as p
from app.rbac.deps import require_permission, require_any_permission
from app.admin import schemas
from app.admin.service import AdminService

router = APIRouter()

# --- 1. Dashboard Overview ---
@router.get("/dashboard", response_model=schemas.AdminDashboardStats)
def get_admin_dashboard(
    current_user: User = Depends(require_any_permission(p.SYSTEM_STATUS_READ, p.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.get_dashboard_stats(db)

# --- 2. Users Management ---
@router.get("/users", response_model=List[schemas.AdminUserResponse])
def list_users(
    query: Optional[str] = Query(None, description="Search query by name, username, or email"),
    role_id: Optional[str] = Query(None, description="Filter by role ID"),
    department_id: Optional[str] = Query(None, description="Filter by department ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_permission(p.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_users(
        db=db,
        query=query,
        role_id=role_id,
        department_id=department_id,
        is_active=is_active,
        skip=skip,
        limit=limit
    )

@router.post("/users", response_model=schemas.AdminUserResponse)
def create_user(
    req: schemas.CreateUserRequest,
    current_user: User = Depends(require_permission(p.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.create_user(db=db, actor=current_user, req=req)

@router.patch("/users/{user_id}", response_model=schemas.AdminUserResponse)
def update_user(
    user_id: str,
    req: schemas.UpdateUserRequest,
    current_user: User = Depends(require_permission(p.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.update_user(db=db, actor=current_user, user_id=user_id, req=req)

@router.post("/users/{user_id}/status", response_model=schemas.AdminUserResponse)
def toggle_user_status(
    user_id: str,
    req: schemas.ToggleUserStatusRequest,
    current_user: User = Depends(require_permission(p.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.toggle_user_status(db=db, actor=current_user, user_id=user_id, is_active=req.is_active)

# --- 3. Role Management ---
@router.get("/roles", response_model=List[schemas.AdminRoleResponse])
def list_roles(
    current_user: User = Depends(require_permission(p.ROLES_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_roles(db)

@router.put("/roles/{role_id}/permissions", response_model=schemas.AdminRoleResponse)
def update_role_permissions(
    role_id: str,
    req: schemas.UpdateRolePermissionsRequest,
    current_user: User = Depends(require_permission(p.ROLES_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.update_role_permissions(db=db, actor=current_user, role_id=role_id, permission_ids=req.permission_ids)

# --- 4. Permissions Catalog ---
@router.get("/permissions", response_model=List[schemas.GroupedPermissionsResponse])
def list_permissions(
    current_user: User = Depends(require_any_permission(p.PERMISSIONS_READ, p.PERMISSIONS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_permissions(db)

# --- 5. Departments ---
@router.get("/departments", response_model=List[schemas.DepartmentResponse])
def list_departments(
    current_user: User = Depends(require_permission(p.DEPARTMENTS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_departments(db)

@router.post("/departments", response_model=schemas.DepartmentResponse)
def create_department(
    req: schemas.CreateDepartmentRequest,
    current_user: User = Depends(require_permission(p.DEPARTMENTS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.create_department(db=db, actor=current_user, req=req)

# --- 6. Organizations ---
@router.get("/organizations", response_model=List[schemas.OrganizationResponse])
def list_organizations(
    current_user: User = Depends(require_permission(p.ORGANIZATIONS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_organizations(db)

@router.post("/organizations", response_model=schemas.OrganizationResponse)
def create_organization(
    req: schemas.CreateOrganizationRequest,
    current_user: User = Depends(require_permission(p.ORGANIZATIONS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.create_organization(db=db, actor=current_user, req=req)

# --- 7. Sectors ---
@router.get("/sectors", response_model=List[schemas.SectorResponse])
def list_sectors(
    current_user: User = Depends(require_permission(p.SECTORS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_sectors(db)

@router.post("/sectors", response_model=schemas.SectorResponse)
def create_sector(
    req: schemas.CreateSectorRequest,
    current_user: User = Depends(require_permission(p.SECTORS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.create_sector(db=db, actor=current_user, req=req)

# --- 8. Access Requests ---
@router.get("/access-requests", response_model=List[schemas.AccessRequestResponse])
def list_access_requests(
    status: Optional[str] = Query(None, description="Filter by status (PENDING, APPROVED, REJECTED)"),
    current_user: User = Depends(require_permission(p.ACCESS_REQUESTS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_access_requests(db=db, status_filter=status)

@router.post("/access-requests/{request_id}/review", response_model=schemas.AccessRequestResponse)
def review_access_request(
    request_id: str,
    req: schemas.ReviewAccessRequest,
    current_user: User = Depends(require_permission(p.ACCESS_REQUESTS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.review_access_request(db=db, actor=current_user, request_id=request_id, review=req)

# --- 9. Audit Logs ---
@router.get("/audit-logs", response_model=schemas.PaginatedAuditLogsResponse)
def list_audit_logs(
    actor_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_permission(p.AUDIT_LOGS_READ)),
    db: Session = Depends(get_db)
):
    return AdminService.list_audit_logs(
        db=db,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        skip=skip,
        limit=limit
    )

# --- 10. System Settings ---
@router.get("/settings", response_model=List[schemas.SystemSettingResponse])
def list_settings(
    current_user: User = Depends(require_permission(p.SYSTEM_SETTINGS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.list_system_settings(db)

@router.patch("/settings/{key}", response_model=schemas.SystemSettingResponse)
def update_setting(
    key: str,
    req: schemas.UpdateSettingRequest,
    current_user: User = Depends(require_permission(p.SYSTEM_SETTINGS_MANAGE)),
    db: Session = Depends(get_db)
):
    return AdminService.update_system_setting(db=db, actor=current_user, key=key, req=req)

# --- 11. System Status & Health ---
@router.get("/system-status", response_model=schemas.SystemStatusResponse)
def get_system_status(
    current_user: User = Depends(require_permission(p.SYSTEM_STATUS_READ)),
    db: Session = Depends(get_db)
):
    return AdminService.get_system_status(db)
