import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func, and_
from fastapi import HTTPException, status

from app.models.finding import Finding, FindingComment
from app.models.security import CSE, Investigation, Evidence
from app.models.control import Control
from app.models.risk import Risk
from app.models.remediation import Remediation
from app.models.workflow import WorkflowTransition, Assignment
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.identity import User
from app.models.organization import Organization, Sector
from app.rbac.scopes import ScopeType, check_resource_scope
from app.rbac import permissions as p
from app.findings.workflow_engine import validate_finding_transition
from app.findings.schemas import (
    FindingCreate,
    FindingUpdate,
    FindingTransitionRequest,
    FindingAssignRequest,
    FindingCommentCreate,
    FindingRead,
    FindingCommentRead,
    FindingEvidenceItem,
    FindingStatsResponse,
    FindingTimelineEvent,
)


class FindingsService:
    @staticmethod
    def _generate_business_id(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        year_prefix = f"FND-{current_year}-"
        
        last_item = (
            db.query(Finding)
            .filter(Finding.business_id.like(f"{year_prefix}%"))
            .order_by(desc(Finding.created_at))
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
    def _apply_scope_filter(query: Any, user: User, effective_scope: str) -> Any:
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        
        user_org_id = getattr(user, "organization_id", None)
        user_sector_id = getattr(user, "sector_id", None)
        user_id = getattr(user, "id", None)

        if effective_scope == ScopeType.SECTOR:
            return query.filter(Finding.sector_id == user_sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            return query.filter(Finding.organization_id == user_org_id)
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(
                or_(
                    Finding.assigned_to_id == user_id,
                    Finding.created_by_id == user_id
                )
            )
        return query

    @classmethod
    def _to_read_dto(cls, f: Finding) -> FindingRead:
        now = datetime.now(timezone.utc)
        is_overdue = False
        if f.due_date and f.status != "CLOSED":
            due = f.due_date if f.due_date.tzinfo else f.due_date.replace(tzinfo=timezone.utc)
            is_overdue = due < now

        # Convert attached evidence
        evidence_items: List[FindingEvidenceItem] = []
        for ev in (f.evidence or []):
            uploader_name = None
            if ev.uploaded_by:
                uploader_name = f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}".strip()
            evidence_items.append(
                FindingEvidenceItem(
                    id=ev.id,
                    business_id=ev.business_id,
                    title=ev.title,
                    description=ev.description,
                    evidence_type=ev.evidence_type,
                    file_uri=ev.file_uri,
                    filename=ev.filename,
                    file_size=ev.file_size,
                    checksum=ev.checksum,
                    created_at=ev.created_at,
                    uploaded_by_name=uploader_name
                )
            )

        # Convert comments
        comment_items: List[FindingCommentRead] = []
        for c in (f.comments or []):
            author_name = None
            author_role = None
            if c.author:
                author_name = f"{c.author.first_name} {c.author.last_name}".strip()
                if c.author.roles:
                    author_role = c.author.roles[0].name
            comment_items.append(
                FindingCommentRead(
                    id=c.id,
                    finding_id=c.finding_id,
                    author_id=c.author_id,
                    author_name=author_name,
                    author_role=author_role,
                    comment=c.comment,
                    comment_type=c.comment_type,
                    created_at=c.created_at
                )
            )

        # Related foundations
        has_remediation = len(f.remediations) > 0 if f.remediations else False
        related_remediation_id = f.remediations[0].id if has_remediation else None
        has_risk = len(f.risks) > 0 if f.risks else False
        related_risk_id = f.risks[0].id if has_risk else None

        return FindingRead(
            id=f.id,
            business_id=f.business_id,
            title=f.title,
            description=f.description,
            severity=f.severity,
            priority=f.priority,
            status=f.status,
            classification=f.classification,
            source_type=f.source_type,
            source_id=f.source_id,
            cse_id=f.cse_id,
            cse_business_id=f.cse.business_id if f.cse else None,
            cse_title=f.cse.title if f.cse else None,
            investigation_id=f.investigation_id,
            investigation_business_id=f.investigation.business_id if f.investigation else None,
            investigation_title=f.investigation.title if f.investigation else None,
            control_id=f.control_id,
            control_business_id=f.control.business_id if f.control else None,
            control_name=f.control.name if f.control else None,
            organization_id=f.organization_id,
            organization_name=f.organization.name if f.organization else None,
            sector_id=f.sector_id,
            sector_name=f.sector.name if f.sector else None,
            created_by_id=f.created_by_id,
            created_by_name=f"{f.created_by.first_name} {f.created_by.last_name}".strip() if f.created_by else None,
            assigned_to_id=f.assigned_to_id,
            assigned_to_name=f"{f.assigned_to.first_name} {f.assigned_to.last_name}".strip() if f.assigned_to else None,
            assigned_by_id=f.assigned_by_id,
            assigned_by_name=f"{f.assigned_by.first_name} {f.assigned_by.last_name}".strip() if f.assigned_by else None,
            assigned_at=f.assigned_at,
            due_date=f.due_date,
            is_overdue=is_overdue,
            remediation_required=f.remediation_required,
            created_at=f.created_at,
            updated_at=f.updated_at,
            evidence=evidence_items,
            comments=comment_items,
            has_related_remediation=has_remediation,
            related_remediation_id=related_remediation_id,
            has_related_risk=has_risk,
            related_risk_id=related_risk_id
        )

    @classmethod
    def list_findings(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        status_filter: Optional[str] = None,
        severity_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        source_type_filter: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[FindingRead], int]:
        query = db.query(Finding)
        query = cls._apply_scope_filter(query, user, effective_scope)

        if status_filter:
            query = query.filter(Finding.status == status_filter.upper())
        if severity_filter:
            query = query.filter(Finding.severity == severity_filter.upper())
        if priority_filter:
            query = query.filter(Finding.priority == priority_filter.upper())
        if source_type_filter:
            query = query.filter(Finding.source_type == source_type_filter.upper())

        if search:
            search_fmt = f"%{search}%"
            query = query.filter(
                or_(
                    Finding.business_id.ilike(search_fmt),
                    Finding.title.ilike(search_fmt),
                    Finding.description.ilike(search_fmt),
                    Finding.classification.ilike(search_fmt)
                )
            )

        total = query.count()
        findings = query.order_by(desc(Finding.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        return [cls._to_read_dto(f) for f in findings], total

    @staticmethod
    def _enforce_scope(user: User, effective_scope: str, resource: Any) -> None:
        if resource is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found."
            )
        if not check_resource_scope(user, effective_scope, resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Resource is outside your authorized organizational or sectoral scope."
            )

    @classmethod
    def get_finding(cls, db: Session, user: User, effective_scope: str, finding_id: uuid.UUID) -> FindingRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        if not finding:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found.")
        
        cls._enforce_scope(user, effective_scope, finding)
        return cls._to_read_dto(finding)

    @classmethod
    def create_finding(cls, db: Session, user: User, effective_scope: str, data: FindingCreate) -> FindingRead:
        # Validate and link source
        cse_id = data.cse_id
        investigation_id = data.investigation_id
        control_id = data.control_id
        source_id = data.source_id or investigation_id or cse_id
        
        org_id = data.organization_id or user.organization_id
        sec_id = data.sector_id or user.sector_id

        # Source relation checks
        if data.source_type == "CSE" and cse_id:
            cse = db.query(CSE).filter(CSE.id == cse_id).first()
            if not cse:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Referenced CSE '{cse_id}' not found.")
            cls._enforce_scope(user, effective_scope, cse)
            org_id = cse.organization_id
            sec_id = cse.sector_id
            source_id = cse.id
        elif data.source_type == "INVESTIGATION" and investigation_id:
            inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
            if not inv:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Referenced Investigation '{investigation_id}' not found.")
            cls._enforce_scope(user, effective_scope, inv.cse if inv.cse else inv)
            cse_id = inv.cse_id
            source_id = inv.id
            if inv.cse:
                org_id = inv.cse.organization_id
                sec_id = inv.cse.sector_id

        if control_id:
            ctrl = db.query(Control).filter(Control.id == control_id).first()
            if not ctrl:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Referenced Control '{control_id}' not found.")

        business_id = cls._generate_business_id(db)

        new_finding = Finding(
            business_id=business_id,
            title=data.title,
            description=data.description,
            severity=data.severity.upper(),
            priority=data.priority.upper(),
            status="IDENTIFIED",
            classification=data.classification,
            source_type=data.source_type.upper(),
            source_id=source_id,
            cse_id=cse_id,
            investigation_id=investigation_id,
            control_id=control_id,
            organization_id=org_id,
            sector_id=sec_id,
            created_by_id=user.id,
            assigned_to_id=data.assigned_to_id or user.id,
            due_date=data.due_date,
            remediation_required=False
        )

        db.add(new_finding)
        db.flush()

        # Audit log
        db.add(AuditLog(
            actor_user_id=user.id,
            action="finding.created",
            resource_type="FINDING",
            resource_id=new_finding.id,
            new_value={
                "business_id": business_id,
                "title": data.title,
                "severity": data.severity,
                "source_type": data.source_type,
                "status": "IDENTIFIED"
            }
        ))

        # Workflow initial transition record
        db.add(WorkflowTransition(
            resource_type="FINDING",
            resource_id=new_finding.id,
            from_state="NONE",
            to_state="IDENTIFIED",
            actor_id=user.id,
            reason="Initial finding identification"
        ))

        # Notification
        db.add(Notification(
            recipient_id=user.id,
            type="FINDING_CREATED",
            title=f"Finding Created: {business_id}",
            message=f"Finding {business_id} ({data.title}) was identified and created from {data.source_type}."
        ))

        db.commit()
        db.refresh(new_finding)
        return cls._to_read_dto(new_finding)

    @classmethod
    def update_finding(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID,
        data: FindingUpdate
    ) -> FindingRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        old_values = {}
        new_values = {}

        if data.title is not None and data.title != finding.title:
            old_values["title"] = finding.title
            new_values["title"] = data.title
            finding.title = data.title

        if data.description is not None and data.description != finding.description:
            old_values["description"] = finding.description
            new_values["description"] = data.description
            finding.description = data.description

        if data.severity is not None and data.severity != finding.severity:
            old_values["severity"] = finding.severity
            new_values["severity"] = data.severity.upper()
            finding.severity = data.severity.upper()

        if data.priority is not None and data.priority != finding.priority:
            old_values["priority"] = finding.priority
            new_values["priority"] = data.priority.upper()
            finding.priority = data.priority.upper()

        if data.classification is not None and data.classification != finding.classification:
            old_values["classification"] = finding.classification
            new_values["classification"] = data.classification
            finding.classification = data.classification

        if data.due_date is not None:
            old_values["due_date"] = str(finding.due_date)
            new_values["due_date"] = str(data.due_date)
            finding.due_date = data.due_date

        if data.control_id is not None:
            ctrl = db.query(Control).filter(Control.id == data.control_id).first()
            if not ctrl:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Referenced Control '{data.control_id}' not found.")
            old_values["control_id"] = str(finding.control_id) if finding.control_id else None
            new_values["control_id"] = str(data.control_id)
            finding.control_id = data.control_id

        if old_values:
            db.add(AuditLog(
                actor_user_id=user.id,
                action="finding.updated",
                resource_type="FINDING",
                resource_id=finding.id,
                old_value=old_values,
                new_value=new_values
            ))

        db.commit()
        db.refresh(finding)
        return cls._to_read_dto(finding)

    @classmethod
    def transition_finding(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID,
        req: FindingTransitionRequest,
        user_permissions: Set[str]
    ) -> FindingRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        current_state = finding.status.upper()
        target_state = req.target_state.upper()

        # Permission check per target state
        if target_state == "SUBMITTED":
            if not (p.FINDING_SUBMIT in user_permissions or p.FINDING_CREATE in user_permissions or p.FINDING_UPDATE in user_permissions):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to submit finding for review.")
        elif target_state == "REVIEW":
            if not (p.FINDING_REVIEW in user_permissions or p.FINDING_APPROVE in user_permissions):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to review finding.")
        elif target_state == "CONFIRMED":
            if not (p.FINDING_APPROVE in user_permissions):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to confirm/approve finding.")
        elif target_state == "REJECTED":
            if not (p.FINDING_REJECT in user_permissions or p.FINDING_APPROVE in user_permissions):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to reject finding.")
        elif target_state == "CLOSED":
            if not (p.FINDING_CLOSE in user_permissions or p.FINDING_APPROVE in user_permissions):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to close finding.")

        # Evaluate lifecycle state transitions and Separation of Duties
        validate_finding_transition(
            current_state=current_state,
            requested_state=target_state,
            creator_id=finding.created_by_id,
            actor_id=user.id,
            is_admin=False
        )

        old_state = finding.status
        finding.status = target_state

        if target_state == "REMEDIATION_REQUIRED" or req.remediation_required is True:
            finding.remediation_required = True

        # If review notes or comments were provided during transition, create comment
        if req.review_notes:
            comment_type = "GENERAL_COMMENT"
            if target_state == "CONFIRMED":
                comment_type = "DECISION_NOTE"
            elif target_state == "DRAFT" and current_state == "REVIEW":
                comment_type = "CHANGE_REQUEST"
            elif target_state == "REJECTED":
                comment_type = "DECISION_NOTE"
            elif target_state == "REVIEW":
                comment_type = "REVIEW_NOTE"

            db.add(FindingComment(
                finding_id=finding.id,
                author_id=user.id,
                comment=req.review_notes,
                comment_type=comment_type
            ))

        # Record workflow transition
        db.add(WorkflowTransition(
            resource_type="FINDING",
            resource_id=finding.id,
            from_state=old_state,
            to_state=target_state,
            actor_id=user.id,
            reason=req.reason or req.review_notes
        ))

        # Audit log
        db.add(AuditLog(
            actor_user_id=user.id,
            action=f"finding.transition.{target_state.lower()}",
            resource_type="FINDING",
            resource_id=finding.id,
            old_value={"status": old_state},
            new_value={"status": target_state, "remediation_required": finding.remediation_required}
        ))

        # In-app notifications
        notify_user_id = finding.created_by_id if finding.created_by_id != user.id else finding.assigned_to_id
        if notify_user_id:
            db.add(Notification(
                recipient_id=notify_user_id,
                type=f"FINDING_{target_state}",
                title=f"Finding {finding.business_id}: Status changed to {target_state}",
                message=f"Finding '{finding.title}' transitioned from {old_state} to {target_state} by {user.first_name} {user.last_name}."
            ))

        db.commit()
        db.refresh(finding)
        return cls._to_read_dto(finding)

    @classmethod
    def assign_finding(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID,
        req: FindingAssignRequest
    ) -> FindingRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        assignee = db.query(User).filter(User.id == req.assigned_to_id).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee user not found.")

        old_assigned = finding.assigned_to_id
        finding.assigned_to_id = assignee.id
        finding.assigned_by_id = user.id
        finding.assigned_at = datetime.now(timezone.utc)
        if req.due_date:
            finding.due_date = req.due_date

        # Record assignment model
        db.add(Assignment(
            resource_type="FINDING",
            resource_id=finding.id,
            assigned_to_id=assignee.id,
            assigned_by_id=user.id,
            assignment_type="FINDING_OWNER",
            notes=req.notes,
            due_at=req.due_date
        ))

        # Audit log
        db.add(AuditLog(
            actor_user_id=user.id,
            action="finding.assigned",
            resource_type="FINDING",
            resource_id=finding.id,
            old_value={"assigned_to_id": str(old_assigned) if old_assigned else None},
            new_value={"assigned_to_id": str(assignee.id), "due_date": str(req.due_date) if req.due_date else None}
        ))

        # Notification
        db.add(Notification(
            recipient_id=assignee.id,
            type="FINDING_ASSIGNED",
            title=f"Finding Assigned: {finding.business_id}",
            message=f"You have been assigned to Finding {finding.business_id}: '{finding.title}'."
        ))

        db.commit()
        db.refresh(finding)
        return cls._to_read_dto(finding)

    @classmethod
    def add_comment(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID,
        req: FindingCommentCreate
    ) -> FindingCommentRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        comment = FindingComment(
            finding_id=finding.id,
            author_id=user.id,
            comment=req.comment,
            comment_type=req.comment_type
        )
        db.add(comment)
        db.flush()

        db.add(AuditLog(
            actor_user_id=user.id,
            action="finding.comment_added",
            resource_type="FINDING",
            resource_id=finding.id,
            new_value={"comment_id": str(comment.id), "type": req.comment_type}
        ))

        # Notify finding owner or creator if someone else posted a comment
        recipient_id = finding.assigned_to_id if finding.assigned_to_id and finding.assigned_to_id != user.id else finding.created_by_id
        if recipient_id and recipient_id != user.id:
            db.add(Notification(
                recipient_id=recipient_id,
                type="FINDING_COMMENT",
                title=f"New {req.comment_type} on {finding.business_id}",
                message=f"{user.first_name} {user.last_name} posted a {req.comment_type.lower().replace('_', ' ')} on '{finding.title}'."
            ))

        db.commit()
        db.refresh(comment)

        author_name = f"{user.first_name} {user.last_name}".strip()
        author_role = user.roles[0].name if user.roles else None

        return FindingCommentRead(
            id=comment.id,
            finding_id=comment.finding_id,
            author_id=comment.author_id,
            author_name=author_name,
            author_role=author_role,
            comment=comment.comment,
            comment_type=comment.comment_type,
            created_at=comment.created_at
        )

    @classmethod
    def attach_evidence(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID,
        evidence_id: uuid.UUID
    ) -> FindingRead:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found.")

        evidence.finding_id = finding.id

        db.add(AuditLog(
            actor_user_id=user.id,
            action="finding.evidence_attached",
            resource_type="FINDING",
            resource_id=finding.id,
            new_value={"evidence_id": str(evidence.id), "evidence_business_id": evidence.business_id}
        ))

        db.commit()
        db.refresh(finding)
        return cls._to_read_dto(finding)

    @classmethod
    def get_stats(cls, db: Session, user: User, effective_scope: str) -> FindingStatsResponse:
        base_query = db.query(Finding)
        base_query = cls._apply_scope_filter(base_query, user, effective_scope)

        now = datetime.now(timezone.utc)
        findings = base_query.all()

        total = len(findings)
        critical = 0
        high = 0
        medium = 0
        low = 0
        informational = 0
        under_review = 0
        confirmed = 0
        remediation_required = 0
        overdue = 0
        closed = 0

        for f in findings:
            sev = (f.severity or "").upper()
            st = (f.status or "").upper()

            if sev == "CRITICAL":
                critical += 1
            elif sev == "HIGH":
                high += 1
            elif sev == "MEDIUM":
                medium += 1
            elif sev == "LOW":
                low += 1
            elif sev == "INFORMATIONAL":
                informational += 1

            if st in {"SUBMITTED", "REVIEW"}:
                under_review += 1
            elif st == "CONFIRMED":
                confirmed += 1
            elif st == "CLOSED":
                closed += 1

            if f.remediation_required or st == "REMEDIATION_REQUIRED":
                remediation_required += 1

            if f.due_date and st != "CLOSED":
                due = f.due_date if f.due_date.tzinfo else f.due_date.replace(tzinfo=timezone.utc)
                if due < now:
                    overdue += 1

        return FindingStatsResponse(
            total=total,
            critical=critical,
            high=high,
            medium=medium,
            low=low,
            informational=informational,
            under_review=under_review,
            confirmed=confirmed,
            remediation_required=remediation_required,
            overdue=overdue,
            closed=closed
        )

    @classmethod
    def get_timeline(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        finding_id: uuid.UUID
    ) -> List[FindingTimelineEvent]:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        cls._enforce_scope(user, effective_scope, finding)

        events: List[FindingTimelineEvent] = []

        # 1. Transitions
        transitions = (
            db.query(WorkflowTransition)
            .filter(WorkflowTransition.resource_type == "FINDING", WorkflowTransition.resource_id == finding.id)
            .order_by(WorkflowTransition.created_at.asc())
            .all()
        )
        for t in transitions:
            actor_name = f"{t.actor.first_name} {t.actor.last_name}".strip() if t.actor else "System"
            events.append(FindingTimelineEvent(
                event_type="STATUS_TRANSITION",
                timestamp=t.created_at,
                actor_name=actor_name,
                summary=f"Transitioned to {t.to_state}",
                details=t.reason
            ))

        # 2. Assignments
        assignments = (
            db.query(Assignment)
            .filter(Assignment.resource_type == "FINDING", Assignment.resource_id == finding.id)
            .order_by(Assignment.created_at.asc())
            .all()
        )
        for a in assignments:
            assignee_name = f"{a.assigned_to.first_name} {a.assigned_to.last_name}".strip() if a.assigned_to else "User"
            assigner_name = f"{a.assigned_by.first_name} {a.assigned_by.last_name}".strip() if a.assigned_by else "System"
            events.append(FindingTimelineEvent(
                event_type="ASSIGNMENT",
                timestamp=a.created_at,
                actor_name=assigner_name,
                summary=f"Assigned to {assignee_name}",
                details=a.notes
            ))

        # 3. Comments
        comments = (
            db.query(FindingComment)
            .filter(FindingComment.finding_id == finding.id)
            .order_by(FindingComment.created_at.asc())
            .all()
        )
        for c in comments:
            author_name = f"{c.author.first_name} {c.author.last_name}".strip() if c.author else "User"
            events.append(FindingTimelineEvent(
                event_type="REVIEW_NOTE",
                timestamp=c.created_at,
                actor_name=author_name,
                summary=f"{c.comment_type.replace('_', ' ').title()}",
                details=c.comment
            ))

        events.sort(key=lambda x: x.timestamp, reverse=True)
        return events
