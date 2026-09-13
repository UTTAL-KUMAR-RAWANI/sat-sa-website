import io
import csv
import json
import math
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc

from app.models.identity import User
from app.models.organization import Organization, Sector
from app.models.audit import AuditLog
from app.audit.schemas import (
    AuditActorInfo,
    AuditLogItem,
    PaginatedAuditLogsResponse,
    ResourceHistoryItem,
)
from app.audit.constants import AuditActions, AuditResourceTypes

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "token",
    "secret",
    "access_token",
    "refresh_token",
    "private_key",
    "api_key",
    "client_secret",
}


class AuditService:

    @staticmethod
    def _sanitize_dict(data: Any) -> Any:
        if isinstance(data, dict):
            clean = {}
            for k, v in data.items():
                if k.lower() in SENSITIVE_KEYS:
                    clean[k] = "[REDACTED]"
                elif isinstance(v, (dict, list)):
                    clean[k] = AuditService._sanitize_dict(v)
                else:
                    clean[k] = v
            return clean
        elif isinstance(data, list):
            return [AuditService._sanitize_dict(item) for item in data]
        return data

    @staticmethod
    def _parse_json_if_str(val: Any) -> Any:
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return val
        return val

    @classmethod
    def log(
        cls,
        db: Session,
        actor: Optional[Union[User, uuid.UUID]] = None,
        action: str = AuditActions.UPDATE,
        resource_type: str = AuditResourceTypes.SYSTEM_SETTINGS_MANAGE if hasattr(AuditResourceTypes, "SYSTEM_SETTINGS_MANAGE") else "SYSTEM",
        resource_id: Optional[Union[uuid.UUID, str]] = None,
        business_reference: Optional[str] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
        sector_id: Optional[uuid.UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        auto_commit: bool = False,
    ) -> AuditLog:
        actor_id: Optional[uuid.UUID] = None
        if isinstance(actor, User):
            actor_id = actor.id
            if not organization_id and actor.organization_id:
                organization_id = actor.organization_id
            if not sector_id and actor.sector_id:
                sector_id = actor.sector_id
        elif isinstance(actor, uuid.UUID):
            actor_id = actor

        res_uuid: Optional[uuid.UUID] = None
        if resource_id:
            if isinstance(resource_id, str):
                try:
                    res_uuid = uuid.UUID(resource_id)
                except ValueError:
                    res_uuid = None
            elif isinstance(resource_id, uuid.UUID):
                res_uuid = resource_id

        sanitized_old = cls._sanitize_dict(old_value) if old_value else None
        sanitized_new = cls._sanitize_dict(new_value) if new_value else None
        sanitized_meta = cls._sanitize_dict(metadata) if metadata else None

        audit_entry = AuditLog(
            actor_user_id=actor_id,
            action=action.upper(),
            resource_type=resource_type.upper(),
            resource_id=res_uuid,
            business_reference=business_reference,
            reason=reason,
            old_value=sanitized_old,
            new_value=sanitized_new,
            metadata_json=sanitized_meta,
            organization_id=organization_id,
            sector_id=sector_id,
        )
        db.add(audit_entry)

        if auto_commit:
            db.commit()
            db.refresh(audit_entry)

        return audit_entry

    @classmethod
    def get_resource_history(
        cls,
        db: Session,
        resource_type: str,
        resource_id: Union[uuid.UUID, str],
    ) -> List[ResourceHistoryItem]:
        res_uuid: Optional[uuid.UUID] = None
        if isinstance(resource_id, str):
            try:
                res_uuid = uuid.UUID(resource_id)
            except ValueError:
                return []
        elif isinstance(resource_id, uuid.UUID):
            res_uuid = resource_id

        logs = (
            db.query(AuditLog)
            .options(joinedload(AuditLog.actor_user))
            .filter(
                AuditLog.resource_type == resource_type.upper(),
                AuditLog.resource_id == res_uuid,
            )
            .order_by(desc(AuditLog.created_at))
            .all()
        )

        history_items: List[ResourceHistoryItem] = []
        for l in logs:
            actor = l.actor_user
            if actor:
                actor_name = f"{actor.first_name or ''} {actor.last_name or ''}".strip() or actor.username
                actor_role = actor.roles[0].name if actor.roles else None
            else:
                actor_name = "System Automated Process"
                actor_role = "SYSTEM"

            # Check status transition
            status_transition = None
            old_val = l.old_value or {}
            new_val = l.new_value or {}
            if "status" in old_val or "status" in new_val:
                status_transition = {
                    "from": old_val.get("status"),
                    "to": new_val.get("status"),
                }

            # Field level diffs
            field_changes: List[Dict[str, Any]] = []
            all_keys = set(list(old_val.keys()) + list(new_val.keys()))
            for k in all_keys:
                if k in SENSITIVE_KEYS or k in ["updated_at", "created_at"]:
                    continue
                v_old = old_val.get(k)
                v_new = new_val.get(k)
                if v_old != v_new:
                    field_changes.append({
                        "field": k,
                        "old": str(v_old) if v_old is not None else None,
                        "new": str(v_new) if v_new is not None else None,
                    })

            history_items.append(
                ResourceHistoryItem(
                    id=l.id,
                    action=l.action,
                    resource_type=l.resource_type,
                    resource_id=l.resource_id,
                    business_reference=l.business_reference,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    reason=l.reason,
                    status_transition=status_transition,
                    field_changes=field_changes,
                    created_at=l.created_at,
                )
            )

        return history_items

    @classmethod
    def list_audit_logs(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        organization_id: Optional[str] = None,
        sector_id: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> PaginatedAuditLogsResponse:
        q = db.query(AuditLog).options(
            joinedload(AuditLog.actor_user),
            joinedload(AuditLog.organization),
            joinedload(AuditLog.sector),
        )

        # Apply Scope isolation
        if effective_scope == "organization" and user.organization_id:
            q = q.filter(AuditLog.organization_id == user.organization_id)
        elif effective_scope == "sector" and user.sector_id:
            q = q.filter(AuditLog.sector_id == user.sector_id)

        # Filters
        if actor_id:
            try:
                a_uuid = uuid.UUID(actor_id)
                q = q.filter(AuditLog.actor_user_id == a_uuid)
            except ValueError:
                pass

        if action and action != "ALL":
            q = q.filter(AuditLog.action == action.upper())

        if resource_type and resource_type != "ALL":
            q = q.filter(AuditLog.resource_type == resource_type.upper())

        if organization_id:
            try:
                org_uuid = uuid.UUID(organization_id)
                q = q.filter(AuditLog.organization_id == org_uuid)
            except ValueError:
                pass

        if sector_id:
            try:
                sec_uuid = uuid.UUID(sector_id)
                q = q.filter(AuditLog.sector_id == sec_uuid)
            except ValueError:
                pass

        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)

        if date_to:
            q = q.filter(AuditLog.created_at <= date_to)

        if search:
            s_term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    AuditLog.action.ilike(s_term),
                    AuditLog.resource_type.ilike(s_term),
                    AuditLog.business_reference.ilike(s_term),
                    AuditLog.reason.ilike(s_term),
                )
            )

        total = q.count()
        pages = math.ceil(total / limit) if total > 0 else 1
        skip = (page - 1) * limit
        records = q.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

        items: List[AuditLogItem] = []
        for r in records:
            actor_info = None
            if r.actor_user:
                actor_info = AuditActorInfo(
                    id=r.actor_user.id,
                    username=r.actor_user.username,
                    email=r.actor_user.email,
                    name=f"{r.actor_user.first_name or ''} {r.actor_user.last_name or ''}".strip() or r.actor_user.username,
                    role=r.actor_user.roles[0].name if r.actor_user.roles else None,
                )

            items.append(
                AuditLogItem(
                    id=r.id,
                    action=r.action,
                    resource_type=r.resource_type,
                    resource_id=r.resource_id,
                    business_reference=r.business_reference,
                    reason=r.reason,
                    old_value=cls._parse_json_if_str(r.old_value),
                    new_value=cls._parse_json_if_str(r.new_value),
                    metadata_json=cls._parse_json_if_str(r.metadata_json),
                    organization_id=r.organization_id,
                    organization_name=r.organization.name if r.organization else None,
                    sector_id=r.sector_id,
                    sector_name=r.sector.name if r.sector else None,
                    actor=actor_info,
                    created_at=r.created_at,
                )
            )

        return PaginatedAuditLogsResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    @classmethod
    def export_audit_logs_csv(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> str:
        # Fetch up to 1000 records for CSV export
        paginated = cls.list_audit_logs(
            db=db,
            user=user,
            effective_scope=effective_scope,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            search=search,
            date_from=date_from,
            date_to=date_to,
            page=1,
            limit=1000,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Audit ID",
            "Timestamp (UTC)",
            "Action",
            "Resource Type",
            "Resource ID",
            "Business Reference",
            "Actor Username",
            "Actor Name",
            "Organization",
            "Sector",
            "Reason / Comment",
        ])

        for item in paginated.items:
            writer.writerow([
                str(item.id),
                item.created_at.isoformat() if item.created_at else "",
                item.action,
                item.resource_type,
                str(item.resource_id) if item.resource_id else "",
                item.business_reference or "",
                item.actor.username if item.actor else "SYSTEM",
                item.actor.name if item.actor else "System Process",
                item.organization_name or "",
                item.sector_name or "",
                item.reason or "",
            ])

        # Self-audit the export operation
        cls.log(
            db=db,
            actor=user,
            action=AuditActions.EXPORT,
            resource_type="AUDIT_LOG",
            reason=f"Exported {len(paginated.items)} audit log records under {effective_scope} scope.",
            auto_commit=True,
        )

        return output.getvalue()
