import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.identity import User
from app.rbac.deps import get_current_user
from app.notifications.service import NotificationService
from app.notifications.schemas import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
)

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get paginated notifications for the authenticated user",
)
def list_notifications(
    is_read: Optional[bool] = Query(None),
    priority: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationService.list_notifications(
        db=db,
        user_id=current_user.id,
        is_read=is_read,
        priority=priority,
        type=type,
        resource_type=resource_type,
        search=search,
        page=page,
        limit=limit,
    )


@notifications_router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get total unread notifications count for the authenticated user",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = NotificationService.get_unread_count(db=db, user_id=current_user.id)
    return UnreadCountResponse(unread_count=count)


@notifications_router.post(
    "/{id}/read",
    response_model=NotificationResponse,
    summary="Mark a specific notification as read",
)
def mark_as_read(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = NotificationService.mark_as_read(
        db=db,
        user_id=current_user.id,
        notification_id=id,
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access denied.",
        )
    return notif


@notifications_router.post(
    "/{id}/unread",
    response_model=NotificationResponse,
    summary="Mark a specific notification as unread",
)
def mark_as_unread(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = NotificationService.mark_as_unread(
        db=db,
        user_id=current_user.id,
        notification_id=id,
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access denied.",
        )
    return notif


@notifications_router.post(
    "/read-all",
    summary="Mark all unread notifications as read for current user",
)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = NotificationService.mark_all_as_read(db=db, user_id=current_user.id)
    return {"message": "All notifications marked as read", "updated_count": updated}
