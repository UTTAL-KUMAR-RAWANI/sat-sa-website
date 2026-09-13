from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime

# --- Dashboard Stats ---
class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    total_organizations: int
    total_sectors: int
    total_departments: int
    total_roles: int
    pending_access_requests: int
    system_status: str
    database_connected: bool
    recent_audit_actions: List[Dict[str, Any]]

# --- Users ---
class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    sector_id: Optional[str] = None
    sector_name: Optional[str] = None
    roles: List[str] = []
    scope: str

class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: Optional[str] = None
    organization_id: Optional[str] = None
    sector_id: Optional[str] = None
    role_ids: List[str] = []

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    organization_id: Optional[str] = None
    sector_id: Optional[str] = None
    role_ids: Optional[List[str]] = None

class ToggleUserStatusRequest(BaseModel):
    is_active: bool

# --- Roles ---
class AdminRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    scope_type: str
    is_active: bool
    permission_count: int
    assigned_users_count: int
    permissions: List[str] = []

class CreateRoleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    scope_type: str = "organization"
    permission_ids: List[str] = []

class UpdateRoleRequest(BaseModel):
    description: Optional[str] = None
    scope_type: Optional[str] = None
    is_active: Optional[bool] = None

class UpdateRolePermissionsRequest(BaseModel):
    permission_ids: List[str]

# --- Permissions ---
class PermissionItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class GroupedPermissionsResponse(BaseModel):
    category: str
    permissions: List[PermissionItem]

# --- Departments ---
class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    user_count: int = 0

class CreateDepartmentRequest(BaseModel):
    name: str
    description: Optional[str] = None

class UpdateDepartmentRequest(BaseModel):
    description: Optional[str] = None

# --- Organizations ---
class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    sector_count: int = 0
    user_count: int = 0

class CreateOrganizationRequest(BaseModel):
    name: str
    description: Optional[str] = None

class UpdateOrganizationRequest(BaseModel):
    description: Optional[str] = None

# --- Sectors ---
class SectorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    organization_id: str
    organization_name: Optional[str] = None
    user_count: int = 0

class CreateSectorRequest(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: str

class UpdateSectorRequest(BaseModel):
    description: Optional[str] = None
    organization_id: Optional[str] = None

# --- Access Requests ---
class AccessRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requester_id: str
    requester_name: str
    requester_email: str
    requested_role_id: Optional[str] = None
    requested_role_name: Optional[str] = None
    requested_organization_id: Optional[str] = None
    requested_organization_name: Optional[str] = None
    requested_sector_id: Optional[str] = None
    requested_sector_name: Optional[str] = None
    status: str
    reason: Optional[str] = None
    reviewer_name: Optional[str] = None
    created_at: datetime

class ReviewAccessRequest(BaseModel):
    decision: str # "APPROVE" or "REJECT"
    comments: Optional[str] = None

# --- Audit Logs ---
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

class PaginatedAuditLogsResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]

# --- System Settings ---
class SystemSettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    value: str
    category: str
    description: Optional[str] = None
    is_secret: bool
    updated_at: datetime

class UpdateSettingRequest(BaseModel):
    value: str

# --- System Status ---
class SystemStatusResponse(BaseModel):
    status: str # HEALTHY, DEGRADED, CRITICAL
    database_status: str
    database_latency_ms: float
    server_time: datetime
    active_connections: int
    app_version: str
    environment: str
