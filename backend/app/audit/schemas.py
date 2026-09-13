import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class AuditActorInfo(BaseModel):
    id: Optional[uuid.UUID] = None
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None


class AuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    resource_type: str
    resource_id: Optional[uuid.UUID] = None
    business_reference: Optional[str] = None
    reason: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    metadata_json: Optional[Any] = None
    organization_id: Optional[uuid.UUID] = None
    organization_name: Optional[str] = None
    sector_id: Optional[uuid.UUID] = None
    sector_name: Optional[str] = None
    actor: Optional[AuditActorInfo] = None
    created_at: datetime


class PaginatedAuditLogsResponse(BaseModel):
    items: List[AuditLogItem]
    total: int
    page: int
    limit: int
    pages: int


class ResourceHistoryItem(BaseModel):
    id: uuid.UUID
    action: str
    resource_type: str
    resource_id: Optional[uuid.UUID] = None
    business_reference: Optional[str] = None
    actor_name: str
    actor_role: Optional[str] = None
    reason: Optional[str] = None
    status_transition: Optional[Dict[str, Optional[str]]] = None  # {"from": "OPEN", "to": "IN_PROGRESS"}
    field_changes: List[Dict[str, Any]] = []                      # [{"field": "priority", "old": "HIGH", "new": "CRITICAL"}]
    created_at: datetime
