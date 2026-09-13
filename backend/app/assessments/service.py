import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, desc
from fastapi import HTTPException

from app.models.assessment import Assessment, AssessmentControl
from app.models.control import Control
from app.models.security import Evidence, CSE, Investigation
from app.models.finding import Finding
from app.models.identity import User
from app.models.organization import Organization, Sector
from app.models.workflow import WorkflowTransition, Assignment, Approval
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.rbac.scopes import ScopeType, check_resource_scope
from app.assessments.schemas import (
    AssessmentCreate,
    AssessmentUpdate,
    AssessmentControlCreate,
    AssessmentControlUpdate,
    AssessmentAssignPayload,
    EvidenceVerifyPayload,
    AssessmentType,
    AssessmentStatus,
    ControlEvaluationStatus,
    ControlEffectiveness
)
from app.assessments.workflow_engine import validate_assessment_transition


class AssessmentsService:

    @staticmethod
    def _create_audit(
        db: Session,
        actor_id: Optional[uuid.UUID],
        action: str,
        resource_type: str,
        resource_id: uuid.UUID,
        old_val: Any = None,
        new_val: Any = None
    ) -> None:
        db.add(AuditLog(
            actor_user_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_val,
            new_value=new_val
        ))

    @staticmethod
    def _create_notification(
        db: Session,
        recipient_id: uuid.UUID,
        n_type: str,
        title: str,
        message: str
    ) -> None:
        db.add(Notification(
            recipient_id=recipient_id,
            type=n_type,
            title=title,
            message=message
        ))

    @staticmethod
    def _generate_business_id(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        prefix = f"ASM-{current_year}-"
        
        last_rec = (
            db.query(Assessment)
            .filter(Assessment.business_id.like(f"{prefix}%"))
            .order_by(Assessment.business_id.desc())
            .first()
        )
        if not last_rec:
            return f"{prefix}00001"
        try:
            last_seq = int(last_rec.business_id.split("-")[-1])
            new_seq = last_seq + 1
            return f"{prefix}{new_seq:05d}"
        except Exception:
            return f"{prefix}{uuid.uuid4().hex[:5].upper()}"

    @staticmethod
    def _apply_scope_filter(query, user: Any, effective_scope: str):
        if not user or effective_scope == ScopeType.ENTERPRISE:
            return query
        
        if effective_scope == ScopeType.SECTOR:
            user_sec_id = getattr(user, "sector_id", None)
            return query.filter(Assessment.sector_id == user_sec_id) if user_sec_id else query.filter(False)
            
        if effective_scope == ScopeType.ORGANIZATION:
            user_org_id = getattr(user, "organization_id", None)
            return query.filter(Assessment.organization_id == user_org_id) if user_org_id else query.filter(False)
            
        if effective_scope == ScopeType.ASSIGNED:
            user_id = getattr(user, "id", None)
            return query.filter(
                or_(
                    Assessment.assessor_id == user_id,
                    Assessment.reviewer_id == user_id,
                    Assessment.created_by_id == user_id
                )
            ) if user_id else query.filter(False)
            
        return query

    @classmethod
    def get_assessments(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        status: Optional[str] = None,
        assessment_type: Optional[str] = None,
        priority: Optional[str] = None,
        assessor_id: Optional[uuid.UUID] = None,
        reviewer_id: Optional[uuid.UUID] = None,
        organization_id: Optional[uuid.UUID] = None,
        sector_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Assessment], int]:
        query = db.query(Assessment).options(
            joinedload(Assessment.organization),
            joinedload(Assessment.sector),
            joinedload(Assessment.assessor),
            joinedload(Assessment.reviewer),
            joinedload(Assessment.cse),
            joinedload(Assessment.investigation),
            joinedload(Assessment.assessment_controls),
            joinedload(Assessment.evidence),
            joinedload(Assessment.findings)
        )
        
        query = cls._apply_scope_filter(query, user, effective_scope)

        if status:
            query = query.filter(Assessment.status == status.upper())
        if assessment_type:
            query = query.filter(Assessment.assessment_type == assessment_type.upper())
        if priority:
            query = query.filter(Assessment.priority == priority.upper())
        if assessor_id:
            query = query.filter(Assessment.assessor_id == assessor_id)
        if reviewer_id:
            query = query.filter(Assessment.reviewer_id == reviewer_id)
        if organization_id:
            query = query.filter(Assessment.organization_id == organization_id)
        if sector_id:
            query = query.filter(Assessment.sector_id == sector_id)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Assessment.business_id.ilike(s),
                    Assessment.title.ilike(s),
                    Assessment.description.ilike(s),
                    Assessment.scope.ilike(s)
                )
            )

        total = query.count()
        items = query.order_by(desc(Assessment.created_at)).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    @classmethod
    def get_review_queue(
        cls,
        db: Session,
        user: Any,
        effective_scope: str
    ) -> List[Assessment]:
        """
        Retrieves assessments currently pending auditor review:
        SUBMITTED, UNDER_REVIEW, CHANGES_REQUESTED, RESUBMITTED
        """
        review_statuses = [
            AssessmentStatus.SUBMITTED,
            AssessmentStatus.UNDER_REVIEW,
            AssessmentStatus.CHANGES_REQUESTED,
            AssessmentStatus.RESUBMITTED
        ]
        query = db.query(Assessment).options(
            joinedload(Assessment.organization),
            joinedload(Assessment.sector),
            joinedload(Assessment.assessor),
            joinedload(Assessment.reviewer),
            joinedload(Assessment.assessment_controls),
            joinedload(Assessment.evidence),
            joinedload(Assessment.findings)
        ).filter(Assessment.status.in_(review_statuses))

        query = cls._apply_scope_filter(query, user, effective_scope)
        return query.order_by(desc(Assessment.submitted_date), desc(Assessment.created_at)).all()

    @classmethod
    def get_assessment_by_id(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID
    ) -> Assessment:
        assessment = (
            db.query(Assessment)
            .options(
                joinedload(Assessment.organization),
                joinedload(Assessment.sector),
                joinedload(Assessment.assessor),
                joinedload(Assessment.reviewer),
                joinedload(Assessment.created_by),
                joinedload(Assessment.cse),
                joinedload(Assessment.investigation),
                joinedload(Assessment.assessment_controls).joinedload(AssessmentControl.control),
                joinedload(Assessment.assessment_controls).joinedload(AssessmentControl.finding),
                joinedload(Assessment.assessment_controls).joinedload(AssessmentControl.evaluator),
                joinedload(Assessment.evidence).joinedload(Evidence.control),
                joinedload(Assessment.evidence).joinedload(Evidence.verified_by),
                joinedload(Assessment.evidence).joinedload(Evidence.uploaded_by),
                joinedload(Assessment.findings)
            )
            .filter(Assessment.id == assessment_id)
            .first()
        )
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found.")

        if not check_resource_scope(user, effective_scope, assessment):
            raise HTTPException(
                status_code=403,
                detail="Access denied: Resource is outside your authorized organizational or sectoral scope."
            )
        return assessment

    @classmethod
    def create_assessment(
        cls,
        db: Session,
        user: Any,
        payload: AssessmentCreate
    ) -> Assessment:
        business_id = cls._generate_business_id(db)

        # Inherit tenancy
        org_id = payload.organization_id or getattr(user, "organization_id", None)
        sector_id = payload.sector_id or getattr(user, "sector_id", None)

        if payload.cse_id and (not org_id or not sector_id):
            cse_rec = db.query(CSE).filter(CSE.id == payload.cse_id).first()
            if cse_rec:
                org_id = org_id or cse_rec.organization_id
                sector_id = sector_id or cse_rec.sector_id

        initial_status = AssessmentStatus.ASSIGNED if payload.assessor_id else AssessmentStatus.DRAFT

        assessment = Assessment(
            business_id=business_id,
            title=payload.title,
            description=payload.description,
            assessment_type=payload.assessment_type.upper(),
            status=initial_status,
            priority=payload.priority.upper(),
            scope=payload.scope,
            organization_id=org_id,
            sector_id=sector_id,
            cse_id=payload.cse_id,
            investigation_id=payload.investigation_id,
            assessor_id=payload.assessor_id,
            reviewer_id=payload.reviewer_id,
            created_by_id=user.id,
            due_date=payload.due_date
        )
        db.add(assessment)
        db.flush()

        # Attach initial controls if provided
        if payload.control_ids:
            for c_id in payload.control_ids:
                ctrl = db.query(Control).filter(Control.id == c_id).first()
                if ctrl:
                    ac = AssessmentControl(
                        assessment_id=assessment.id,
                        control_id=ctrl.id,
                        evaluator_id=payload.assessor_id,
                        status=ControlEvaluationStatus.NOT_STARTED,
                        effectiveness=ControlEffectiveness.NOT_ASSESSED,
                        evidence_required=False
                    )
                    db.add(ac)

        # Audit Log
        cls._create_audit(
            db,
            actor_id=user.id,
            action="ASSESSMENT_CREATED",
            resource_type="ASSESSMENT",
            resource_id=assessment.id,
            new_val={"business_id": business_id, "title": assessment.title, "type": assessment.assessment_type}
        )

        # Initial Assignment Notification
        if payload.assessor_id:
            db.add(Assignment(
                resource_type="ASSESSMENT",
                resource_id=assessment.id,
                assigned_to_id=payload.assessor_id,
                assigned_by_id=user.id,
                assignment_type="LEAD_ASSESSOR",
                status="ACTIVE",
                notes="Assigned as Lead Assessor",
                due_at=payload.due_date
            ))
            cls._create_notification(
                db,
                recipient_id=payload.assessor_id,
                n_type="ASSIGNMENT",
                title="Assessment Assigned",
                message=f"You have been assigned as Lead Assessor for {business_id}: {assessment.title}"
            )

        db.commit()
        db.refresh(assessment)
        return assessment

    @classmethod
    def update_assessment(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        payload: AssessmentUpdate
    ) -> Assessment:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)

        update_data = payload.model_dump(exclude_unset=True)
        old_val = {}
        for field, val in update_data.items():
            if val is not None:
                old_val[field] = str(getattr(assessment, field, None))
                if field in ["assessment_type", "priority"]:
                    setattr(assessment, field, val.upper())
                else:
                    setattr(assessment, field, val)

        cls._create_audit(
            db,
            actor_id=user.id,
            action="ASSESSMENT_UPDATED",
            resource_type="ASSESSMENT",
            resource_id=assessment.id,
            old_val=old_val,
            new_val={k: str(v) for k, v in update_data.items()}
        )

        db.commit()
        db.refresh(assessment)
        return assessment

    @classmethod
    def transition_assessment(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        target_state: str,
        reason: Optional[str] = None,
        comments: Optional[str] = None
    ) -> Assessment:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        current_state = assessment.status
        target_state = target_state.upper()

        validate_assessment_transition(
            current_state=current_state,
            target_state=target_state,
            user=user,
            assessment=assessment,
            reason=reason,
            comments=comments
        )

        now = datetime.now(timezone.utc)
        assessment.status = target_state

        # Update relevant timestamps based on target state
        if target_state == AssessmentStatus.IN_PROGRESS and not assessment.start_date:
            assessment.start_date = now
        elif target_state == AssessmentStatus.SUBMITTED:
            assessment.submitted_date = now
        elif target_state == AssessmentStatus.APPROVED:
            assessment.approved_date = now
            # Create Approval record
            db.add(Approval(
                resource_type="ASSESSMENT",
                resource_id=assessment.id,
                approver_id=user.id,
                status="APPROVED",
                comments=comments or reason or "Assessment approved by Auditor Reviewer."
            ))
        elif target_state == AssessmentStatus.CLOSED:
            assessment.closed_date = now

        # Create WorkflowTransition
        db.add(WorkflowTransition(
            resource_type="ASSESSMENT",
            resource_id=assessment.id,
            from_state=current_state,
            to_state=target_state,
            actor_id=user.id,
            reason=comments or reason or f"Transitioned from {current_state} to {target_state}"
        ))

        # Create Audit Log
        cls._create_audit(
            db,
            actor_id=user.id,
            action="ASSESSMENT_TRANSITION",
            resource_type="ASSESSMENT",
            resource_id=assessment.id,
            old_val={"status": current_state},
            new_val={"status": target_state, "reason": comments or reason}
        )

        # In-App Notifications based on transition
        if target_state == AssessmentStatus.SUBMITTED and assessment.reviewer_id:
            cls._create_notification(
                db,
                recipient_id=assessment.reviewer_id,
                n_type="SUBMISSION",
                title="Assessment Submitted for Review",
                message=f"{assessment.business_id} has been submitted by assessor and awaits your review."
            )
        elif target_state == AssessmentStatus.CHANGES_REQUESTED and assessment.assessor_id:
            cls._create_notification(
                db,
                recipient_id=assessment.assessor_id,
                n_type="CHANGES_REQUESTED",
                title="Changes Requested on Assessment",
                message=f"Auditor requested revisions for {assessment.business_id}. Reason: {comments or reason}"
            )
        elif target_state == AssessmentStatus.APPROVED and assessment.assessor_id:
            cls._create_notification(
                db,
                recipient_id=assessment.assessor_id,
                n_type="APPROVAL",
                title="Assessment Approved",
                message=f"Assessment {assessment.business_id} has been formally approved."
            )

        db.commit()
        db.refresh(assessment)
        return assessment

    @classmethod
    def assign_assessment(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        payload: AssessmentAssignPayload
    ) -> Assessment:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)

        if payload.assessor_id:
            assessment.assessor_id = payload.assessor_id
            db.add(Assignment(
                resource_type="ASSESSMENT",
                resource_id=assessment.id,
                assigned_to_id=payload.assessor_id,
                assigned_by_id=user.id,
                assignment_type="LEAD_ASSESSOR",
                status="ACTIVE",
                notes=payload.notes,
                due_at=payload.due_date or assessment.due_date
            ))
            cls._create_notification(
                db,
                recipient_id=payload.assessor_id,
                n_type="ASSIGNMENT",
                title="Assessment Assigned",
                message=f"Assigned as Lead Assessor for {assessment.business_id}"
            )

        if payload.reviewer_id:
            assessment.reviewer_id = payload.reviewer_id
            db.add(Assignment(
                resource_type="ASSESSMENT",
                resource_id=assessment.id,
                assigned_to_id=payload.reviewer_id,
                assigned_by_id=user.id,
                assignment_type="AUDITOR_REVIEWER",
                status="ACTIVE",
                notes=payload.notes,
                due_at=payload.due_date or assessment.due_date
            ))
            cls._create_notification(
                db,
                recipient_id=payload.reviewer_id,
                n_type="ASSIGNMENT",
                title="Auditor Reviewer Designated",
                message=f"You have been designated as Auditor Reviewer for {assessment.business_id}"
            )

        if payload.due_date:
            assessment.due_date = payload.due_date

        if assessment.status == AssessmentStatus.DRAFT and assessment.assessor_id:
            assessment.status = AssessmentStatus.ASSIGNED

        cls._create_audit(
            db,
            actor_id=user.id,
            action="ASSESSMENT_ASSIGNED",
            resource_type="ASSESSMENT",
            resource_id=assessment.id,
            new_val={"assessor_id": str(payload.assessor_id) if payload.assessor_id else None, "reviewer_id": str(payload.reviewer_id) if payload.reviewer_id else None}
        )

        db.commit()
        db.refresh(assessment)
        return assessment

    @classmethod
    def add_control(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        payload: AssessmentControlCreate
    ) -> AssessmentControl:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        
        control = db.query(Control).filter(Control.id == payload.control_id).first()
        if not control:
            raise HTTPException(status_code=404, detail="Security control not found.")

        # Check for existing duplicate link
        existing = (
            db.query(AssessmentControl)
            .filter(
                AssessmentControl.assessment_id == assessment_id,
                AssessmentControl.control_id == payload.control_id
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="This control is already attached to this assessment.")

        ac = AssessmentControl(
            assessment_id=assessment.id,
            control_id=control.id,
            evaluator_id=assessment.assessor_id or user.id,
            status=ControlEvaluationStatus.NOT_STARTED,
            effectiveness=ControlEffectiveness.NOT_ASSESSED,
            evaluation_notes=payload.evaluation_notes,
            evidence_required=payload.evidence_required or False
        )
        db.add(ac)
        db.commit()
        db.refresh(ac)
        return ac

    @classmethod
    def update_control(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        assessment_control_id: uuid.UUID,
        payload: AssessmentControlUpdate
    ) -> AssessmentControl:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        ac = (
            db.query(AssessmentControl)
            .filter(
                AssessmentControl.id == assessment_control_id,
                AssessmentControl.assessment_id == assessment.id
            )
            .first()
        )
        if not ac:
            raise HTTPException(status_code=404, detail="Assessment control not found.")

        now = datetime.now(timezone.utc)
        update_data = payload.model_dump(exclude_unset=True)

        for field, val in update_data.items():
            if val is not None:
                if field in ["status", "effectiveness"]:
                    setattr(ac, field, val.upper())
                else:
                    setattr(ac, field, val)

        if payload.status or payload.effectiveness or payload.evaluation_notes:
            ac.evaluator_id = user.id
            ac.evaluated_at = now

        if payload.reviewer_comments:
            ac.reviewed_at = now

        cls._create_audit(
            db,
            actor_id=user.id,
            action="CONTROL_EVALUATED",
            resource_type="ASSESSMENT_CONTROL",
            resource_id=ac.id,
            new_val={"status": ac.status, "effectiveness": ac.effectiveness}
        )

        db.commit()
        db.refresh(ac)
        return ac

    @classmethod
    def verify_evidence(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        evidence_id: uuid.UUID,
        payload: EvidenceVerifyPayload
    ) -> Evidence:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        
        evidence = (
            db.query(Evidence)
            .filter(
                Evidence.id == evidence_id,
                Evidence.assessment_id == assessment.id
            )
            .first()
        )
        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence not found on this assessment.")

        now = datetime.now(timezone.utc)
        evidence.verification_status = payload.verification_status.upper()
        evidence.verified_by_id = user.id
        evidence.verified_at = now
        evidence.reviewer_comments = payload.reviewer_comments

        # If evidence is linked to a control, update assessment control flags
        if evidence.control_id:
            ac = (
                db.query(AssessmentControl)
                .filter(
                    AssessmentControl.assessment_id == assessment.id,
                    AssessmentControl.control_id == evidence.control_id
                )
                .first()
            )
            if ac:
                if payload.verification_status.upper() == "VERIFIED":
                    ac.evidence_verified = True
                elif payload.verification_status.upper() in ["REJECTED", "CHANGES_REQUIRED"]:
                    ac.evidence_verified = False

        cls._create_audit(
            db,
            actor_id=user.id,
            action="EVIDENCE_VERIFIED",
            resource_type="EVIDENCE",
            resource_id=evidence.id,
            new_val={"verification_status": evidence.verification_status, "reviewer_comments": payload.reviewer_comments}
        )

        db.commit()
        db.refresh(evidence)
        return evidence

    @classmethod
    def link_finding(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID,
        finding_id: uuid.UUID
    ) -> Finding:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found.")

        finding.assessment_id = assessment.id
        cls._create_audit(
            db,
            actor_id=user.id,
            action="FINDING_LINKED_TO_ASSESSMENT",
            resource_type="FINDING",
            resource_id=finding.id,
            new_val={"assessment_id": str(assessment.id), "finding_id": str(finding.id)}
        )

        db.commit()
        db.refresh(finding)
        return finding

    @classmethod
    def get_timeline(
        cls,
        db: Session,
        user: Any,
        effective_scope: str,
        assessment_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        assessment = cls.get_assessment_by_id(db, user, effective_scope, assessment_id)
        timeline = []

        # 1. Transitions
        transitions = (
            db.query(WorkflowTransition)
            .options(joinedload(WorkflowTransition.actor))
            .filter(
                WorkflowTransition.resource_type == "ASSESSMENT",
                WorkflowTransition.resource_id == assessment.id
            )
            .all()
        )
        for t in transitions:
            actor_name = f"{t.actor.first_name} {t.actor.last_name}" if t.actor else "System"
            timeline.append({
                "event_type": "STATE_TRANSITION",
                "timestamp": t.created_at,
                "actor_name": actor_name,
                "summary": f"Transitioned to {t.to_state}",
                "details": t.reason
            })

        # 2. Approvals
        approvals = (
            db.query(Approval)
            .options(joinedload(Approval.approver))
            .filter(
                Approval.resource_type == "ASSESSMENT",
                Approval.resource_id == assessment.id
            )
            .all()
        )
        for a in approvals:
            approver_name = f"{a.approver.first_name} {a.approver.last_name}" if a.approver else "Reviewer"
            timeline.append({
                "event_type": "APPROVAL_DECISION",
                "timestamp": a.created_at,
                "actor_name": approver_name,
                "summary": f"Formally {a.status}",
                "details": a.comments
            })

        # 3. Evidence verified
        for ev in assessment.evidence:
            if ev.verified_at:
                v_name = f"{ev.verified_by.first_name} {ev.verified_by.last_name}" if ev.verified_by else "Auditor"
                timeline.append({
                    "event_type": "EVIDENCE_REVIEWED",
                    "timestamp": ev.verified_at,
                    "actor_name": v_name,
                    "summary": f"Evidence {ev.business_id} marked as {ev.verification_status}",
                    "details": ev.reviewer_comments
                })

        # 4. Audit Log entries
        audits = (
            db.query(AuditLog)
            .filter(
                AuditLog.resource_type.in_(["ASSESSMENT", "ASSESSMENT_CONTROL"]),
                AuditLog.resource_id == assessment.id
            )
            .all()
        )
        for au in audits:
            if au.action not in ["ASSESSMENT_TRANSITION", "ASSESSMENT_ASSIGNED"]:
                u = db.query(User).filter(User.id == au.actor_user_id).first() if au.actor_user_id else None
                u_name = f"{u.first_name} {u.last_name}" if u else "System"
                details_str = None
                if isinstance(au.new_value, dict):
                    details_str = ", ".join(f"{k}={v}" for k, v in au.new_value.items())
                timeline.append({
                    "event_type": au.action,
                    "timestamp": au.created_at,
                    "actor_name": u_name,
                    "summary": au.action.replace("_", " ").title(),
                    "details": details_str
                })

        # Sort descending by timestamp
        timeline.sort(key=lambda x: x["timestamp"], reverse=True)
        return timeline

    @classmethod
    def get_stats(cls, db: Session, user: Any, effective_scope: str) -> Dict[str, int]:
        now = datetime.now(timezone.utc)
        query = db.query(Assessment)
        query = cls._apply_scope_filter(query, user, effective_scope)

        assessments = query.all()

        stats = {
            "total": len(assessments),
            "draft": 0,
            "assigned": 0,
            "in_progress": 0,
            "evidence_required": 0,
            "submitted": 0,
            "under_review": 0,
            "changes_requested": 0,
            "resubmitted": 0,
            "approved": 0,
            "closed": 0,
            "overdue": 0
        }

        for a in assessments:
            s = a.status.upper()
            if s == AssessmentStatus.DRAFT:
                stats["draft"] += 1
            elif s == AssessmentStatus.ASSIGNED:
                stats["assigned"] += 1
            elif s == AssessmentStatus.IN_PROGRESS:
                stats["in_progress"] += 1
            elif s == AssessmentStatus.EVIDENCE_REQUIRED:
                stats["evidence_required"] += 1
            elif s == AssessmentStatus.SUBMITTED:
                stats["submitted"] += 1
            elif s == AssessmentStatus.UNDER_REVIEW:
                stats["under_review"] += 1
            elif s == AssessmentStatus.CHANGES_REQUESTED:
                stats["changes_requested"] += 1
            elif s == AssessmentStatus.RESUBMITTED:
                stats["resubmitted"] += 1
            elif s == AssessmentStatus.APPROVED:
                stats["approved"] += 1
            elif s == AssessmentStatus.CLOSED:
                stats["closed"] += 1

            if a.due_date and a.due_date < now and s not in [AssessmentStatus.APPROVED, AssessmentStatus.CLOSED]:
                stats["overdue"] += 1

        return stats
