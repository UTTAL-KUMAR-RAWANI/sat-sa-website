import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_id: uuid.UUID
    type: str
    title: str
    message: str
    priority: str
    is_read: bool
    resource_type: Optional[str] = None
    resource_id: Optional[uuid.UUID] = None
    business_reference: Optional[str] = None
    action_url: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    limit: int
    pages: int


class UnreadCountResponse(BaseModel):
    unread_count: int
