from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, desc
from datetime import datetime, timezone
import uuid
from fastapi import HTTPException, status

from app.models.risk import Risk, RiskTreatment, RiskException
from app.models.finding import Finding
from app.models.assessment import Assessment
from app.models.control import Control
from app.models.security import CSE
from app.models.identity import User
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.workflow import WorkflowTransition
from app.rbac.scopes import ScopeType
from app.risks.scoring_engine import calculate_risk_score
from app.risks.workflow_engine import (
    RiskWorkflowEngine,
    RiskStatus,
    RiskExceptionStatus,
)
from app.risks.schemas import (
    RiskCreate,
    RiskUpdate,
    InherentAssessmentPayload,
    ResidualAssessmentPayload,
    RiskTreatmentDecisionPayload,
    RiskAcceptancePayload,
    RiskTreatmentCreate,
    RiskTreatmentUpdate,
    RiskExceptionCreate,
    RiskExceptionDecision,
)


class RisksService:
    @staticmethod
    def _generate_risk_business_id(db: Session) -> str:
        count = db.query(func.count(Risk.id)).scalar() or 0
        year = datetime.now(timezone.utc).year
        return f"RSK-{year}-{(count + 1):05d}"

    @staticmethod
    def _generate_treatment_business_id(db: Session) -> str:
        count = db.query(func.count(RiskTreatment.id)).scalar() or 0
        year = datetime.now(timezone.utc).year
        return f"TRT-{year}-{(count + 1):05d}"

    @staticmethod
    def _generate_exception_business_id(db: Session) -> str:
        count = db.query(func.count(RiskException.id)).scalar() or 0
        year = datetime.now(timezone.utc).year
        return f"EXP-{year}-{(count + 1):05d}"

    @staticmethod
    def _create_audit(
        db: Session,
        actor: User,
        action: str,
        resource_id: uuid.UUID,
        old_val: Optional[Dict[str, Any]] = None,
        new_val: Optional[Dict[str, Any]] = None
    ) -> None:
        log = AuditLog(
            actor_user_id=actor.id,
            action=action,
            resource_type="Risk",
            resource_id=resource_id,
            old_value=old_val,
            new_value=new_val
        )
        db.add(log)

    @staticmethod
    def _create_notification(
        db: Session,
        recipient_id: Optional[uuid.UUID],
        title: str,
        message: str
    ) -> None:
        if not recipient_id:
            return
        notif = Notification(
            recipient_id=recipient_id,
            type="ALERT",
            title=title,
            message=message
        )
        db.add(notif)

    @staticmethod
    def _apply_scope_filter(query, user: User, effective_scope: ScopeType):
        if effective_scope == ScopeType.ENTERPRISE:
            return query
        elif effective_scope == ScopeType.SECTOR:
            if not user.sector_id:
                return query.filter(Risk.id == None)
            return query.filter(Risk.sector_id == user.sector_id)
        elif effective_scope == ScopeType.ORGANIZATION:
            if not user.organization_id:
                return query.filter(Risk.id == None)
            return query.filter(Risk.organization_id == user.organization_id)
        elif effective_scope == ScopeType.ASSIGNED:
            return query.filter(
                or_(
                    Risk.owner_id == user.id,
                    Risk.identified_by_id == user.id,
                    Risk.treatment_owner_id == user.id
                )
            )
        return query.filter(Risk.id == None)

    @staticmethod
    def get_risks(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        status: Optional[str] = None,
        category: Optional[str] = None,
        level: Optional[str] = None,
        source: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Risk]:
        query = db.query(Risk).options(
            joinedload(Risk.finding),
            joinedload(Risk.assessment),
            joinedload(Risk.control),
            joinedload(Risk.cse),
            joinedload(Risk.organization),
            joinedload(Risk.sector),
            joinedload(Risk.owner),
            joinedload(Risk.identified_by),
            joinedload(Risk.accepted_by),
            joinedload(Risk.treatment_owner),
            joinedload(Risk.treatments),
            joinedload(Risk.exceptions)
        )

        query = RisksService._apply_scope_filter(query, user, effective_scope)

        if status:
            query = query.filter(Risk.status == status.upper())
        if category:
            query = query.filter(Risk.category.ilike(f"%{category}%"))
        if level:
            query = query.filter(
                or_(
                    Risk.inherent_risk_level == level.upper(),
                    Risk.residual_risk_level == level.upper()
                )
            )
        if source:
            query = query.filter(Risk.source == source.upper())
        if organization_id:
            query = query.filter(Risk.organization_id == organization_id)
        if search:
            s = f"%{search}%"
            query = query.filter(
                or_(
                    Risk.title.ilike(s),
                    Risk.business_id.ilike(s),
                    Risk.description.ilike(s),
                    Risk.source_reference.ilike(s),
                    Risk.asset_or_system.ilike(s)
                )
            )

        return query.order_by(desc(Risk.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def get_risk_by_id(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID
    ) -> Risk:
        query = db.query(Risk).options(
            joinedload(Risk.finding),
            joinedload(Risk.assessment),
            joinedload(Risk.control),
            joinedload(Risk.cse),
            joinedload(Risk.organization),
            joinedload(Risk.sector),
            joinedload(Risk.owner),
            joinedload(Risk.identified_by),
            joinedload(Risk.accepted_by),
            joinedload(Risk.treatment_owner),
            joinedload(Risk.treatments).joinedload(RiskTreatment.owner),
            joinedload(Risk.treatments).joinedload(RiskTreatment.created_by),
            joinedload(Risk.exceptions).joinedload(RiskException.requested_by),
            joinedload(Risk.exceptions).joinedload(RiskException.owner),
            joinedload(Risk.exceptions).joinedload(RiskException.approved_by)
        ).filter(Risk.id == risk_id)

        query = RisksService._apply_scope_filter(query, user, effective_scope)
        risk = query.first()
        if not risk:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Risk with id '{risk_id}' not found or access denied."
            )
        return risk

    @staticmethod
    def get_stats(db: Session, user: User, effective_scope: ScopeType) -> Dict[str, Any]:
        query = db.query(Risk)
        query = RisksService._apply_scope_filter(query, user, effective_scope)
        risks = query.all()

        now = datetime.now(timezone.utc)
        stats = {
            "total_risks": len(risks),
            "critical": sum(1 for r in risks if (r.residual_risk_level or r.inherent_risk_level) == "CRITICAL"),
            "high": sum(1 for r in risks if (r.residual_risk_level or r.inherent_risk_level) == "HIGH"),
            "medium": sum(1 for r in risks if (r.residual_risk_level or r.inherent_risk_level) == "MEDIUM"),
            "low": sum(1 for r in risks if (r.residual_risk_level or r.inherent_risk_level) == "LOW"),
            "treatment_required": sum(1 for r in risks if r.status in ["TREATMENT_REQUIRED", "TREATMENT_PLANNED"]),
            "accepted": sum(1 for r in risks if r.status == "ACCEPTED"),
            "overdue": sum(1 for r in risks if r.target_date and r.target_date < now and r.status != "CLOSED"),
            "open_exceptions": 0,
            "matrix_distribution": {}
        }

        # Calculate 5x5 matrix distribution
        for r in risks:
            key = f"{r.likelihood},{r.impact}"
            stats["matrix_distribution"][key] = stats["matrix_distribution"].get(key, 0) + 1

        # Count open exceptions
        exc_query = db.query(RiskException).filter(RiskException.status.in_(["REQUESTED", "UNDER_REVIEW"]))
        stats["open_exceptions"] = exc_query.count()

        return stats

    @staticmethod
    def create_risk(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        payload: RiskCreate
    ) -> Risk:
        # Validate scope
        org_id = payload.organization_id or user.organization_id
        sec_id = payload.sector_id or user.sector_id

        if effective_scope == ScopeType.ORGANIZATION and org_id != user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot create risk outside your assigned organization.")
        if effective_scope == ScopeType.SECTOR and sec_id != user.sector_id:
            raise HTTPException(status_code=403, detail="Cannot create risk outside your assigned sector.")

        # Compute inherent score and level server-side
        inherent_score, inherent_level = calculate_risk_score(payload.likelihood, payload.impact)

        business_id = RisksService._generate_risk_business_id(db)

        # Pre-fill source reference if linked
        source_ref = payload.source_reference
        if payload.finding_id and not source_ref:
            f = db.query(Finding).filter(Finding.id == payload.finding_id).first()
            if f:
                source_ref = f.business_id
        elif payload.assessment_id and not source_ref:
            a = db.query(Assessment).filter(Assessment.id == payload.assessment_id).first()
            if a:
                source_ref = a.business_id
        elif payload.cse_id and not source_ref:
            c = db.query(CSE).filter(CSE.id == payload.cse_id).first()
            if c:
                source_ref = c.business_id
        elif payload.control_id and not source_ref:
            ctrl = db.query(Control).filter(Control.id == payload.control_id).first()
            if ctrl:
                source_ref = ctrl.business_id

        # Determine initial status
        initial_status = RiskStatus.ASSESSED if payload.likelihood and payload.impact else RiskStatus.IDENTIFIED

        risk = Risk(
            business_id=business_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            source=payload.source,
            source_reference=source_ref,
            source_id=payload.source_id,
            finding_id=payload.finding_id,
            assessment_id=payload.assessment_id,
            control_id=payload.control_id,
            cse_id=payload.cse_id,
            organization_id=org_id,
            sector_id=sec_id,
            asset_or_system=payload.asset_or_system,
            owner_id=payload.owner_id,
            identified_by_id=user.id,
            likelihood=payload.likelihood,
            impact=payload.impact,
            inherent_score=inherent_score,
            inherent_risk_level=inherent_level,
            existing_controls_description=payload.existing_controls_description,
            status=initial_status,
            target_date=payload.target_date
        )

        db.add(risk)
        db.flush()

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_CREATED",
            resource_id=risk.id,
            new_val={
                "business_id": risk.business_id,
                "title": risk.title,
                "inherent_score": inherent_score,
                "inherent_level": inherent_level,
                "status": risk.status
            }
        )

        if payload.owner_id:
            RisksService._create_notification(
                db=db,
                recipient_id=payload.owner_id,
                title="Risk Assigned",
                message=f"You have been assigned as the risk owner for {risk.business_id}: {risk.title}."
            )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def update_risk(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        payload: RiskUpdate
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)

        old_val = {"title": risk.title, "category": risk.category, "owner_id": str(risk.owner_id) if risk.owner_id else None}

        if payload.title is not None:
            risk.title = payload.title
        if payload.description is not None:
            risk.description = payload.description
        if payload.category is not None:
            risk.category = payload.category
        if payload.asset_or_system is not None:
            risk.asset_or_system = payload.asset_or_system
        if payload.owner_id is not None:
            risk.owner_id = payload.owner_id
        if payload.existing_controls_description is not None:
            risk.existing_controls_description = payload.existing_controls_description
        if payload.target_date is not None:
            risk.target_date = payload.target_date
        if payload.review_date is not None:
            risk.review_date = payload.review_date

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_UPDATED",
            resource_id=risk.id,
            old_val=old_val,
            new_val={"title": risk.title, "category": risk.category, "owner_id": str(risk.owner_id) if risk.owner_id else None}
        )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def assess_inherent(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        payload: InherentAssessmentPayload
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)

        score, level = calculate_risk_score(payload.likelihood, payload.impact)
        old_val = {"likelihood": risk.likelihood, "impact": risk.impact, "score": risk.inherent_score, "level": risk.inherent_risk_level}

        risk.likelihood = payload.likelihood
        risk.impact = payload.impact
        risk.inherent_score = score
        risk.inherent_risk_level = level

        if risk.status == RiskStatus.IDENTIFIED:
            risk.status = RiskStatus.ASSESSED

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_INHERENT_ASSESSED",
            resource_id=risk.id,
            old_val=old_val,
            new_val={"likelihood": payload.likelihood, "impact": payload.impact, "score": score, "level": level}
        )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def assess_residual(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        payload: ResidualAssessmentPayload
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)

        score, level = calculate_risk_score(payload.residual_likelihood, payload.residual_impact)
        old_val = {
            "residual_likelihood": risk.residual_likelihood,
            "residual_impact": risk.residual_impact,
            "residual_score": risk.residual_score,
            "residual_level": risk.residual_risk_level
        }

        risk.residual_likelihood = payload.residual_likelihood
        risk.residual_impact = payload.residual_impact
        risk.residual_score = score
        risk.residual_risk_level = level
        if payload.existing_controls_description is not None:
            risk.existing_controls_description = payload.existing_controls_description

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_RESIDUAL_ASSESSED",
            resource_id=risk.id,
            old_val=old_val,
            new_val={"residual_likelihood": payload.residual_likelihood, "residual_impact": payload.residual_impact, "residual_score": score, "residual_level": level}
        )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def decide_treatment(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        payload: RiskTreatmentDecisionPayload
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)

        strat = payload.strategy.upper()
        if strat not in ["MITIGATE", "ACCEPT", "TRANSFER", "AVOID"]:
            raise HTTPException(status_code=400, detail="Strategy must be one of: MITIGATE, ACCEPT, TRANSFER, AVOID.")

        risk.treatment_strategy = strat
        if payload.treatment_owner_id:
            risk.treatment_owner_id = payload.treatment_owner_id
        if payload.target_date:
            risk.treatment_target_date = payload.target_date
            risk.target_date = payload.target_date
        if payload.treatment_description:
            risk.treatment_description = payload.treatment_description

        # Create child treatment record
        trt_bid = RisksService._generate_treatment_business_id(db)
        treatment = RiskTreatment(
            business_id=trt_bid,
            risk_id=risk.id,
            title=f"Treatment Plan for {risk.business_id}",
            description=payload.treatment_description or f"Treatment strategy {strat} formulated for {risk.title}",
            strategy=strat,
            status="PLANNED",
            mitigation_actions=payload.mitigation_actions,
            transfer_details=payload.transfer_details,
            avoidance_details=payload.avoidance_details,
            owner_id=payload.treatment_owner_id or risk.owner_id,
            created_by_id=user.id,
            target_date=payload.target_date
        )
        db.add(treatment)

        if risk.status in [RiskStatus.IDENTIFIED, RiskStatus.ASSESSED]:
            risk.status = RiskStatus.TREATMENT_PLANNED

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_TREATMENT_DECIDED",
            resource_id=risk.id,
            new_val={"strategy": strat, "treatment_id": trt_bid}
        )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def accept_risk(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        payload: RiskAcceptancePayload
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)

        # Separation of Duties check
        RiskWorkflowEngine.validate_risk_acceptance_sod(
            actor_id=user.id,
            identified_by_id=risk.identified_by_id,
            owner_id=risk.owner_id
        )

        old_state = risk.status
        RiskWorkflowEngine.validate_risk_transition(old_state, RiskStatus.ACCEPTED)

        now = datetime.now(timezone.utc)
        risk.status = RiskStatus.ACCEPTED
        risk.treatment_strategy = "ACCEPT"
        risk.acceptance_justification = payload.acceptance_justification
        risk.accepted_by_id = user.id
        risk.accepted_at = now
        if payload.review_date:
            risk.review_date = payload.review_date

        # Log transition
        trans = WorkflowTransition(
            resource_type="Risk",
            resource_id=risk.id,
            from_state=old_state,
            to_state=RiskStatus.ACCEPTED,
            actor_id=user.id,
            reason=f"Risk accepted: {payload.acceptance_justification}"
        )
        db.add(trans)

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_ACCEPTED",
            resource_id=risk.id,
            new_val={"justification": payload.acceptance_justification, "accepted_by": str(user.id)}
        )

        if risk.owner_id and risk.owner_id != user.id:
            RisksService._create_notification(
                db=db,
                recipient_id=risk.owner_id,
                title="Risk Accepted",
                message=f"Risk {risk.business_id} has been formally accepted by supervisory authority."
            )

        db.commit()
        db.refresh(risk)
        return risk

    @staticmethod
    def transition_risk(
        db: Session,
        user: User,
        effective_scope: ScopeType,
        risk_id: uuid.UUID,
        target_state: str,
        reason: Optional[str] = None
    ) -> Risk:
        risk = RisksService.get_risk_by_id(db, user, effective_scope, risk_id)
        target = target_state.upper()

        if target == RiskStatus.ACCEPTED:
            # Must use accept_risk endpoint with justification and SoD
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Risk acceptance requires formal justification via /accept endpoint with Separation of Duties verification."
            )

        RiskWorkflowEngine.validate_risk_transition(risk.status, target)

        old_state = risk.status
        risk.status = target

        trans = WorkflowTransition(
            resource_type="Risk",
            resource_id=risk.id,
            from_state=old_state,
            to_state=target,
            actor_id=user.id,
            reason=reason or f"Transitioned from {old_state} to {target}"
        )
        db.add(trans)

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_STATUS_CHANGED",
            resource_id=risk.id,
            old_val={"status": old_state},
            new_val={"status": target, "reason": reason}
        )

        db.commit()
        db.refresh(risk)
        return risk

    # ----------------------------------------------------
    # Risk Treatments CRUD
    # ----------------------------------------------------
    @staticmethod
    def create_treatment(
        db: Session,
        user: User,
        risk_id: uuid.UUID,
        payload: RiskTreatmentCreate
    ) -> RiskTreatment:
        risk = db.query(Risk).filter(Risk.id == risk_id).first()
        if not risk:
            raise HTTPException(status_code=404, detail="Risk not found.")

        bid = RisksService._generate_treatment_business_id(db)
        treatment = RiskTreatment(
            business_id=bid,
            risk_id=risk.id,
            title=payload.title,
            description=payload.description,
            strategy=payload.strategy.upper(),
            mitigation_actions=payload.mitigation_actions,
            transfer_details=payload.transfer_details,
            avoidance_details=payload.avoidance_details,
            justification=payload.justification,
            owner_id=payload.owner_id or risk.owner_id,
            created_by_id=user.id,
            target_date=payload.target_date,
            status="PLANNED"
        )
        db.add(treatment)

        if risk.status in [RiskStatus.IDENTIFIED, RiskStatus.ASSESSED]:
            risk.status = RiskStatus.TREATMENT_PLANNED

        db.commit()
        db.refresh(treatment)
        return treatment

    @staticmethod
    def get_treatments(
        db: Session,
        risk_id: Optional[uuid.UUID] = None,
        strategy: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[RiskTreatment]:
        query = db.query(RiskTreatment).options(
            joinedload(RiskTreatment.owner),
            joinedload(RiskTreatment.created_by),
            joinedload(RiskTreatment.risk)
        )
        if risk_id:
            query = query.filter(RiskTreatment.risk_id == risk_id)
        if strategy:
            query = query.filter(RiskTreatment.strategy == strategy.upper())
        if status:
            query = query.filter(RiskTreatment.status == status.upper())
        return query.order_by(desc(RiskTreatment.created_at)).all()

    @staticmethod
    def update_treatment(
        db: Session,
        user: User,
        treatment_id: uuid.UUID,
        payload: RiskTreatmentUpdate
    ) -> RiskTreatment:
        t = db.query(RiskTreatment).filter(RiskTreatment.id == treatment_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Risk treatment not found.")

        old_val = {"status": t.status}
        if payload.status:
            t.status = payload.status.upper()
        if payload.mitigation_actions is not None:
            t.mitigation_actions = payload.mitigation_actions
        if payload.transfer_details is not None:
            t.transfer_details = payload.transfer_details
        if payload.avoidance_details is not None:
            t.avoidance_details = payload.avoidance_details
        if payload.target_date is not None:
            t.target_date = payload.target_date
        if payload.owner_id is not None:
            t.owner_id = payload.owner_id

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_TREATMENT_UPDATED",
            resource_id=t.risk_id,
            old_val=old_val,
            new_val={"treatment_id": t.business_id, "status": t.status}
        )

        db.commit()
        db.refresh(t)
        return t

    # ----------------------------------------------------
    # Risk Exceptions CRUD & Workflow
    # ----------------------------------------------------
    @staticmethod
    def create_exception(
        db: Session,
        user: User,
        risk_id: uuid.UUID,
        payload: RiskExceptionCreate
    ) -> RiskException:
        risk = db.query(Risk).filter(Risk.id == risk_id).first()
        if not risk:
            raise HTTPException(status_code=404, detail="Risk not found.")

        bid = RisksService._generate_exception_business_id(db)
        exception = RiskException(
            business_id=bid,
            risk_id=risk.id,
            title=payload.title,
            justification=payload.justification,
            requested_by_id=user.id,
            owner_id=payload.owner_id or risk.owner_id,
            start_date=payload.start_date or datetime.now(timezone.utc),
            expiry_date=payload.expiry_date,
            status=RiskExceptionStatus.REQUESTED
        )
        db.add(exception)

        RisksService._create_audit(
            db=db,
            actor=user,
            action="RISK_EXCEPTION_REQUESTED",
            resource_id=risk.id,
            new_val={"exception_id": bid, "title": payload.title}
        )

        db.commit()
        db.refresh(exception)
        return exception

    @staticmethod
    def get_exceptions(
        db: Session,
        risk_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None
    ) -> List[RiskException]:
        query = db.query(RiskException).options(
            joinedload(RiskException.requested_by),
            joinedload(RiskException.owner),
            joinedload(RiskException.approved_by),
            joinedload(RiskException.risk)
        )
        if risk_id:
            query = query.filter(RiskException.risk_id == risk_id)
        if status_filter:
            query = query.filter(RiskException.status == status_filter.upper())
        return query.order_by(desc(RiskException.created_at)).all()

    @staticmethod
    def decide_exception(
        db: Session,
        user: User,
        exception_id: uuid.UUID,
        decision: str,
        reviewer_comments: Optional[str] = None
    ) -> RiskException:
        exc = db.query(RiskException).filter(RiskException.id == exception_id).first()
        if not exc:
            raise HTTPException(status_code=404, detail="Risk exception not found.")

        target = decision.upper()
        if target not in ["APPROVED", "REJECTED"]:
            raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED.")

        # Separation of Duties
        RiskWorkflowEngine.validate_exception_approval_sod(
            actor_id=user.id,
            requested_by_id=exc.requested_by_id
        )

        RiskWorkflowEngine.validate_exception_transition(exc.status, target)

        now = datetime.now(timezone.utc)
        exc.status = target
        exc.approved_by_id = user.id
        exc.reviewed_at = now
        exc.reviewer_comments = reviewer_comments

        RisksService._create_audit(
            db=db,
            actor=user,
            action=f"RISK_EXCEPTION_{target}",
            resource_id=exc.risk_id,
            new_val={"exception_id": exc.business_id, "status": target, "comments": reviewer_comments}
        )

        if exc.requested_by_id and exc.requested_by_id != user.id:
            RisksService._create_notification(
                db=db,
                recipient_id=exc.requested_by_id,
                title=f"Risk Exception {target.capitalize()}",
                message=f"Your risk exception request {exc.business_id} ({exc.title}) was {target.lower()} by reviewer."
            )

        db.commit()
        db.refresh(exc)
        return exc

    # ----------------------------------------------------
    # Unified Timeline
    # ----------------------------------------------------
    @staticmethod
    def get_timeline(db: Session, risk_id: uuid.UUID) -> List[Dict[str, Any]]:
        events = []

        # 1. Audit logs
        logs = db.query(AuditLog).options(joinedload(AuditLog.actor_user)).filter(
            AuditLog.resource_id == risk_id
        ).all()
        for l in logs:
            events.append({
                "id": str(l.id),
                "risk_id": risk_id,
                "event_type": "AUDIT",
                "title": l.action.replace("_", " ").title(),
                "description": f"Audit record logged by {l.actor_user.first_name} {l.actor_user.last_name}" if l.actor_user else "System action",
                "actor_id": l.actor_user_id,
                "actor_name": f"{l.actor_user.first_name} {l.actor_user.last_name}" if l.actor_user else None,
                "created_at": l.created_at
            })

        # 2. Workflow transitions
        trans = db.query(WorkflowTransition).options(joinedload(WorkflowTransition.actor)).filter(
            WorkflowTransition.resource_type == "Risk",
            WorkflowTransition.resource_id == risk_id
        ).all()
        for t in trans:
            events.append({
                "id": str(t.id),
                "risk_id": risk_id,
                "event_type": "TRANSITION",
                "title": f"Lifecycle: {t.from_state} → {t.to_state}",
                "description": t.reason or f"Transitioned to {t.to_state}",
                "actor_id": t.actor_id,
                "actor_name": f"{t.actor.first_name} {t.actor.last_name}" if t.actor else None,
                "created_at": t.created_at
            })

        # 3. Exceptions
        excs = db.query(RiskException).options(joinedload(RiskException.requested_by)).filter(
            RiskException.risk_id == risk_id
        ).all()
        for e in excs:
            events.append({
                "id": str(e.id),
                "risk_id": risk_id,
                "event_type": "EXCEPTION",
                "title": f"Exception {e.status}: {e.business_id}",
                "description": f"{e.title} — {e.justification}",
                "actor_id": e.requested_by_id,
                "actor_name": f"{e.requested_by.first_name} {e.requested_by.last_name}" if e.requested_by else None,
                "created_at": e.created_at
            })

        events.sort(key=lambda x: x["created_at"], reverse=True)
        return events
