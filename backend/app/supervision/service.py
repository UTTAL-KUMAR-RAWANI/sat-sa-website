from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from fastapi import HTTPException, status

from app.models.identity import User
from app.models.organization import Organization, Sector
from app.models.security import CSE
from app.models.finding import Finding
from app.models.risk import Risk
from app.models.remediation import Remediation
from app.models.workflow import Escalation, WorkflowTransition
from app.models.supervision import SupervisoryCase, SupervisoryDecision
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.rbac.scopes import ScopeType, check_resource_scope
from app.supervision.workflow_engine import SupervisionWorkflowEngine
from app.supervision.schemas import (
    SupervisoryCaseCreate,
    SupervisoryCaseUpdate,
    CaseAssignRequest,
    CaseStartReviewRequest,
    CaseRecommendationRequest,
    CaseRequestReviewRequest,
    CaseDecisionRequest,
    CaseCloseRequest,
    EscalationCreate,
    EscalationAssignRequest,
    EscalationResolveRequest,
    SupervisoryDecisionCreate,
    SupervisoryFindingCreate,
)

class SupervisionService:

    @staticmethod
    def apply_case_scope(query, user: User, effective_scope: ScopeType):
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        elif effective_scope == ScopeType.SECTOR:
            return query.filter(SupervisoryCase.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            return query.filter(SupervisoryCase.organization_id == user.organization_id)
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(
                or_(
                    SupervisoryCase.assigned_analyst_id == user.id,
                    SupervisoryCase.supervisory_authority_id == user.id,
                    SupervisoryCase.decided_by_id == user.id,
                    SupervisoryCase.created_by_id == user.id,
                )
            )
        elif effective_scope == ScopeType.OWN:
            return query.filter(SupervisoryCase.created_by_id == user.id)
        return query.filter(SupervisoryCase.id == None)

    @staticmethod
    def apply_escalation_scope(query, user: User, effective_scope: ScopeType):
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        elif effective_scope == ScopeType.SECTOR:
            return query.filter(Escalation.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            return query.filter(Escalation.organization_id == user.organization_id)
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(
                or_(
                    Escalation.escalated_to_id == user.id,
                    Escalation.escalated_by_id == user.id,
                )
            )
        elif effective_scope == ScopeType.OWN:
            return query.filter(Escalation.escalated_by_id == user.id)
        return query.filter(Escalation.id == None)

    @staticmethod
    def apply_decision_scope(query, user: User, effective_scope: ScopeType):
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        elif effective_scope == ScopeType.SECTOR:
            return query.filter(SupervisoryDecision.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            return query.filter(SupervisoryDecision.organization_id == user.organization_id)
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(SupervisoryDecision.decision_maker_id == user.id)
        elif effective_scope == ScopeType.OWN:
            return query.filter(SupervisoryDecision.decision_maker_id == user.id)
        return query.filter(SupervisoryDecision.id == None)

    # ==================== SUMMARY & METRICS ====================

    @classmethod
    def get_summary(cls, db: Session, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)

        # Cases
        case_q = cls.apply_case_scope(db.query(SupervisoryCase), user, effective_scope)
        all_cases = case_q.all()
        open_cases = len([c for c in all_cases if c.status not in ["CLOSED"]])
        cases_awaiting_authority = len([c for c in all_cases if c.status in ["AUTHORITY_REVIEW", "DECISION_REQUIRED"]])
        cases_under_monitoring = len([c for c in all_cases if c.status == "MONITORING"])

        status_dist: Dict[str, int] = {}
        priority_dist: Dict[str, int] = {}
        for c in all_cases:
            status_dist[c.status] = status_dist.get(c.status, 0) + 1
            priority_dist[c.priority] = priority_dist.get(c.priority, 0) + 1

        # Escalations
        esc_q = cls.apply_escalation_scope(db.query(Escalation), user, effective_scope)
        all_escs = esc_q.all()
        critical_escalations = len([e for e in all_escs if e.severity == "CRITICAL" and e.status not in ["RESOLVED", "CLOSED"]])

        # Findings High/Critical
        finding_q = db.query(Finding)
        if effective_scope == ScopeType.SECTOR:
            finding_q = finding_q.filter(Finding.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            finding_q = finding_q.filter(Finding.organization_id == user.organization_id)
        high_risk_findings = finding_q.filter(
            Finding.severity.in_(["HIGH", "CRITICAL"]),
            Finding.status.notin_(["CLOSED"])
        ).count()

        # Risks Critical
        risk_q = db.query(Risk)
        if effective_scope == ScopeType.SECTOR:
            risk_q = risk_q.filter(Risk.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            risk_q = risk_q.filter(Risk.organization_id == user.organization_id)
        critical_risks = risk_q.filter(
            Risk.inherent_risk_level == "CRITICAL",
            Risk.status.notin_(["CLOSED"])
        ).count()

        # Overdue Remediations
        rem_q = db.query(Remediation)
        if effective_scope == ScopeType.SECTOR:
            rem_q = rem_q.filter(Remediation.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            rem_q = rem_q.filter(Remediation.organization_id == user.organization_id)
        overdue_remediations = rem_q.filter(
            Remediation.target_date < now,
            Remediation.status.notin_(["VERIFIED", "CLOSED"])
        ).count()

        # Decisions Pending
        dec_q = cls.apply_decision_scope(db.query(SupervisoryDecision), user, effective_scope)
        pending_decisions = dec_q.filter(SupervisoryDecision.status.in_(["DRAFT", "SUBMITTED"])).count()

        return {
            "open_cases": open_cases,
            "critical_escalations": critical_escalations,
            "high_risk_findings": high_risk_findings,
            "critical_risks": critical_risks,
            "overdue_remediations": overdue_remediations,
            "pending_decisions": pending_decisions,
            "cases_awaiting_authority": cases_awaiting_authority,
            "cases_under_monitoring": cases_under_monitoring,
            "priority_distribution": priority_dist,
            "status_distribution": status_dist,
        }

    # ==================== SUPERVISORY CASES ====================

    @classmethod
    def list_cases(
        cls,
        db: Session,
        user: User,
        effective_scope: ScopeType,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        trigger_type: Optional[str] = None,
        sector_id: Optional[uuid.UUID] = None,
        organization_id: Optional[uuid.UUID] = None,
        assigned_analyst_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        q = cls.apply_case_scope(db.query(SupervisoryCase), user, effective_scope)

        if status:
            q = q.filter(SupervisoryCase.status == status)
        if priority:
            q = q.filter(SupervisoryCase.priority == priority)
        if trigger_type:
            q = q.filter(SupervisoryCase.trigger_type == trigger_type)
        if sector_id:
            q = q.filter(SupervisoryCase.sector_id == sector_id)
        if organization_id:
            q = q.filter(SupervisoryCase.organization_id == organization_id)
        if assigned_analyst_id:
            q = q.filter(SupervisoryCase.assigned_analyst_id == assigned_analyst_id)
        if search:
            pattern = f"%{search}%"
            q = q.filter(
                or_(
                    SupervisoryCase.business_id.ilike(pattern),
                    SupervisoryCase.title.ilike(pattern),
                    SupervisoryCase.description.ilike(pattern),
                )
            )

        cases = q.order_by(desc(SupervisoryCase.created_at)).offset(skip).limit(limit).all()
        return [cls._serialize_case(c) for c in cases]

    @classmethod
    def get_case(cls, db: Session, case_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")
        return cls._serialize_case(case)

    @classmethod
    def create_case(cls, db: Session, payload: SupervisoryCaseCreate, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        year = datetime.now().year
        count = db.query(SupervisoryCase).count() + 1
        bus_id = f"SUP-{year}-{count:05d}"

        # Resolve organization/sector from sources if omitted
        org_id = payload.organization_id
        sec_id = payload.sector_id

        if payload.source_cse_id and (not org_id or not sec_id):
            cse = db.query(CSE).filter(CSE.id == payload.source_cse_id).first()
            if cse:
                org_id = org_id or cse.organization_id
                sec_id = sec_id or cse.sector_id
        elif payload.source_finding_id and (not org_id or not sec_id):
            fnd = db.query(Finding).filter(Finding.id == payload.source_finding_id).first()
            if fnd:
                org_id = org_id or fnd.organization_id
                sec_id = sec_id or fnd.sector_id
        elif payload.source_risk_id and (not org_id or not sec_id):
            rsk = db.query(Risk).filter(Risk.id == payload.source_risk_id).first()
            if rsk:
                org_id = org_id or rsk.organization_id
                sec_id = sec_id or rsk.sector_id
        elif payload.source_remediation_id and (not org_id or not sec_id):
            rem = db.query(Remediation).filter(Remediation.id == payload.source_remediation_id).first()
            if rem:
                org_id = org_id or rem.organization_id
                sec_id = sec_id or rem.sector_id

        case = SupervisoryCase(
            business_id=bus_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            status="ASSIGNED" if payload.assigned_analyst_id else "OPEN",
            trigger_type=payload.trigger_type,
            organization_id=org_id,
            sector_id=sec_id,
            created_by_id=user.id,
            assigned_analyst_id=payload.assigned_analyst_id,
            supervisory_authority_id=payload.supervisory_authority_id,
            due_date=payload.due_date,
            source_cse_id=payload.source_cse_id,
            source_finding_id=payload.source_finding_id,
            source_risk_id=payload.source_risk_id,
            source_remediation_id=payload.source_remediation_id,
            source_assessment_id=payload.source_assessment_id,
        )
        db.add(case)
        db.flush()

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, "NONE", case.status, user.id, "Case initiated")
        cls._audit(db, user.id, "SUPERVISORY_CASE_CREATED", f"Created supervisory case {bus_id}: {case.title}", case.id)

        if payload.assigned_analyst_id:
            cls._notify(db, payload.assigned_analyst_id, f"Assigned Supervisory Case {bus_id}", f"You have been assigned as analyst to {case.title}", "/supervision/cases/" + str(case.id))

        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def update_case(cls, db: Session, case_id: uuid.UUID, payload: SupervisoryCaseUpdate, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        if payload.title is not None:
            case.title = payload.title
        if payload.description is not None:
            case.description = payload.description
        if payload.priority is not None:
            case.priority = payload.priority
        if payload.due_date is not None:
            case.due_date = payload.due_date
        if payload.assigned_analyst_id is not None:
            case.assigned_analyst_id = payload.assigned_analyst_id
        if payload.supervisory_authority_id is not None:
            case.supervisory_authority_id = payload.supervisory_authority_id
        if payload.analyst_notes is not None:
            case.analyst_notes = payload.analyst_notes

        cls._audit(db, user.id, "SUPERVISORY_CASE_UPDATED", f"Updated supervisory case {case.business_id}", case.id)
        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def assign_case(cls, db: Session, case_id: uuid.UUID, payload: CaseAssignRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        prev_status = case.status
        if payload.assigned_analyst_id:
            case.assigned_analyst_id = payload.assigned_analyst_id
            if case.status == "OPEN":
                case.status = "ASSIGNED"
                cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, "ASSIGNED", user.id, payload.notes or "Assigned analyst")

        if payload.supervisory_authority_id:
            case.supervisory_authority_id = payload.supervisory_authority_id

        if payload.notes:
            case.analyst_notes = f"{case.analyst_notes or ''}\nAssignment Note: {payload.notes}".strip()

        cls._audit(db, user.id, "SUPERVISORY_CASE_ASSIGNED", f"Assigned case {case.business_id}", case.id)
        if payload.assigned_analyst_id:
            cls._notify(db, payload.assigned_analyst_id, f"Assigned Supervisory Case {case.business_id}", f"Assigned to review {case.title}", f"/supervision/cases/{case.id}")

        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def start_case_review(cls, db: Session, case_id: uuid.UUID, payload: CaseStartReviewRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_case_transition(case.status, "UNDER_REVIEW")
        prev_status = case.status
        case.status = "UNDER_REVIEW"
        if not case.assigned_analyst_id:
            case.assigned_analyst_id = user.id

        if payload.analyst_notes:
            case.analyst_notes = f"{case.analyst_notes or ''}\n{payload.analyst_notes}".strip()

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, "UNDER_REVIEW", user.id, "Analyst commenced supervisory review")
        cls._audit(db, user.id, "SUPERVISORY_CASE_REVIEW_STARTED", f"Analyst started review on {case.business_id}", case.id)
        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def submit_case_recommendation(cls, db: Session, case_id: uuid.UUID, payload: CaseRecommendationRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        target_status = payload.target_status if payload.target_status in ["RECOMMENDATION_READY", "AUTHORITY_REVIEW"] else "RECOMMENDATION_READY"
        SupervisionWorkflowEngine.validate_case_transition(case.status, target_status)

        prev_status = case.status
        case.status = target_status
        case.recommendation = payload.recommendation
        case.recommendation_submitted_at = datetime.now(timezone.utc)
        if payload.analyst_notes:
            case.analyst_notes = f"{case.analyst_notes or ''}\n{payload.analyst_notes}".strip()

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, target_status, user.id, f"Recommendation submitted: {payload.recommendation[:100]}")
        cls._audit(db, user.id, "SUPERVISORY_CASE_RECOMMENDATION_SUBMITTED", f"Submitted recommendation on {case.business_id}", case.id)

        # Notify authority
        if case.supervisory_authority_id:
            cls._notify(db, case.supervisory_authority_id, f"Recommendation Ready: {case.business_id}", f"Analyst submitted recommendation for {case.title}", f"/supervision/cases/{case.id}")

        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def request_case_review(cls, db: Session, case_id: uuid.UUID, payload: CaseRequestReviewRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_case_transition(case.status, "UNDER_REVIEW")
        prev_status = case.status
        case.status = "UNDER_REVIEW"
        case.analyst_notes = f"{case.analyst_notes or ''}\nAuthority Rework Request: {payload.comments}".strip()

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, "UNDER_REVIEW", user.id, f"Review requested: {payload.comments}")
        cls._audit(db, user.id, "SUPERVISORY_CASE_RETURNED_FOR_REVIEW", f"Authority returned case {case.business_id} for review", case.id)

        if case.assigned_analyst_id:
            cls._notify(db, case.assigned_analyst_id, f"Rework Requested on {case.business_id}", f"Authority requested review: {payload.comments[:100]}", f"/supervision/cases/{case.id}")

        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def record_case_decision(cls, db: Session, case_id: uuid.UUID, payload: CaseDecisionRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        # Enforce Separation of Duties
        SupervisionWorkflowEngine.validate_authority_decision_sod(user.id, case)

        if payload.decision_type not in SupervisionWorkflowEngine.VALID_DECISION_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid decision type: {payload.decision_type}")

        # Map decision to new status
        target_status = "MONITORING" if payload.decision_type == "CONTINUE_MONITORING" else \
                        "ACTION_REQUIRED" if payload.decision_type in ["REQUIRE_ACTION", "ESCALATE"] else \
                        "CLOSED" if payload.decision_type in ["CLOSE", "ACCEPT_RISK"] else \
                        "UNDER_REVIEW" if payload.decision_type == "REQUEST_REVIEW" else "ACTION_REQUIRED"

        SupervisionWorkflowEngine.validate_case_transition(case.status, target_status)
        prev_status = case.status
        case.status = target_status
        case.final_decision = payload.decision_type
        case.decision_reason = payload.rationale
        case.decided_by_id = user.id
        case.decided_at = datetime.now(timezone.utc)
        if target_status == "CLOSED":
            case.closed_at = datetime.now(timezone.utc)

        # Create SupervisoryDecision record
        year = datetime.now().year
        dec_count = db.query(SupervisoryDecision).count() + 1
        dec_bus_id = f"DEC-{year}-{dec_count:05d}"

        decision_record = SupervisoryDecision(
            business_id=dec_bus_id,
            supervisory_case_id=case.id,
            decision_type=payload.decision_type,
            status="APPROVED",
            decision_maker_id=user.id,
            rationale=payload.rationale,
            conditions=payload.conditions,
            action_required=payload.action_required,
            effective_date=payload.effective_date or datetime.now(timezone.utc),
            review_date=payload.review_date,
            organization_id=case.organization_id,
            sector_id=case.sector_id,
        )
        db.add(decision_record)

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, target_status, user.id, f"Final decision: {payload.decision_type}. {payload.rationale[:100]}")
        cls._audit(db, user.id, "SUPERVISORY_DECISION_RENDERED", f"Rendered decision {dec_bus_id} ({payload.decision_type}) for case {case.business_id}", case.id)

        if case.assigned_analyst_id:
            cls._notify(db, case.assigned_analyst_id, f"Decision Rendered: {case.business_id}", f"Authority decision: {payload.decision_type}", f"/supervision/cases/{case.id}")

        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def close_case(cls, db: Session, case_id: uuid.UUID, payload: CaseCloseRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_case_transition(case.status, "CLOSED")
        prev_status = case.status
        case.status = "CLOSED"
        case.closed_at = datetime.now(timezone.utc)
        if payload.reason:
            case.decision_reason = f"{case.decision_reason or ''}\nClosure Note: {payload.reason}".strip()

        cls._record_transition(db, "SUPERVISORY_CASE", case.id, prev_status, "CLOSED", user.id, payload.reason or "Case formally closed")
        cls._audit(db, user.id, "SUPERVISORY_CASE_CLOSED", f"Closed supervisory case {case.business_id}", case.id)
        db.commit()
        db.refresh(case)
        return cls._serialize_case(case)

    @classmethod
    def create_supervisory_finding(cls, db: Session, case_id: uuid.UUID, payload: SupervisoryFindingCreate, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        year = datetime.now().year
        fnd_count = db.query(Finding).count() + 1
        fnd_bus_id = f"FND-{year}-{fnd_count:05d}"

        finding = Finding(
            business_id=fnd_bus_id,
            title=payload.title,
            description=payload.description,
            severity=payload.severity,
            priority=payload.priority,
            status="IDENTIFIED",
            classification=payload.classification,
            source_type="SUPERVISORY_REVIEW",
            source_id=case.id,
            cse_id=case.source_cse_id,
            assessment_id=case.source_assessment_id,
            organization_id=case.organization_id,
            sector_id=case.sector_id,
            created_by_id=user.id,
            due_date=payload.due_date,
            remediation_required=payload.remediation_required,
        )
        db.add(finding)
        db.flush()

        # Link finding as source_finding_id on case if not already present
        if not case.source_finding_id:
            case.source_finding_id = finding.id

        cls._audit(db, user.id, "SUPERVISORY_FINDING_CREATED", f"Created supervisory finding {fnd_bus_id} from case {case.business_id}", case.id)
        db.commit()
        db.refresh(finding)

        return {
            "id": str(finding.id),
            "business_id": finding.business_id,
            "title": finding.title,
            "severity": finding.severity,
            "status": finding.status,
            "source_type": finding.source_type,
            "remediation_required": finding.remediation_required
        }

    # ==================== ESCALATIONS ====================

    @classmethod
    def list_escalations(
        cls,
        db: Session,
        user: User,
        effective_scope: ScopeType,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        level: Optional[str] = None,
        resource_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        q = cls.apply_escalation_scope(db.query(Escalation), user, effective_scope)

        if status:
            q = q.filter(Escalation.status == status)
        if severity:
            q = q.filter(Escalation.severity == severity)
        if level:
            q = q.filter(Escalation.level == level)
        if resource_type:
            q = q.filter(Escalation.resource_type == resource_type)
        if search:
            pattern = f"%{search}%"
            q = q.filter(
                or_(
                    Escalation.business_id.ilike(pattern),
                    Escalation.reason.ilike(pattern),
                )
            )

        escalations = q.order_by(desc(Escalation.created_at)).offset(skip).limit(limit).all()
        return [cls._serialize_escalation(e) for e in escalations]

    @classmethod
    def get_escalation(cls, db: Session, escalation_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")
        if not check_resource_scope(user, effective_scope, esc):
            raise HTTPException(status_code=403, detail="Access denied by scope")
        return cls._serialize_escalation(esc)

    @classmethod
    def create_escalation(cls, db: Session, payload: EscalationCreate, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        year = datetime.now().year
        count = db.query(Escalation).count() + 1
        bus_id = f"ESC-{year}-{count:05d}"

        # Resolve org/sector from source resource if not provided
        org_id = payload.organization_id
        sec_id = payload.sector_id

        source_cse_id = None
        source_finding_id = None
        source_risk_id = None
        source_remediation_id = None
        source_assessment_id = None

        if payload.resource_type == "CSE":
            cse = db.query(CSE).filter(CSE.id == payload.resource_id).first()
            if cse:
                org_id = org_id or cse.organization_id
                sec_id = sec_id or cse.sector_id
                source_cse_id = cse.id
        elif payload.resource_type == "FINDING":
            fnd = db.query(Finding).filter(Finding.id == payload.resource_id).first()
            if fnd:
                org_id = org_id or fnd.organization_id
                sec_id = sec_id or fnd.sector_id
                source_finding_id = fnd.id
                source_cse_id = fnd.cse_id
        elif payload.resource_type == "RISK":
            rsk = db.query(Risk).filter(Risk.id == payload.resource_id).first()
            if rsk:
                org_id = org_id or rsk.organization_id
                sec_id = sec_id or rsk.sector_id
                source_risk_id = rsk.id
                source_finding_id = rsk.finding_id
        elif payload.resource_type == "REMEDIATION":
            rem = db.query(Remediation).filter(Remediation.id == payload.resource_id).first()
            if rem:
                org_id = org_id or rem.organization_id
                sec_id = sec_id or rem.sector_id
                source_remediation_id = rem.id
                source_finding_id = rem.finding_id
                source_risk_id = rem.risk_id

        # Determine supervisory case
        sup_case_id = payload.supervisory_case_id
        if not sup_case_id:
            case_count = db.query(SupervisoryCase).count() + 1
            case_bus_id = f"SUP-{year}-{case_count:05d}"
            sup_case = SupervisoryCase(
                business_id=case_bus_id,
                title=f"Escalation Case: {payload.resource_type} - {payload.reason[:60]}",
                description=payload.reason,
                priority=payload.priority,
                status="OPEN",
                trigger_type="MANUAL_ESCALATION",
                organization_id=org_id,
                sector_id=sec_id,
                created_by_id=user.id,
                due_date=payload.due_date,
                source_cse_id=source_cse_id,
                source_finding_id=source_finding_id,
                source_risk_id=source_risk_id,
                source_remediation_id=source_remediation_id,
                source_assessment_id=source_assessment_id,
            )
            db.add(sup_case)
            db.flush()
            sup_case_id = sup_case.id

        escalation = Escalation(
            business_id=bus_id,
            resource_type=payload.resource_type,
            resource_id=payload.resource_id,
            reason=payload.reason,
            severity=payload.severity,
            priority=payload.priority,
            level=payload.level,
            status="OPEN",
            escalated_by_id=user.id,
            escalated_to_id=payload.escalated_to_id,
            organization_id=org_id,
            sector_id=sec_id,
            due_date=payload.due_date,
            supervisory_case_id=sup_case_id,
        )
        db.add(escalation)
        db.flush()

        cls._record_transition(db, "ESCALATION", escalation.id, "NONE", "OPEN", user.id, "Escalation created")
        cls._audit(db, user.id, "ESCALATION_CREATED", f"Created escalation {bus_id} ({payload.resource_type})", escalation.id)

        # Notify supervisory authority
        sup_auth = db.query(User).filter(User.email == "supervision.auth@sat-sa.local").first()
        if sup_auth:
            cls._notify(db, sup_auth.id, f"New Escalation: {bus_id}", f"New {payload.level} escalation: {payload.reason[:100]}", f"/supervision/escalations")

        db.commit()
        db.refresh(escalation)
        return cls._serialize_escalation(escalation)

    @classmethod
    def acknowledge_escalation(cls, db: Session, escalation_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")
        if not check_resource_scope(user, effective_scope, esc):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_escalation_transition(esc.status, "ACKNOWLEDGED")
        prev_status = esc.status
        esc.status = "ACKNOWLEDGED"
        if not esc.escalated_to_id:
            esc.escalated_to_id = user.id

        cls._record_transition(db, "ESCALATION", esc.id, prev_status, "ACKNOWLEDGED", user.id, "Escalation acknowledged")
        cls._audit(db, user.id, "ESCALATION_ACKNOWLEDGED", f"Acknowledged escalation {esc.business_id}", esc.id)
        db.commit()
        db.refresh(esc)
        return cls._serialize_escalation(esc)

    @classmethod
    def assign_escalation(cls, db: Session, escalation_id: uuid.UUID, payload: EscalationAssignRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")
        if not check_resource_scope(user, effective_scope, esc):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        esc.escalated_to_id = payload.assigned_to_id
        if esc.status == "OPEN":
            esc.status = "IN_REVIEW"

        cls._audit(db, user.id, "ESCALATION_ASSIGNED", f"Assigned escalation {esc.business_id}", esc.id)
        cls._notify(db, payload.assigned_to_id, f"Assigned Escalation {esc.business_id}", f"Assigned escalation: {esc.reason[:100]}", "/supervision/escalations")
        db.commit()
        db.refresh(esc)
        return cls._serialize_escalation(esc)

    @classmethod
    def resolve_escalation(cls, db: Session, escalation_id: uuid.UUID, payload: EscalationResolveRequest, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")
        if not check_resource_scope(user, effective_scope, esc):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_escalation_transition(esc.status, "RESOLVED")
        prev_status = esc.status
        esc.status = "RESOLVED"
        esc.resolution = payload.resolution
        esc.resolved_at = datetime.now(timezone.utc)

        cls._record_transition(db, "ESCALATION", esc.id, prev_status, "RESOLVED", user.id, payload.resolution)
        cls._audit(db, user.id, "ESCALATION_RESOLVED", f"Resolved escalation {esc.business_id}: {payload.resolution[:100]}", esc.id)
        db.commit()
        db.refresh(esc)
        return cls._serialize_escalation(esc)

    @classmethod
    def close_escalation(cls, db: Session, escalation_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")
        if not check_resource_scope(user, effective_scope, esc):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        SupervisionWorkflowEngine.validate_escalation_transition(esc.status, "CLOSED")
        prev_status = esc.status
        esc.status = "CLOSED"

        cls._record_transition(db, "ESCALATION", esc.id, prev_status, "CLOSED", user.id, "Escalation closed")
        cls._audit(db, user.id, "ESCALATION_CLOSED", f"Closed escalation {esc.business_id}", esc.id)
        db.commit()
        db.refresh(esc)
        return cls._serialize_escalation(esc)

    # ==================== DECISIONS ====================

    @classmethod
    def list_decisions(
        cls,
        db: Session,
        user: User,
        effective_scope: ScopeType,
        status: Optional[str] = None,
        decision_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        q = cls.apply_decision_scope(db.query(SupervisoryDecision), user, effective_scope)

        if status:
            q = q.filter(SupervisoryDecision.status == status)
        if decision_type:
            q = q.filter(SupervisoryDecision.decision_type == decision_type)

        decisions = q.order_by(desc(SupervisoryDecision.created_at)).offset(skip).limit(limit).all()
        return [cls._serialize_decision(d) for d in decisions]

    @classmethod
    def get_decision(cls, db: Session, decision_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        dec = db.query(SupervisoryDecision).filter(SupervisoryDecision.id == decision_id).first()
        if not dec:
            raise HTTPException(status_code=404, detail="Supervisory decision not found")
        if not check_resource_scope(user, effective_scope, dec):
            raise HTTPException(status_code=403, detail="Access denied by scope")
        return cls._serialize_decision(dec)

    @classmethod
    def approve_decision(cls, db: Session, decision_id: uuid.UUID, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        dec = db.query(SupervisoryDecision).filter(SupervisoryDecision.id == decision_id).first()
        if not dec:
            raise HTTPException(status_code=404, detail="Supervisory decision not found")
        if not check_resource_scope(user, effective_scope, dec):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        dec.status = "APPROVED"
        cls._audit(db, user.id, "SUPERVISORY_DECISION_APPROVED", f"Approved supervisory decision {dec.business_id}", dec.id)
        db.commit()
        db.refresh(dec)
        return cls._serialize_decision(dec)

    # ==================== TIMELINE ====================

    @classmethod
    def get_case_timeline(cls, db: Session, case_id: uuid.UUID, user: User, effective_scope: ScopeType) -> List[Dict[str, Any]]:
        case = db.query(SupervisoryCase).filter(SupervisoryCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Supervisory case not found")
        if not check_resource_scope(user, effective_scope, case):
            raise HTTPException(status_code=403, detail="Access denied by scope")

        transitions = db.query(WorkflowTransition).filter(
            WorkflowTransition.resource_type.in_(["SUPERVISORY_CASE", "ESCALATION"]),
            WorkflowTransition.resource_id == case_id
        ).order_by(WorkflowTransition.created_at.desc()).all()

        timeline = []
        for t in transitions:
            actor = db.query(User).filter(User.id == t.actor_id).first()
            timeline.append({
                "id": str(t.id),
                "type": "TRANSITION",
                "from_state": t.from_state,
                "to_state": t.to_state,
                "actor_name": f"{actor.first_name} {actor.last_name}" if actor else "System",
                "reason": t.reason,
                "timestamp": t.created_at.isoformat() if t.created_at else None,
            })

        audits = db.query(AuditLog).filter(
            AuditLog.resource_id == case_id
        ).order_by(AuditLog.created_at.desc()).all()

        for a in audits:
            actor = db.query(User).filter(User.id == a.actor_user_id).first() if a.actor_user_id else None
            details_str = a.new_value.get("details") if isinstance(a.new_value, dict) else str(a.new_value or "")
            timeline.append({
                "id": str(a.id),
                "type": "AUDIT",
                "action": a.action,
                "description": details_str,
                "actor_name": f"{actor.first_name} {actor.last_name}" if actor else "System",
                "timestamp": a.created_at.isoformat() if a.created_at else None,
            })

        # Sort combined timeline by timestamp descending
        timeline.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        return timeline

    # ==================== SERIALIZERS ====================

    @classmethod
    def _serialize_case(cls, c: SupervisoryCase) -> Dict[str, Any]:
        return {
            "id": str(c.id),
            "business_id": c.business_id,
            "title": c.title,
            "description": c.description,
            "priority": c.priority,
            "status": c.status,
            "trigger_type": c.trigger_type,
            "organization_id": str(c.organization_id) if c.organization_id else None,
            "sector_id": str(c.sector_id) if c.sector_id else None,
            "created_by_id": str(c.created_by_id) if c.created_by_id else None,
            "assigned_analyst_id": str(c.assigned_analyst_id) if c.assigned_analyst_id else None,
            "supervisory_authority_id": str(c.supervisory_authority_id) if c.supervisory_authority_id else None,
            "decided_by_id": str(c.decided_by_id) if c.decided_by_id else None,
            "source_cse_id": str(c.source_cse_id) if c.source_cse_id else None,
            "source_finding_id": str(c.source_finding_id) if c.source_finding_id else None,
            "source_risk_id": str(c.source_risk_id) if c.source_risk_id else None,
            "source_remediation_id": str(c.source_remediation_id) if c.source_remediation_id else None,
            "source_assessment_id": str(c.source_assessment_id) if c.source_assessment_id else None,
            "analyst_notes": c.analyst_notes,
            "recommendation": c.recommendation,
            "recommendation_submitted_at": c.recommendation_submitted_at.isoformat() if c.recommendation_submitted_at else None,
            "final_decision": c.final_decision,
            "decision_reason": c.decision_reason,
            "decided_at": c.decided_at.isoformat() if c.decided_at else None,
            "due_date": c.due_date.isoformat() if c.due_date else None,
            "closed_at": c.closed_at.isoformat() if c.closed_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "organization_name": c.organization.name if c.organization else None,
            "sector_name": c.sector.name if c.sector else None,
            "assigned_analyst_name": f"{c.assigned_analyst.first_name} {c.assigned_analyst.last_name}" if c.assigned_analyst else None,
            "supervisory_authority_name": f"{c.supervisory_authority.first_name} {c.supervisory_authority.last_name}" if c.supervisory_authority else None,
            "decided_by_name": f"{c.decided_by.first_name} {c.decided_by.last_name}" if c.decided_by else None,
            "created_by_name": f"{c.created_by.first_name} {c.created_by.last_name}" if c.created_by else None,
            "source_cse_business_id": c.source_cse.business_id if c.source_cse else None,
            "source_finding_business_id": c.source_finding.business_id if c.source_finding else None,
            "source_risk_business_id": c.source_risk.business_id if c.source_risk else None,
            "source_remediation_business_id": c.source_remediation.business_id if c.source_remediation else None,
        }

    @classmethod
    def _serialize_escalation(cls, e: Escalation) -> Dict[str, Any]:
        return {
            "id": str(e.id),
            "business_id": e.business_id,
            "resource_type": e.resource_type,
            "resource_id": str(e.resource_id),
            "reason": e.reason,
            "severity": e.severity,
            "priority": e.priority,
            "status": e.status,
            "level": e.level,
            "escalated_by_id": str(e.escalated_by_id),
            "escalated_to_id": str(e.escalated_to_id) if e.escalated_to_id else None,
            "organization_id": str(e.organization_id) if e.organization_id else None,
            "sector_id": str(e.sector_id) if e.sector_id else None,
            "supervisory_case_id": str(e.supervisory_case_id) if e.supervisory_case_id else None,
            "due_date": e.due_date.isoformat() if e.due_date else None,
            "resolution": e.resolution,
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
            "escalated_by_name": f"{e.escalated_by.first_name} {e.escalated_by.last_name}" if e.escalated_by else None,
            "escalated_to_name": f"{e.escalated_to.first_name} {e.escalated_to.last_name}" if e.escalated_to else None,
            "organization_name": e.organization.name if e.organization else None,
            "sector_name": e.sector.name if e.sector else None,
            "supervisory_case_business_id": e.supervisory_case.business_id if e.supervisory_case else None,
        }

    @classmethod
    def _serialize_decision(cls, d: SupervisoryDecision) -> Dict[str, Any]:
        return {
            "id": str(d.id),
            "business_id": d.business_id,
            "supervisory_case_id": str(d.supervisory_case_id),
            "decision_type": d.decision_type,
            "status": d.status,
            "decision_maker_id": str(d.decision_maker_id),
            "rationale": d.rationale,
            "conditions": d.conditions,
            "action_required": d.action_required,
            "effective_date": d.effective_date.isoformat() if d.effective_date else None,
            "review_date": d.review_date.isoformat() if d.review_date else None,
            "organization_id": str(d.organization_id) if d.organization_id else None,
            "sector_id": str(d.sector_id) if d.sector_id else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "decision_maker_name": f"{d.decision_maker.first_name} {d.decision_maker.last_name}" if d.decision_maker else None,
            "supervisory_case_business_id": d.supervisory_case.business_id if d.supervisory_case else None,
            "supervisory_case_title": d.supervisory_case.title if d.supervisory_case else None,
        }

    @staticmethod
    def _record_transition(db: Session, resource_type: str, resource_id: uuid.UUID, from_state: str, to_state: str, actor_id: uuid.UUID, reason: Optional[str] = None):
        t = WorkflowTransition(
            resource_type=resource_type,
            resource_id=resource_id,
            from_state=from_state,
            to_state=to_state,
            actor_id=actor_id,
            reason=reason
        )
        db.add(t)

    @staticmethod
    def _audit(db: Session, user_id: uuid.UUID, action: str, details: str, resource_id: Optional[uuid.UUID] = None, resource_type: str = "SUPERVISORY_CASE"):
        log = AuditLog(
            actor_user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            new_value={"details": details}
        )
        db.add(log)

    @staticmethod
    def _notify(db: Session, recipient_id: uuid.UUID, title: str, message: str, link: Optional[str] = None):
        notif = Notification(
            recipient_id=recipient_id,
            type="SUPERVISION",
            title=title,
            message=message
        )
        db.add(notif)
