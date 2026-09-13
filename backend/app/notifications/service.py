import math
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Union
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from app.models.notification import Notification
from app.notifications.schemas import (
    NotificationResponse,
    NotificationListResponse,
)
from app.notifications.constants import NotificationTypes, NotificationPriorities


class NotificationService:

    @classmethod
    def notify(
        cls,
        db: Session,
        recipient_id: Union[uuid.UUID, str],
        type: str = NotificationTypes.SYSTEM,
        title: str = "System Notification",
        message: str = "",
        priority: str = NotificationPriorities.NORMAL,
        resource_type: Optional[str] = None,
        resource_id: Optional[Union[uuid.UUID, str]] = None,
        business_reference: Optional[str] = None,
        action_url: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Notification:
        recip_uuid = uuid.UUID(str(recipient_id)) if isinstance(recipient_id, (str, uuid.UUID)) else recipient_id
        res_uuid: Optional[uuid.UUID] = None
        if resource_id:
            try:
                res_uuid = uuid.UUID(str(resource_id))
            except ValueError:
                res_uuid = None

        norm_type = type.upper()
        norm_priority = priority.upper() if priority else NotificationPriorities.NORMAL
        norm_res_type = resource_type.upper() if resource_type else None

        # Deduplication Guard: Avoid duplicate unread notifications for the same resource & event
        if res_uuid and norm_res_type:
            existing = (
                db.query(Notification)
                .filter(
                    Notification.recipient_id == recip_uuid,
                    Notification.type == norm_type,
                    Notification.resource_type == norm_res_type,
                    Notification.resource_id == res_uuid,
                    Notification.is_read == False,
                )
                .first()
            )
            if existing:
                existing.title = title
                existing.message = message
                existing.priority = norm_priority
                if action_url:
                    existing.action_url = action_url
                if business_reference:
                    existing.business_reference = business_reference
                if auto_commit:
                    db.commit()
                    db.refresh(existing)
                return existing

        notif = Notification(
            recipient_id=recip_uuid,
            type=norm_type,
            title=title,
            message=message,
            priority=norm_priority,
            is_read=False,
            resource_type=norm_res_type,
            resource_id=res_uuid,
            business_reference=business_reference,
            action_url=action_url,
        )
        db.add(notif)

        if auto_commit:
            db.commit()
            db.refresh(notif)

        return notif

    @classmethod
    def list_notifications(
        cls,
        db: Session,
        user_id: uuid.UUID,
        is_read: Optional[bool] = None,
        priority: Optional[str] = None,
        type: Optional[str] = None,
        resource_type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> NotificationListResponse:
        base_q = db.query(Notification).filter(Notification.recipient_id == user_id)

        # Unread total for badge
        unread_count = (
            db.query(Notification)
            .filter(
                Notification.recipient_id == user_id,
                Notification.is_read == False,
            )
            .count()
        )

        q = base_q
        if is_read is not None:
            q = q.filter(Notification.is_read == is_read)

        if priority and priority != "ALL":
            q = q.filter(Notification.priority == priority.upper())

        if type and type != "ALL":
            q = q.filter(Notification.type == type.upper())

        if resource_type and resource_type != "ALL":
            q = q.filter(Notification.resource_type == resource_type.upper())

        if search:
            s_term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    Notification.title.ilike(s_term),
                    Notification.message.ilike(s_term),
                    Notification.business_reference.ilike(s_term),
                )
            )

        total = q.count()
        pages = math.ceil(total / limit) if total > 0 else 1
        skip = (page - 1) * limit
        records = q.order_by(desc(Notification.created_at)).offset(skip).limit(limit).all()

        items = [NotificationResponse.model_validate(r) for r in records]

        return NotificationListResponse(
            items=items,
            total=total,
            unread_count=unread_count,
            page=page,
            limit=limit,
            pages=pages,
        )

    @classmethod
    def get_unread_count(cls, db: Session, user_id: uuid.UUID) -> int:
        return (
            db.query(Notification)
            .filter(
                Notification.recipient_id == user_id,
                Notification.is_read == False,
            )
            .count()
        )

    @classmethod
    def mark_as_read(
        cls,
        db: Session,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> Optional[Notification]:
        notif = (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.recipient_id == user_id,
            )
            .first()
        )
        if not notif:
            return None

        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)
        return notif

    @classmethod
    def mark_as_unread(
        cls,
        db: Session,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> Optional[Notification]:
        notif = (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.recipient_id == user_id,
            )
            .first()
        )
        if not notif:
            return None

        notif.is_read = False
        notif.read_at = None
        db.commit()
        db.refresh(notif)
        return notif

    @classmethod
    def mark_all_as_read(cls, db: Session, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        updated_rows = (
            db.query(Notification)
            .filter(
                Notification.recipient_id == user_id,
                Notification.is_read == False,
            )
            .update(
                {Notification.is_read: True, Notification.read_at: now},
                synchronize_session="fetch",
            )
        )
        db.commit()
        return updated_rows
