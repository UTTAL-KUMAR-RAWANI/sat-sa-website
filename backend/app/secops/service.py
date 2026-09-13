import hashlib
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func, and_
from fastapi import HTTPException, status, UploadFile

from app.models.security import SecurityEvent, Alert, CSE, Investigation, Evidence
from app.models.workflow import WorkflowTransition, Assignment, Escalation
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.identity import User, Role
from app.models.organization import Organization, Sector
from app.rbac.scopes import ScopeType, check_resource_scope
from app.secops.workflow_engine import (
    validate_transition,
    ALERT_TRANSITIONS,
    CSE_TRANSITIONS,
    INVESTIGATION_TRANSITIONS,
    ESCALATION_TRANSITIONS,
)
from app.secops.schemas import (
    SecurityEventCreate,
    AlertCreate,
    AlertTriageRequest,
    CSECreate,
    CSEUpdateRequest,
    CSEAssignRequest,
    InvestigationCreate,
    InvestigationUpdateRequest,
    EscalationCreate,
    EscalationResolveRequest,
    TimelineEventRead,
)

EVIDENCE_UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "evidence")
)
os.makedirs(EVIDENCE_UPLOAD_DIR, exist_ok=True)


class SecurityOperationsService:
    @staticmethod
    def _generate_business_id(prefix: str, model_cls: Any, db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        year_prefix = f"{prefix}-{current_year}-"
        
        last_item = (
            db.query(model_cls)
            .filter(model_cls.business_id.like(f"{year_prefix}%"))
            .order_by(desc(model_cls.created_at))
            .first()
        )
        
        if last_item and last_item.business_id:
            try:
                seq = int(last_item.business_id.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
            
        return f"{year_prefix}{seq:05d}"

    @staticmethod
    def _apply_scope_filter(query: Any, model_cls: Any, user: User, effective_scope: str) -> Any:
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        
        user_org_id = getattr(user, "organization_id", None)
        user_sector_id = getattr(user, "sector_id", None)
        user_id = getattr(user, "id", None)

        if effective_scope == ScopeType.SECTOR:
            if hasattr(model_cls, "sector_id"):
                return query.filter(model_cls.sector_id == user_sector_id)
            elif model_cls == Investigation:
                return query.join(CSE, Investigation.cse_id == CSE.id).filter(CSE.sector_id == user_sector_id)
            elif model_cls == Evidence:
                return query.outerjoin(CSE, Evidence.cse_id == CSE.id).filter(
                    or_(CSE.sector_id == user_sector_id, Evidence.uploaded_by_id == user_id)
                )

        elif effective_scope == ScopeType.ORGANIZATION:
            if hasattr(model_cls, "organization_id"):
                return query.filter(model_cls.organization_id == user_org_id)
            elif model_cls == Investigation:
                return query.join(CSE, Investigation.cse_id == CSE.id).filter(CSE.organization_id == user_org_id)
            elif model_cls == Evidence:
                return query.outerjoin(CSE, Evidence.cse_id == CSE.id).filter(
                    or_(CSE.organization_id == user_org_id, Evidence.uploaded_by_id == user_id)
                )

        elif effective_scope == ScopeType.ASSIGNED:
            if hasattr(model_cls, "assigned_to_id"):
                return query.filter(model_cls.assigned_to_id == user_id)
            elif model_cls == Investigation:
                return query.filter(model_cls.lead_analyst_id == user_id)

        elif effective_scope == ScopeType.OWN:
            if hasattr(model_cls, "created_by_id"):
                return query.filter(model_cls.created_by_id == user_id)
            elif hasattr(model_cls, "uploaded_by_id"):
                return query.filter(model_cls.uploaded_by_id == user_id)

        return query

    @staticmethod
    def _verify_scope(user: User, effective_scope: str, resource: Any, resource_type: str = "Resource") -> None:
        if not check_resource_scope(user, effective_scope, resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: {resource_type} is outside your authorized operational scope."
            )

    @staticmethod
    def _create_audit(db: Session, actor_id: uuid.UUID, action: str, resource_type: str, resource_id: uuid.UUID, old_val: Any = None, new_val: Any = None) -> None:
        audit = AuditLog(
            actor_user_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_val,
            new_value=new_val
        )
        db.add(audit)

    @staticmethod
    def _create_notification(db: Session, recipient_id: uuid.UUID, n_type: str, title: str, message: str) -> None:
        notif = Notification(
            recipient_id=recipient_id,
            type=n_type,
            title=title,
            message=message,
            is_read=False
        )
        db.add(notif)

    # ==================== Security Events ====================

    @classmethod
    def list_security_events(cls, db: Session, user: User, effective_scope: str, page: int = 1, limit: int = 20) -> Tuple[List[SecurityEvent], int]:
        q = db.query(SecurityEvent)
        q = cls._apply_scope_filter(q, SecurityEvent, user, effective_scope)
        total = q.count()
        items = q.order_by(desc(SecurityEvent.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    @classmethod
    def create_security_event(cls, db: Session, user: User, data: SecurityEventCreate) -> SecurityEvent:
        biz_id = cls._generate_business_id("SEC", SecurityEvent, db)
        evt = SecurityEvent(
            business_id=biz_id,
            title=data.title,
            description=data.description,
            event_type=data.event_type,
            source=data.source,
            source_system=data.source_system,
            severity=data.severity,
            organization_id=data.organization_id or user.organization_id,
            sector_id=data.sector_id or user.sector_id,
            raw_metadata=data.raw_metadata
        )
        db.add(evt)
        db.flush()
        cls._create_audit(db, user.id, "SECURITY_EVENT_CREATED", "SecurityEvent", evt.id, new_val={"business_id": evt.business_id, "title": evt.title})
        db.commit()
        db.refresh(evt)
        return evt

    # ==================== Alerts ====================

    @classmethod
    def list_alerts(
        cls, db: Session, user: User, effective_scope: str,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        severity: Optional[str] = None,
        priority: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
        sector_id: Optional[uuid.UUID] = None,
        page: int = 1, limit: int = 20
    ) -> Tuple[List[Alert], int]:
        q = db.query(Alert)
        q = cls._apply_scope_filter(q, Alert, user, effective_scope)

        if search:
            pattern = f"%{search}%"
            q = q.filter(or_(Alert.title.ilike(pattern), Alert.business_id.ilike(pattern), Alert.description.ilike(pattern)))
        if status_filter:
            q = q.filter(Alert.status == status_filter.upper())
        if severity:
            q = q.filter(Alert.severity == severity.upper())
        if priority:
            q = q.filter(Alert.priority == priority.upper())
        if organization_id:
            q = q.filter(Alert.organization_id == organization_id)
        if sector_id:
            q = q.filter(Alert.sector_id == sector_id)

        total = q.count()
        items = q.order_by(desc(Alert.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    @classmethod
    def get_alert(cls, db: Session, user: User, effective_scope: str, alert_id: uuid.UUID) -> Alert:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
        cls._verify_scope(user, effective_scope, alert, "Alert")
        return alert

    @classmethod
    def create_alert(cls, db: Session, user: User, data: AlertCreate) -> Alert:
        biz_id = cls._generate_business_id("ALT", Alert, db)
        alert = Alert(
            business_id=biz_id,
            title=data.title,
            description=data.description,
            severity=data.severity.upper(),
            priority=data.priority.upper(),
            status="NEW",
            source=data.source,
            security_event_id=data.security_event_id,
            organization_id=data.organization_id or user.organization_id,
            sector_id=data.sector_id or user.sector_id,
            assigned_to_id=data.assigned_to_id
        )
        db.add(alert)
        db.flush()
        cls._create_audit(db, user.id, "ALERT_CREATED", "Alert", alert.id, new_val={"business_id": alert.business_id, "title": alert.title})
        db.commit()
        db.refresh(alert)
        return alert

    @classmethod
    def triage_alert(cls, db: Session, user: User, effective_scope: str, alert_id: uuid.UUID, data: AlertTriageRequest) -> Tuple[Alert, Optional[CSE]]:
        alert = cls.get_alert(db, user, effective_scope, alert_id)
        
        old_status = alert.status
        new_status = "ESCALATED" if data.decision.upper() == "ESCALATE" else "TRIAGED"
        validate_transition("Alert", ALERT_TRANSITIONS, old_status, new_status)
        
        alert.status = new_status
        alert.triage_decision = data.decision.upper()
        alert.triage_notes = data.notes
        alert.triaged_by_id = user.id
        alert.triaged_at = datetime.now(timezone.utc)
        if data.severity:
            alert.severity = data.severity.upper()
        if data.priority:
            alert.priority = data.priority.upper()

        # Log transition
        trans = WorkflowTransition(
            resource_type="Alert",
            resource_id=alert.id,
            from_state=old_status,
            to_state=new_status,
            actor_id=user.id,
            reason=f"Triage Decision: {data.decision}. {data.notes or ''}"
        )
        db.add(trans)

        created_cse: Optional[CSE] = None
        if data.create_cse or data.decision.upper() == "CONFIRMED_SECURITY_EVENT":
            if not alert.cse_id:
                cse_biz_id = cls._generate_business_id("CSE", CSE, db)
                created_cse = CSE(
                    business_id=cse_biz_id,
                    title=f"[From Alert {alert.business_id}] {alert.title}",
                    description=f"Originated from Alert {alert.business_id}.\nTriage Notes: {data.notes or 'None'}\n\nOriginal Description:\n{alert.description or ''}",
                    severity=alert.severity,
                    priority=alert.priority,
                    status="TRIAGED",
                    source="ALERT",
                    organization_id=alert.organization_id,
                    sector_id=alert.sector_id,
                    created_by_id=user.id,
                    assigned_to_id=alert.assigned_to_id or user.id
                )
                db.add(created_cse)
                db.flush()
                alert.cse_id = created_cse.id

                # CSE Audit & Transition
                cls._create_audit(db, user.id, "CSE_CREATED_FROM_ALERT", "CSE", created_cse.id, new_val={"business_id": created_cse.business_id, "alert_id": str(alert.id)})
                db.add(WorkflowTransition(
                    resource_type="CSE",
                    resource_id=created_cse.id,
                    from_state="NEW",
                    to_state="TRIAGED",
                    actor_id=user.id,
                    reason=f"Auto-created from Alert {alert.business_id} during triage."
                ))
            else:
                created_cse = alert.cse

        cls._create_audit(db, user.id, "ALERT_TRIAGED", "Alert", alert.id, old_val={"status": old_status}, new_val={"status": new_status, "decision": alert.triage_decision})
        db.commit()
        db.refresh(alert)
        if created_cse:
            db.refresh(created_cse)
        return alert, created_cse

    @classmethod
    def transition_alert(cls, db: Session, user: User, effective_scope: str, alert_id: uuid.UUID, to_status: str, reason: Optional[str] = None) -> Alert:
        alert = cls.get_alert(db, user, effective_scope, alert_id)
        validate_transition("Alert", ALERT_TRANSITIONS, alert.status, to_status)
        old_status = alert.status
        alert.status = to_status.upper()
        
        db.add(WorkflowTransition(
            resource_type="Alert",
            resource_id=alert.id,
            from_state=old_status,
            to_state=alert.status,
            actor_id=user.id,
            reason=reason
        ))
        cls._create_audit(db, user.id, "ALERT_STATUS_TRANSITION", "Alert", alert.id, old_val={"status": old_status}, new_val={"status": alert.status, "reason": reason})
        db.commit()
        db.refresh(alert)
        return alert

    # ==================== CSE ====================

    @classmethod
    def list_cses(
        cls, db: Session, user: User, effective_scope: str,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        severity: Optional[str] = None,
        priority: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
        sector_id: Optional[uuid.UUID] = None,
        assigned_to_id: Optional[uuid.UUID] = None,
        page: int = 1, limit: int = 20
    ) -> Tuple[List[CSE], int]:
        q = db.query(CSE)
        q = cls._apply_scope_filter(q, CSE, user, effective_scope)

        if search:
            pattern = f"%{search}%"
            q = q.filter(or_(CSE.title.ilike(pattern), CSE.business_id.ilike(pattern), CSE.description.ilike(pattern)))
        if status_filter:
            q = q.filter(CSE.status == status_filter.upper())
        if severity:
            q = q.filter(CSE.severity == severity.upper())
        if priority:
            q = q.filter(CSE.priority == priority.upper())
        if organization_id:
            q = q.filter(CSE.organization_id == organization_id)
        if sector_id:
            q = q.filter(CSE.sector_id == sector_id)
        if assigned_to_id:
            q = q.filter(CSE.assigned_to_id == assigned_to_id)

        total = q.count()
        items = q.order_by(desc(CSE.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    @classmethod
    def get_cse(cls, db: Session, user: User, effective_scope: str, cse_id: uuid.UUID) -> CSE:
        cse = db.query(CSE).filter(CSE.id == cse_id).first()
        if not cse:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CSE not found")
        cls._verify_scope(user, effective_scope, cse, "CSE")
        return cse

    @classmethod
    def create_cse(cls, db: Session, user: User, data: CSECreate) -> CSE:
        biz_id = cls._generate_business_id("CSE", CSE, db)
        cse = CSE(
            business_id=biz_id,
            title=data.title,
            description=data.description,
            severity=data.severity.upper(),
            priority=data.priority.upper(),
            status="NEW",
            source=data.source,
            organization_id=data.organization_id or user.organization_id,
            sector_id=data.sector_id or user.sector_id,
            created_by_id=user.id,
            assigned_to_id=data.assigned_to_id
        )
        db.add(cse)
        db.flush()

        if data.originating_alert_id:
            alert = db.query(Alert).filter(Alert.id == data.originating_alert_id).first()
            if alert:
                alert.cse_id = cse.id

        cls._create_audit(db, user.id, "CSE_CREATED", "CSE", cse.id, new_val={"business_id": cse.business_id, "title": cse.title})
        db.commit()
        db.refresh(cse)
        return cse

    @classmethod
    def update_cse(cls, db: Session, user: User, effective_scope: str, cse_id: uuid.UUID, data: CSEUpdateRequest) -> CSE:
        cse = cls.get_cse(db, user, effective_scope, cse_id)
        old_val = {"title": cse.title, "severity": cse.severity, "priority": cse.priority}
        
        if data.title is not None:
            cse.title = data.title
        if data.description is not None:
            cse.description = data.description
        if data.severity is not None:
            cse.severity = data.severity.upper()
        if data.priority is not None:
            cse.priority = data.priority.upper()

        cls._create_audit(db, user.id, "CSE_UPDATED", "CSE", cse.id, old_val=old_val, new_val={"title": cse.title, "severity": cse.severity, "priority": cse.priority})
        db.commit()
        db.refresh(cse)
        return cse

    @classmethod
    def assign_cse(cls, db: Session, user: User, effective_scope: str, cse_id: uuid.UUID, data: CSEAssignRequest) -> CSE:
        cse = cls.get_cse(db, user, effective_scope, cse_id)
        assignee = db.query(User).filter(User.id == data.assigned_to_id).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned user not found")

        old_assignee_id = str(cse.assigned_to_id) if cse.assigned_to_id else None
        cse.assigned_to_id = data.assigned_to_id

        # Record assignment
        assignment = Assignment(
            resource_type="CSE",
            resource_id=cse.id,
            assigned_to_id=assignee.id,
            assigned_by_id=user.id,
            assignment_type=data.assignment_type or "ANALYST",
            status="ACTIVE",
            notes=data.notes,
            due_at=data.due_at
        )
        db.add(assignment)

        # Notify assignee
        cls._create_notification(
            db,
            assignee.id,
            "ASSIGNMENT",
            f"New CSE Assignment: {cse.business_id}",
            f"You have been assigned to CSE '{cse.title}' by {user.username}."
        )

        cls._create_audit(db, user.id, "CSE_ASSIGNED", "CSE", cse.id, old_val={"assigned_to_id": old_assignee_id}, new_val={"assigned_to_id": str(assignee.id)})
        db.commit()
        db.refresh(cse)
        return cse

    @classmethod
    def transition_cse(cls, db: Session, user: User, effective_scope: str, cse_id: uuid.UUID, to_status: str, reason: Optional[str] = None) -> CSE:
        cse = cls.get_cse(db, user, effective_scope, cse_id)
        validate_transition("CSE", CSE_TRANSITIONS, cse.status, to_status)
        old_status = cse.status
        cse.status = to_status.upper()

        db.add(WorkflowTransition(
            resource_type="CSE",
            resource_id=cse.id,
            from_state=old_status,
            to_state=cse.status,
            actor_id=user.id,
            reason=reason
        ))
        cls._create_audit(db, user.id, "CSE_STATUS_TRANSITION", "CSE", cse.id, old_val={"status": old_status}, new_val={"status": cse.status, "reason": reason})
        db.commit()
        db.refresh(cse)
        return cse

    @classmethod
    def escalate_cse(cls, db: Session, user: User, effective_scope: str, cse_id: uuid.UUID, data: EscalationCreate) -> Escalation:
        cse = cls.get_cse(db, user, effective_scope, cse_id)
        
        # If valid to escalate CSE status
        old_status = cse.status
        if cse.status in CSE_TRANSITIONS and "ESCALATED" in CSE_TRANSITIONS[cse.status]:
            cse.status = "ESCALATED"
            db.add(WorkflowTransition(
                resource_type="CSE",
                resource_id=cse.id,
                from_state=old_status,
                to_state="ESCALATED",
                actor_id=user.id,
                reason=f"Escalated: {data.reason}"
            ))

        esc_biz_id = cls._generate_business_id("ESC", Escalation, db)
        escalation = Escalation(
            business_id=esc_biz_id,
            resource_type="CSE",
            resource_id=cse.id,
            reason=data.reason,
            severity=data.severity.upper(),
            status="OPEN",
            escalated_by_id=user.id,
            escalated_to_role_id=data.escalated_to_role_id,
            escalated_to_id=data.escalated_to_id
        )
        db.add(escalation)

        # Notify recipient or role members
        if data.escalated_to_id:
            cls._create_notification(
                db, data.escalated_to_id, "ESCALATION",
                f"CSE Escalation: {cse.business_id}",
                f"CSE '{cse.title}' has been escalated to you by {user.username}. Reason: {data.reason}"
            )

        cls._create_audit(db, user.id, "CSE_ESCALATED", "CSE", cse.id, new_val={"escalation_id": esc_biz_id, "reason": data.reason})
        db.commit()
        db.refresh(escalation)
        return escalation

    # ==================== Investigations ====================

    @classmethod
    def list_investigations(
        cls, db: Session, user: User, effective_scope: str,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        cse_id: Optional[uuid.UUID] = None,
        lead_analyst_id: Optional[uuid.UUID] = None,
        page: int = 1, limit: int = 20
    ) -> Tuple[List[Investigation], int]:
        q = db.query(Investigation)
        q = cls._apply_scope_filter(q, Investigation, user, effective_scope)

        if search:
            pattern = f"%{search}%"
            q = q.filter(or_(Investigation.title.ilike(pattern), Investigation.business_id.ilike(pattern), Investigation.description.ilike(pattern)))
        if status_filter:
            q = q.filter(Investigation.status == status_filter.upper())
        if cse_id:
            q = q.filter(Investigation.cse_id == cse_id)
        if lead_analyst_id:
            q = q.filter(Investigation.lead_analyst_id == lead_analyst_id)

        total = q.count()
        items = q.order_by(desc(Investigation.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    @classmethod
    def get_investigation(cls, db: Session, user: User, effective_scope: str, inv_id: uuid.UUID) -> Investigation:
        inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
        # Check scope against linked CSE
        if inv.cse:
            cls._verify_scope(user, effective_scope, inv.cse, "Investigation")
        return inv

    @classmethod
    def create_investigation(cls, db: Session, user: User, effective_scope: str, data: InvestigationCreate) -> Investigation:
        cse = cls.get_cse(db, user, effective_scope, data.cse_id)
        biz_id = cls._generate_business_id("INV", Investigation, db)
        
        inv = Investigation(
            business_id=biz_id,
            title=data.title,
            description=data.description,
            status="OPEN",
            cse_id=cse.id,
            lead_analyst_id=data.lead_analyst_id or user.id,
            started_at=datetime.now(timezone.utc)
        )
        db.add(inv)
        
        # If CSE is currently NEW or TRIAGED, transition to INVESTIGATING
        if cse.status in ["NEW", "TRIAGED"]:
            old_cse_status = cse.status
            cse.status = "INVESTIGATING"
            db.add(WorkflowTransition(
                resource_type="CSE",
                resource_id=cse.id,
                from_state=old_cse_status,
                to_state="INVESTIGATING",
                actor_id=user.id,
                reason=f"Investigation {biz_id} launched."
            ))

        cls._create_audit(db, user.id, "INVESTIGATION_LAUNCHED", "Investigation", inv.id, new_val={"business_id": biz_id, "cse_id": str(cse.id)})
        db.commit()
        db.refresh(inv)
        return inv

    @classmethod
    def update_investigation(cls, db: Session, user: User, effective_scope: str, inv_id: uuid.UUID, data: InvestigationUpdateRequest) -> Investigation:
        inv = cls.get_investigation(db, user, effective_scope, inv_id)
        
        if data.title is not None:
            inv.title = data.title
        if data.description is not None:
            inv.description = data.description
        if data.lead_analyst_id is not None:
            inv.lead_analyst_id = data.lead_analyst_id
        if data.findings_summary is not None:
            inv.findings_summary = data.findings_summary

        cls._create_audit(db, user.id, "INVESTIGATION_UPDATED", "Investigation", inv.id)
        db.commit()
        db.refresh(inv)
        return inv

    @classmethod
    def transition_investigation(cls, db: Session, user: User, effective_scope: str, inv_id: uuid.UUID, to_status: str, reason: Optional[str] = None) -> Investigation:
        inv = cls.get_investigation(db, user, effective_scope, inv_id)
        validate_transition("Investigation", INVESTIGATION_TRANSITIONS, inv.status, to_status)
        old_status = inv.status
        inv.status = to_status.upper()
        
        if inv.status in ["CONCLUDED", "CLOSED"]:
            inv.completed_at = datetime.now(timezone.utc)

        db.add(WorkflowTransition(
            resource_type="Investigation",
            resource_id=inv.id,
            from_state=old_status,
            to_state=inv.status,
            actor_id=user.id,
            reason=reason
        ))
        cls._create_audit(db, user.id, "INVESTIGATION_STATUS_TRANSITION", "Investigation", inv.id, old_val={"status": old_status}, new_val={"status": inv.status})
        db.commit()
        db.refresh(inv)
        return inv

    # ==================== Evidence ====================

    @classmethod
    def upload_evidence(
        cls, db: Session, user: User, effective_scope: str,
        title: str,
        description: Optional[str],
        evidence_type: str,
        source: Optional[str],
        cse_id: Optional[uuid.UUID],
        investigation_id: Optional[uuid.UUID],
        file: Optional[UploadFile] = None
    ) -> Evidence:
        # Validate parent scope
        if cse_id:
            cls.get_cse(db, user, effective_scope, cse_id)
        if investigation_id:
            cls.get_investigation(db, user, effective_scope, investigation_id)

        biz_id = cls._generate_business_id("EVD", Evidence, db)
        
        filename = None
        content_type = None
        file_size = None
        checksum = None
        file_uri = None

        if file:
            filename = os.path.basename(file.filename or "evidence.bin")
            content_type = file.content_type
            content = file.file.read()
            file_size = len(content)
            
            # Compute SHA-256
            sha = hashlib.sha256()
            sha.update(content)
            checksum = sha.hexdigest()
            
            # Store with unique filename
            safe_name = f"{uuid.uuid4().hex}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)}"
            file_path = os.path.join(EVIDENCE_UPLOAD_DIR, safe_name)
            with open(file_path, "wb") as f:
                f.write(content)
            file_uri = safe_name

        evidence = Evidence(
            business_id=biz_id,
            title=title,
            description=description,
            evidence_type=evidence_type.upper(),
            source=source,
            filename=filename,
            content_type=content_type,
            file_size=file_size,
            checksum=checksum,
            file_uri=file_uri,
            uploaded_by_id=user.id,
            cse_id=cse_id,
            investigation_id=investigation_id
        )
        db.add(evidence)
        db.flush()

        cls._create_audit(db, user.id, "EVIDENCE_UPLOADED", "Evidence", evidence.id, new_val={"business_id": biz_id, "title": title, "checksum": checksum})
        db.commit()
        db.refresh(evidence)
        return evidence

    @classmethod
    def get_evidence(cls, db: Session, user: User, effective_scope: str, evidence_id: uuid.UUID) -> Evidence:
        evd = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evd:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
        if evd.cse:
            cls._verify_scope(user, effective_scope, evd.cse, "Evidence")
        return evd

    # ==================== Escalations ====================

    @classmethod
    def list_escalations(cls, db: Session, user: User, effective_scope: str, status_filter: Optional[str] = None, page: int = 1, limit: int = 20) -> Tuple[List[Escalation], int]:
        q = db.query(Escalation)
        if status_filter:
            q = q.filter(Escalation.status == status_filter.upper())
        total = q.count()
        items = q.order_by(desc(Escalation.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    @classmethod
    def resolve_escalation(cls, db: Session, user: User, effective_scope: str, escalation_id: uuid.UUID, data: EscalationResolveRequest) -> Escalation:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found")

        validate_transition("Escalation", ESCALATION_TRANSITIONS, esc.status, data.status)
        old_status = esc.status
        esc.status = data.status.upper()
        esc.resolution = data.resolution
        esc.resolved_at = datetime.now(timezone.utc)

        cls._create_audit(db, user.id, "ESCALATION_RESOLVED", "Escalation", esc.id, old_val={"status": old_status}, new_val={"status": esc.status, "resolution": esc.resolution})
        db.commit()
        db.refresh(esc)
        return esc

    # ==================== Assignments ====================

    @classmethod
    def list_assignments(cls, db: Session, user: User, effective_scope: str, user_id: Optional[uuid.UUID] = None, page: int = 1, limit: int = 20) -> Tuple[List[Assignment], int]:
        q = db.query(Assignment)
        if effective_scope != ScopeType.ENTERPRISE:
            target_id = user_id or user.id
            q = q.filter(Assignment.assigned_to_id == target_id)
        elif user_id:
            q = q.filter(Assignment.assigned_to_id == user_id)
        total = q.count()
        items = q.order_by(desc(Assignment.created_at)).offset((page - 1) * limit).limit(limit).all()
        return items, total

    # ==================== Activity Timeline ====================

    @classmethod
    def get_timeline(cls, db: Session, user: User, effective_scope: str, resource_type: str, resource_id: uuid.UUID) -> List[TimelineEventRead]:
        events: List[TimelineEventRead] = []

        # 1. Transitions
        transitions = (
            db.query(WorkflowTransition)
            .filter(WorkflowTransition.resource_id == resource_id)
            .all()
        )
        for t in transitions:
            events.append(TimelineEventRead(
                id=f"trans-{t.id}",
                event_type="TRANSITION",
                title=f"Status changed: {t.from_state} → {t.to_state}",
                description=t.reason,
                actor_id=t.actor_id,
                actor_name=f"{t.actor.first_name or ''} {t.actor.last_name or ''}".strip() or (t.actor.username if t.actor else "System"),
                timestamp=t.created_at,
                metadata={"from_state": t.from_state, "to_state": t.to_state}
            ))

        # 2. Assignments
        assignments = (
            db.query(Assignment)
            .filter(Assignment.resource_id == resource_id)
            .all()
        )
        for a in assignments:
            assignee_name = f"{a.assigned_to.first_name or ''} {a.assigned_to.last_name or ''}".strip() or a.assigned_to.username
            events.append(TimelineEventRead(
                id=f"assign-{a.id}",
                event_type="ASSIGNMENT",
                title=f"Assigned to {assignee_name}",
                description=a.notes,
                actor_id=a.assigned_by_id,
                actor_name=f"{a.assigned_by.first_name or ''} {a.assigned_by.last_name or ''}".strip() or a.assigned_by.username,
                timestamp=a.created_at,
                metadata={"assignment_type": a.assignment_type}
            ))

        # 3. Escalations
        escalations = (
            db.query(Escalation)
            .filter(Escalation.resource_id == resource_id)
            .all()
        )
        for e in escalations:
            events.append(TimelineEventRead(
                id=f"esc-{e.id}",
                event_type="ESCALATION",
                title=f"Escalation Raised [{e.severity}] - {e.business_id}",
                description=e.reason,
                actor_id=e.escalated_by_id,
                actor_name=f"{e.escalated_by.first_name or ''} {e.escalated_by.last_name or ''}".strip() or e.escalated_by.username,
                timestamp=e.created_at,
                metadata={"severity": e.severity, "status": e.status, "resolution": e.resolution}
            ))

        # 4. Evidence
        if resource_type.upper() == "CSE":
            evds = db.query(Evidence).filter(Evidence.cse_id == resource_id).all()
        elif resource_type.upper() == "INVESTIGATION":
            evds = db.query(Evidence).filter(Evidence.investigation_id == resource_id).all()
        else:
            evds = []

        for ev in evds:
            events.append(TimelineEventRead(
                id=f"evd-{ev.id}",
                event_type="EVIDENCE",
                title=f"Evidence Attached: {ev.title} [{ev.evidence_type}]",
                description=ev.description or (f"File: {ev.filename}" if ev.filename else None),
                actor_id=ev.uploaded_by_id,
                actor_name=f"{ev.uploaded_by.first_name or ''} {ev.uploaded_by.last_name or ''}".strip() if ev.uploaded_by else None,
                timestamp=ev.created_at,
                metadata={"evidence_type": ev.evidence_type, "checksum": ev.checksum}
            ))

        # 5. Audit entries
        audits = (
            db.query(AuditLog)
            .filter(AuditLog.resource_id == resource_id)
            .all()
        )
        for au in audits:
            # Skip transition or assignment duplicates if covered
            if au.action not in ["CSE_STATUS_TRANSITION", "ALERT_STATUS_TRANSITION", "INVESTIGATION_STATUS_TRANSITION", "CSE_ASSIGNED", "CSE_ESCALATED", "EVIDENCE_UPLOADED"]:
                events.append(TimelineEventRead(
                    id=f"audit-{au.id}",
                    event_type="AUDIT",
                    title=f"Audit Event: {au.action.replace('_', ' ').title()}",
                    description=None,
                    actor_id=au.actor_user_id,
                    actor_name=None,
                    timestamp=au.created_at,
                    metadata={"action": au.action}
                ))

        # Sort chronologically descending
        events.sort(key=lambda x: x.timestamp, reverse=True)
        return events
