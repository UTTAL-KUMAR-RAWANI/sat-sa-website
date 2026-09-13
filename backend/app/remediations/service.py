from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, desc
from datetime import datetime, timezone
import uuid
from fastapi import HTTPException, status

from app.models.remediation import Remediation
from app.models.security import Evidence
from app.models.finding import Finding
from app.models.risk import Risk, RiskTreatment
from app.models.control import Control
from app.models.identity import User
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.workflow import WorkflowTransition, Assignment, Approval
from app.rbac.scopes import ScopeType
from app.remediations.workflow_engine import RemediationWorkflowEngine, RemediationStatus
from app.remediations.schemas import (
    RemediationCreate,
    RemediationUpdate,
    RemediationAssignPayload,
    RemediationBlockPayload,
    RemediationEvidenceCreate,
    RemediationEvidenceReview,
    RemediationValidationDecision,
    RemediationClosePayload,
    RemediationTimelineEvent,
)


class RemediationService:
    @staticmethod
    def _generate_business_id(db: Session) -> str:
        count = db.query(func.count(Remediation.id)).scalar() or 0
        year = datetime.now(timezone.utc).year
        return f"REM-{year}-{(count + 1):05d}"

    @staticmethod
    def _create_audit(
        db: Session,
        actor: User,
        action: str,
        resource_id: uuid.UUID,
        old_val: Optional[Dict[str, Any]] = None,
        new_val: Optional[Dict[str, Any]] = None
    ):
        audit = AuditLog(
            actor_user_id=actor.id,
            action=action,
            resource_type="Remediation",
            resource_id=resource_id,
            old_value=old_val,
            new_value=new_val
        )
        db.add(audit)

    @staticmethod
    def _create_notification(
        db: Session,
        user_id: uuid.UUID,
        title: str,
        message: str
    ):
        notif = Notification(
            recipient_id=user_id,
            type="REMEDIATION",
            title=title,
            message=message,
            is_read=False
        )
        db.add(notif)

    @staticmethod
    def apply_scope(query, user: User, effective_scope: ScopeType):
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        elif effective_scope == ScopeType.SECTOR:
            if not user.sector_id:
                return query.filter(False)
            return query.filter(Remediation.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            if not user.organization_id:
                return query.filter(Remediation.created_by_id == user.id)
            return query.filter(
                or_(
                    Remediation.organization_id == user.organization_id,
                    Remediation.created_by_id == user.id
                )
            )
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(
                or_(
                    Remediation.owner_id == user.id,
                    Remediation.created_by_id == user.id
                )
            )
        return query.filter(False)

    @staticmethod
    def get_remediations(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        status_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        source_filter: Optional[str] = None,
        owner_id: Optional[uuid.UUID] = None,
        organization_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Remediation]:
        query = db.query(Remediation).options(
            joinedload(Remediation.owner),
            joinedload(Remediation.assigned_by),
            joinedload(Remediation.created_by),
            joinedload(Remediation.verified_by),
            joinedload(Remediation.finding),
            joinedload(Remediation.risk),
            joinedload(Remediation.risk_treatment),
            joinedload(Remediation.control),
            joinedload(Remediation.organization),
            joinedload(Remediation.sector),
            joinedload(Remediation.evidence_items)
        )
        query = RemediationService.apply_scope(query, user, effective_scope)

        if status_filter:
            query = query.filter(Remediation.status == status_filter.upper())
        if priority_filter:
            query = query.filter(Remediation.priority == priority_filter.upper())
        if source_filter:
            query = query.filter(Remediation.source == source_filter.upper())
        if owner_id:
            query = query.filter(Remediation.owner_id == owner_id)
        if organization_id:
            query = query.filter(Remediation.organization_id == organization_id)

        if search:
            s = f"%{search}%"
            query = query.filter(
                or_(
                    Remediation.title.ilike(s),
                    Remediation.business_id.ilike(s),
                    Remediation.description.ilike(s),
                    Remediation.corrective_action.ilike(s)
                )
            )

        return query.order_by(desc(Remediation.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def get_stats(db: Session, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        query = db.query(Remediation)
        query = RemediationService.apply_scope(query, user, effective_scope)
        all_remediations = query.all()

        now = datetime.now(timezone.utc)
        stats = {
            "total_remediations": len(all_remediations),
            "open": 0,
            "assigned": 0,
            "in_progress": 0,
            "blocked": 0,
            "evidence_submitted": 0,
            "validation": 0,
            "verified": 0,
            "closed": 0,
            "overdue": 0,
            "high_critical_count": 0,
            "status_distribution": {},
            "priority_distribution": {}
        }

        for r in all_remediations:
            st = r.status.upper()
            stats["status_distribution"][st] = stats["status_distribution"].get(st, 0) + 1

            if st == RemediationStatus.OPEN:
                stats["open"] += 1
            elif st == RemediationStatus.ASSIGNED:
                stats["assigned"] += 1
            elif st == RemediationStatus.IN_PROGRESS:
                stats["in_progress"] += 1
            elif st == RemediationStatus.BLOCKED:
                stats["blocked"] += 1
            elif st == RemediationStatus.EVIDENCE_SUBMITTED:
                stats["evidence_submitted"] += 1
            elif st == RemediationStatus.VALIDATION:
                stats["validation"] += 1
            elif st == RemediationStatus.VERIFIED:
                stats["verified"] += 1
            elif st == RemediationStatus.CLOSED:
                stats["closed"] += 1

            # Priority
            prio = (r.priority or "MEDIUM").upper()
            stats["priority_distribution"][prio] = stats["priority_distribution"].get(prio, 0) + 1
            if prio in ["CRITICAL", "HIGH"]:
                stats["high_critical_count"] += 1

            # Overdue logic
            target = r.target_date or r.due_date
            if target and target < now and st not in [RemediationStatus.VERIFIED, RemediationStatus.CLOSED]:
                stats["overdue"] += 1

        return stats

    @staticmethod
    def get_by_id(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID
    ) -> Remediation:
        query = db.query(Remediation).options(
            joinedload(Remediation.owner),
            joinedload(Remediation.assigned_by),
            joinedload(Remediation.created_by),
            joinedload(Remediation.verified_by),
            joinedload(Remediation.closed_by),
            joinedload(Remediation.blocked_by),
            joinedload(Remediation.finding),
            joinedload(Remediation.risk),
            joinedload(Remediation.risk_treatment),
            joinedload(Remediation.control),
            joinedload(Remediation.organization),
            joinedload(Remediation.sector),
            joinedload(Remediation.evidence_items).joinedload(Evidence.verified_by),
            joinedload(Remediation.evidence_items).joinedload(Evidence.uploaded_by)
        ).filter(Remediation.id == remediation_id)

        query = RemediationService.apply_scope(query, user, effective_scope)
        remediation = query.first()
        if not remediation:
            raise HTTPException(status_code=404, detail="Remediation not found or access denied.")
        return remediation

    @staticmethod
    def create_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        payload: RemediationCreate
    ) -> Remediation:
        bid = RemediationService._generate_business_id(db)

        org_id = payload.organization_id or getattr(user, "organization_id", None)
        sec_id = payload.sector_id or getattr(user, "sector_id", None)
        ctl_id = payload.control_id

        # If source is finding, prefill and validate
        finding = None
        if payload.finding_id:
            finding = db.query(Finding).filter(Finding.id == payload.finding_id).first()
            if finding:
                org_id = org_id or finding.organization_id
                sec_id = sec_id or finding.sector_id
                ctl_id = ctl_id or finding.control_id
                finding.remediation_required = True

        # If source is risk, prefill
        if payload.risk_id:
            risk = db.query(Risk).filter(Risk.id == payload.risk_id).first()
            if risk:
                org_id = org_id or risk.organization_id
                sec_id = sec_id or risk.sector_id
                ctl_id = ctl_id or risk.control_id

        initial_status = RemediationStatus.ASSIGNED if payload.owner_id else RemediationStatus.OPEN
        target_date = payload.target_date or payload.due_date

        remediation = Remediation(
            business_id=bid,
            title=payload.title,
            description=payload.description,
            priority=(payload.priority or "MEDIUM").upper(),
            status=initial_status,
            corrective_action=payload.corrective_action,
            root_cause=payload.root_cause,
            implementation_steps=payload.implementation_steps,
            expected_outcome=payload.expected_outcome,
            completion_criteria=payload.completion_criteria,
            dependencies=payload.dependencies,
            required_evidence_types=payload.required_evidence_types,
            source=(payload.source or "FINDING").upper(),
            source_id=payload.source_id,
            finding_id=payload.finding_id,
            risk_id=payload.risk_id,
            risk_treatment_id=payload.risk_treatment_id,
            control_id=ctl_id,
            organization_id=org_id,
            sector_id=sec_id,
            owner_id=payload.owner_id,
            assigned_team=payload.assigned_team,
            assigned_by_id=user.id if payload.owner_id else None,
            assigned_at=datetime.now(timezone.utc) if payload.owner_id else None,
            created_by_id=user.id,
            target_date=target_date,
            due_date=target_date
        )
        db.add(remediation)
        db.flush()

        # Audit
        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_CREATED",
            resource_id=remediation.id,
            new_val={"business_id": bid, "title": remediation.title, "priority": remediation.priority, "status": remediation.status}
        )

        # Transition record
        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state="NONE",
            to_state=initial_status,
            actor_id=user.id,
            reason="Remediation record created"
        )
        db.add(trans)

        # Assignment record if assigned on creation
        if payload.owner_id:
            assign = Assignment(
                resource_type="Remediation",
                resource_id=remediation.id,
                assigned_to_id=payload.owner_id,
                assigned_by_id=user.id,
                assignment_type="REMEDIATION_OWNER",
                notes="Initial assignment upon creation",
                due_at=target_date
            )
            db.add(assign)
            RemediationService._create_notification(
                db=db,
                user_id=payload.owner_id,
                title="New Remediation Assigned",
                message=f"You have been assigned as remediation owner for {remediation.business_id}: {remediation.title}."
            )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def update_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        payload: RemediationUpdate
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        old_val = {"title": remediation.title, "priority": remediation.priority, "target_date": str(remediation.target_date)}

        if payload.title is not None:
            remediation.title = payload.title
        if payload.description is not None:
            remediation.description = payload.description
        if payload.priority is not None:
            remediation.priority = payload.priority.upper()
        if payload.corrective_action is not None:
            remediation.corrective_action = payload.corrective_action
        if payload.root_cause is not None:
            remediation.root_cause = payload.root_cause
        if payload.implementation_steps is not None:
            remediation.implementation_steps = payload.implementation_steps
        if payload.expected_outcome is not None:
            remediation.expected_outcome = payload.expected_outcome
        if payload.completion_criteria is not None:
            remediation.completion_criteria = payload.completion_criteria
        if payload.dependencies is not None:
            remediation.dependencies = payload.dependencies
        if payload.required_evidence_types is not None:
            remediation.required_evidence_types = payload.required_evidence_types
        if payload.assigned_team is not None:
            remediation.assigned_team = payload.assigned_team
        if payload.target_date is not None:
            remediation.target_date = payload.target_date
            remediation.due_date = payload.target_date
        if payload.owner_id is not None:
            remediation.owner_id = payload.owner_id

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_UPDATED",
            resource_id=remediation.id,
            old_val=old_val,
            new_val={"title": remediation.title, "priority": remediation.priority, "target_date": str(remediation.target_date)}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def assign_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        payload: RemediationAssignPayload
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)

        old_owner = remediation.owner_id
        remediation.owner_id = payload.owner_id or remediation.owner_id
        if payload.assigned_team is not None:
            remediation.assigned_team = payload.assigned_team
        if payload.target_date is not None:
            remediation.target_date = payload.target_date
            remediation.due_date = payload.target_date

        remediation.assigned_by_id = user.id
        remediation.assigned_at = datetime.now(timezone.utc)

        if remediation.status == RemediationStatus.OPEN:
            remediation.status = RemediationStatus.ASSIGNED
            trans = WorkflowTransition(
                resource_type="Remediation",
                resource_id=remediation.id,
                from_state=RemediationStatus.OPEN,
                to_state=RemediationStatus.ASSIGNED,
                actor_id=user.id,
                reason=payload.notes or "Assigned to remediation owner"
            )
            db.add(trans)

        if payload.owner_id:
            assign = Assignment(
                resource_type="Remediation",
                resource_id=remediation.id,
                assigned_to_id=payload.owner_id,
                assigned_by_id=user.id,
                assignment_type="REMEDIATION_OWNER",
                notes=payload.notes,
                due_at=remediation.target_date
            )
            db.add(assign)

            RemediationService._create_notification(
                db=db,
                user_id=payload.owner_id,
                title="Remediation Assigned",
                message=f"You have been assigned to {remediation.business_id}: {remediation.title}."
            )

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_ASSIGNED",
            resource_id=remediation.id,
            old_val={"owner_id": str(old_owner) if old_owner else None},
            new_val={"owner_id": str(remediation.owner_id), "team": remediation.assigned_team}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def start_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.IN_PROGRESS)

        old_status = remediation.status
        remediation.status = RemediationStatus.IN_PROGRESS
        if not remediation.started_at:
            remediation.started_at = datetime.now(timezone.utc)

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.IN_PROGRESS,
            actor_id=user.id,
            reason="Implementation commenced"
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_STARTED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.IN_PROGRESS}
        )

        if remediation.assigned_by_id and remediation.assigned_by_id != user.id:
            RemediationService._create_notification(
                db=db,
                user_id=remediation.assigned_by_id,
                title="Remediation Started",
                message=f"Remediation {remediation.business_id} has been started by {user.first_name} {user.last_name}."
            )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def block_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        payload: RemediationBlockPayload
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.BLOCKED)
        RemediationWorkflowEngine.validate_block(payload.blocked_reason)

        old_status = remediation.status
        remediation.status = RemediationStatus.BLOCKED
        remediation.blocked_reason = payload.blocked_reason
        remediation.blocked_by_id = user.id
        remediation.blocked_at = datetime.now(timezone.utc)

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.BLOCKED,
            actor_id=user.id,
            reason=payload.blocked_reason
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_BLOCKED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.BLOCKED, "reason": payload.blocked_reason}
        )

        if remediation.assigned_by_id and remediation.assigned_by_id != user.id:
            RemediationService._create_notification(
                db=db,
                user_id=remediation.assigned_by_id,
                title="Remediation Blocked",
                message=f"Remediation {remediation.business_id} blocked by {user.first_name} {user.last_name}: {payload.blocked_reason}"
            )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def unblock_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        notes: Optional[str] = None
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.IN_PROGRESS)

        old_status = remediation.status
        remediation.status = RemediationStatus.IN_PROGRESS
        remediation.blocked_reason = None
        remediation.blocked_by_id = None
        remediation.blocked_at = None

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.IN_PROGRESS,
            actor_id=user.id,
            reason=notes or "Obstacle resolved; implementation resumed."
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_UNBLOCKED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.IN_PROGRESS}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def submit_evidence(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        notes: Optional[str] = None
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.EVIDENCE_SUBMITTED)

        # Enforce required evidence types checklist (Section 10)
        if remediation.required_evidence_types:
            reqs = [x.strip().upper() for x in remediation.required_evidence_types.split(",") if x.strip()]
            submitted_types = {ev.evidence_type.upper() for ev in (remediation.evidence_items or [])}
            missing = [r for r in reqs if r not in submitted_types]
            if missing and not (notes and ("exception" in notes.lower() or "waiver" in notes.lower() or len(notes.strip()) >= 15)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot submit for validation: missing required evidence types ({', '.join(missing)}). Attach required evidence or document an explicit exception note."
                )

        old_status = remediation.status
        remediation.status = RemediationStatus.EVIDENCE_SUBMITTED
        remediation.completed_at = datetime.now(timezone.utc)

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.EVIDENCE_SUBMITTED,
            actor_id=user.id,
            reason=notes or "Remediation corrective action completed and evidence submitted for validation."
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_EVIDENCE_SUBMITTED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.EVIDENCE_SUBMITTED}
        )

        if remediation.assigned_by_id and remediation.assigned_by_id != user.id:
            RemediationService._create_notification(
                db=db,
                user_id=remediation.assigned_by_id,
                title="Remediation Evidence Submitted",
                message=f"Evidence submitted for {remediation.business_id}. Validation review is required."
            )


        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def begin_validation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.VALIDATION)

        old_status = remediation.status
        remediation.status = RemediationStatus.VALIDATION

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.VALIDATION,
            actor_id=user.id,
            reason="Independent validator commenced inspection"
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_VALIDATION_STARTED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.VALIDATION}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def verify_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        payload: RemediationValidationDecision
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)

        # Enforce Separation of Duties (Owner/Executor cannot verify)
        RemediationWorkflowEngine.validate_verification_sod(remediation, user)

        decision = payload.decision.upper()
        old_status = remediation.status

        if decision == "VERIFIED":
            RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.VERIFIED)
            remediation.status = RemediationStatus.VERIFIED
            remediation.verified_at = datetime.now(timezone.utc)
            remediation.verified_by_id = user.id
            remediation.validator_comments = payload.reviewer_comments
            remediation.validation_decision = "VERIFIED"

            approval = Approval(
                resource_type="Remediation",
                resource_id=remediation.id,
                approver_id=user.id,
                status="APPROVED",
                comments=payload.reviewer_comments
            )
            db.add(approval)

            trans = WorkflowTransition(
                resource_type="Remediation",
                resource_id=remediation.id,
                from_state=old_status,
                to_state=RemediationStatus.VERIFIED,
                actor_id=user.id,
                reason=payload.reviewer_comments or "Corrective actions verified and validated against controls."
            )
            db.add(trans)

            if remediation.owner_id:
                RemediationService._create_notification(
                    db=db,
                    user_id=remediation.owner_id,
                    title="Remediation Verified",
                    message=f"Remediation {remediation.business_id} has been formally verified by independent validator."
                )

        elif decision in ["RETURNED_FOR_CORRECTION", "REJECTED"]:
            RemediationWorkflowEngine.validate_return_for_correction(payload.reviewer_comments)
            RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.IN_PROGRESS)

            remediation.status = RemediationStatus.IN_PROGRESS
            remediation.validator_comments = payload.reviewer_comments
            remediation.validation_decision = "RETURNED_FOR_CORRECTION"

            approval = Approval(
                resource_type="Remediation",
                resource_id=remediation.id,
                approver_id=user.id,
                status="CHANGES_REQUESTED",
                comments=payload.reviewer_comments
            )
            db.add(approval)

            trans = WorkflowTransition(
                resource_type="Remediation",
                resource_id=remediation.id,
                from_state=old_status,
                to_state=RemediationStatus.IN_PROGRESS,
                actor_id=user.id,
                reason=f"Returned for correction: {payload.reviewer_comments}"
            )
            db.add(trans)

            if remediation.owner_id:
                RemediationService._create_notification(
                    db=db,
                    user_id=remediation.owner_id,
                    title="Remediation Returned for Correction",
                    message=f"Remediation {remediation.business_id} requires correction: {payload.reviewer_comments}."
                )
        else:
            raise HTTPException(status_code=400, detail=f"Invalid validation decision '{decision}'. Must be VERIFIED or RETURNED_FOR_CORRECTION.")

        RemediationService._create_audit(
            db=db,
            actor=user,
            action=f"REMEDIATION_{decision}",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": remediation.status, "comments": payload.reviewer_comments}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    @staticmethod
    def close_remediation(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        closure_notes: Optional[str] = None
    ) -> Remediation:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        RemediationWorkflowEngine.validate_transition(remediation.status, RemediationStatus.CLOSED)

        old_status = remediation.status
        remediation.status = RemediationStatus.CLOSED
        remediation.closed_at = datetime.now(timezone.utc)
        remediation.closed_by_id = user.id

        trans = WorkflowTransition(
            resource_type="Remediation",
            resource_id=remediation.id,
            from_state=old_status,
            to_state=RemediationStatus.CLOSED,
            actor_id=user.id,
            reason=closure_notes or "Remediation lifecycle closed."
        )
        db.add(trans)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_CLOSED",
            resource_id=remediation.id,
            old_val={"status": old_status},
            new_val={"status": RemediationStatus.CLOSED, "notes": closure_notes}
        )

        db.commit()
        db.refresh(remediation)
        return remediation

    # ----------------------------------------------------
    # Evidence Operations
    # ----------------------------------------------------
    @staticmethod
    def add_evidence(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        payload: RemediationEvidenceCreate
    ) -> Evidence:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)

        count = db.query(func.count(Evidence.id)).scalar() or 0
        year = datetime.now(timezone.utc).year
        bid = f"EVD-{year}-{(count + 1):05d}"

        evidence = Evidence(
            business_id=bid,
            title=payload.title,
            description=payload.description,
            evidence_type=payload.evidence_type.upper(),
            file_uri=payload.file_uri,
            filename=payload.filename,
            file_size=payload.file_size,
            checksum=payload.checksum,
            remediation_id=remediation.id,
            finding_id=remediation.finding_id,
            control_id=remediation.control_id,
            uploaded_by_id=user.id,
            verification_status="PENDING"
        )
        db.add(evidence)

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_EVIDENCE_ATTACHED",
            resource_id=remediation.id,
            new_val={"evidence_id": bid, "title": payload.title, "type": payload.evidence_type}
        )

        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def review_evidence(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        remediation_id: uuid.UUID,
        evidence_id: uuid.UUID,
        payload: RemediationEvidenceReview
    ) -> Evidence:
        remediation = RemediationService.get_by_id(db, user, effective_scope, remediation_id)
        evidence = db.query(Evidence).filter(
            Evidence.id == evidence_id,
            Evidence.remediation_id == remediation.id
        ).first()

        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence item not found on this remediation.")

        old_status = evidence.verification_status
        evidence.verification_status = payload.verification_status.upper()
        evidence.verified_by_id = user.id
        evidence.verified_at = datetime.now(timezone.utc)
        evidence.reviewer_comments = payload.reviewer_comments

        RemediationService._create_audit(
            db=db,
            actor=user,
            action="REMEDIATION_EVIDENCE_REVIEWED",
            resource_id=remediation.id,
            old_val={"evidence_id": evidence.business_id, "status": old_status},
            new_val={"status": evidence.verification_status, "comments": payload.reviewer_comments}
        )

        db.commit()
        db.refresh(evidence)
        return evidence

    # ----------------------------------------------------
    # Timeline
    # ----------------------------------------------------
    @staticmethod
    def get_timeline(db: Session, remediation_id: uuid.UUID) -> List[RemediationTimelineEvent]:
        events: List[RemediationTimelineEvent] = []

        # 1. Transitions
        transitions = db.query(WorkflowTransition).options(
            joinedload(WorkflowTransition.actor)
        ).filter(
            WorkflowTransition.resource_type == "Remediation",
            WorkflowTransition.resource_id == remediation_id
        ).all()

        for t in transitions:
            events.append(
                RemediationTimelineEvent(
                    id=f"trans-{t.id}",
                    remediation_id=remediation_id,
                    event_type="STATE_TRANSITION",
                    title=f"Status: {t.from_state} → {t.to_state}",
                    description=t.reason or "Workflow transition executed",
                    actor_id=t.actor_id,
                    actor_name=f"{t.actor.first_name} {t.actor.last_name}" if t.actor else "System",
                    created_at=t.created_at
                )
            )

        # 2. Assignments
        assignments = db.query(Assignment).options(
            joinedload(Assignment.assigned_to),
            joinedload(Assignment.assigned_by)
        ).filter(
            Assignment.resource_type == "Remediation",
            Assignment.resource_id == remediation_id
        ).all()

        for a in assignments:
            events.append(
                RemediationTimelineEvent(
                    id=f"assign-{a.id}",
                    remediation_id=remediation_id,
                    event_type="ASSIGNMENT",
                    title=f"Assigned to {a.assigned_to.first_name} {a.assigned_to.last_name}" if a.assigned_to else "Assigned",
                    description=a.notes or "Remediation ownership assignment",
                    actor_id=a.assigned_by_id,
                    actor_name=f"{a.assigned_by.first_name} {a.assigned_by.last_name}" if a.assigned_by else "System",
                    created_at=a.created_at
                )
            )

        # 3. Evidence
        evidence_items = db.query(Evidence).options(
            joinedload(Evidence.uploaded_by),
            joinedload(Evidence.verified_by)
        ).filter(Evidence.remediation_id == remediation_id).all()

        for ev in evidence_items:
            events.append(
                RemediationTimelineEvent(
                    id=f"evd-{ev.id}",
                    remediation_id=remediation_id,
                    event_type="EVIDENCE_UPLOAD",
                    title=f"Evidence Attached: {ev.business_id}",
                    description=f"{ev.title} ({ev.evidence_type})",
                    actor_id=ev.uploaded_by_id,
                    actor_name=f"{ev.uploaded_by.first_name} {ev.uploaded_by.last_name}" if ev.uploaded_by else "User",
                    created_at=ev.created_at
                )
            )
            if ev.verified_at:
                events.append(
                    RemediationTimelineEvent(
                        id=f"evd-ver-{ev.id}",
                        remediation_id=remediation_id,
                        event_type="EVIDENCE_VERIFIED",
                        title=f"Evidence {ev.verification_status}: {ev.business_id}",
                        description=ev.reviewer_comments or "Evidence verification decision recorded",
                        actor_id=ev.verified_by_id,
                        actor_name=f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else "Validator",
                        created_at=ev.verified_at
                    )
                )

        events.sort(key=lambda x: x.created_at, reverse=True)
        return events
