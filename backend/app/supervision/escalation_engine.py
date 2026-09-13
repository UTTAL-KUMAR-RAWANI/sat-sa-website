from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid
from sqlalchemy.orm import Session
from app.models.security import CSE
from app.models.finding import Finding
from app.models.risk import Risk
from app.models.remediation import Remediation
from app.models.workflow import Escalation
from app.models.supervision import SupervisoryCase
from app.models.identity import User
import logging

logger = logging.getLogger(__name__)

class EscalationEngine:
    """
    Centralized escalation rules and automated trigger detection.
    Scans for high-severity/unresolved events and creates Escalations & Supervisory Cases.
    """

    @classmethod
    def evaluate_automatic_triggers(cls, db: Session, triggering_user: Optional[User] = None) -> List[Dict[str, Any]]:
        created_escalations = []
        now = datetime.now(timezone.utc)

        # 1. Critical CSEs without active escalation
        critical_cses = db.query(CSE).filter(
            CSE.severity == "CRITICAL",
            CSE.status.in_(["NEW", "OPEN", "IN_PROGRESS", "ACTIVE", "CONFIRMED"])
        ).all()

        for cse in critical_cses:
            existing_esc = db.query(Escalation).filter(
                Escalation.resource_type == "CSE",
                Escalation.resource_id == cse.id,
                Escalation.status.in_(["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "ACTION_REQUIRED"])
            ).first()

            if not existing_esc:
                esc_record = cls._trigger_auto_escalation(
                    db=db,
                    resource_type="CSE",
                    resource_id=cse.id,
                    title=f"Critical CSE Escalation: {cse.title}",
                    reason=f"Automated trigger: Critical Cyber Security Event {cse.business_id} is active and requires supervisory review.",
                    severity="CRITICAL",
                    priority="CRITICAL",
                    level="LEVEL_3",
                    trigger_type="CRITICAL_CSE",
                    organization_id=cse.organization_id,
                    sector_id=cse.sector_id,
                    source_cse_id=cse.id,
                    triggering_user=triggering_user
                )
                if esc_record:
                    created_escalations.append(esc_record)

        # 2. Critical Risks without active escalation
        critical_risks = db.query(Risk).filter(
            Risk.inherent_risk_level == "CRITICAL",
            Risk.status.notin_(["CLOSED"])
        ).all()

        for risk in critical_risks:
            existing_esc = db.query(Escalation).filter(
                Escalation.resource_type == "RISK",
                Escalation.resource_id == risk.id,
                Escalation.status.in_(["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "ACTION_REQUIRED"])
            ).first()

            if not existing_esc:
                esc_record = cls._trigger_auto_escalation(
                    db=db,
                    resource_type="RISK",
                    resource_id=risk.id,
                    title=f"Critical Enterprise Risk Escalation: {risk.title}",
                    reason=f"Automated trigger: Critical Risk {risk.business_id} (Score {risk.inherent_score}/25) requires supervisory oversight.",
                    severity="CRITICAL",
                    priority="CRITICAL",
                    level="LEVEL_2",
                    trigger_type="CRITICAL_RISK",
                    organization_id=risk.organization_id,
                    sector_id=risk.sector_id,
                    source_risk_id=risk.id,
                    source_finding_id=risk.finding_id,
                    triggering_user=triggering_user
                )
                if esc_record:
                    created_escalations.append(esc_record)

        # 3. Overdue Critical Remediations
        overdue_remediations = db.query(Remediation).filter(
            Remediation.priority == "CRITICAL",
            Remediation.target_date < now,
            Remediation.status.notin_(["VERIFIED", "CLOSED"])
        ).all()

        for rem in overdue_remediations:
            existing_esc = db.query(Escalation).filter(
                Escalation.resource_type == "REMEDIATION",
                Escalation.resource_id == rem.id,
                Escalation.status.in_(["OPEN", "ACKNOWLEDGED", "IN_REVIEW", "ACTION_REQUIRED"])
            ).first()

            if not existing_esc:
                esc_record = cls._trigger_auto_escalation(
                    db=db,
                    resource_type="REMEDIATION",
                    resource_id=rem.id,
                    title=f"Overdue Critical Remediation: {rem.title}",
                    reason=f"Automated trigger: Critical Remediation {rem.business_id} breached SLA target date ({rem.target_date.strftime('%Y-%m-%d')}).",
                    severity="CRITICAL",
                    priority="CRITICAL",
                    level="LEVEL_2",
                    trigger_type="OVERDUE_REMEDIATION",
                    organization_id=rem.organization_id,
                    sector_id=rem.sector_id,
                    source_remediation_id=rem.id,
                    source_finding_id=rem.finding_id,
                    source_risk_id=rem.risk_id,
                    triggering_user=triggering_user
                )
                if esc_record:
                    created_escalations.append(esc_record)

        db.commit()
        return created_escalations

    @classmethod
    def _trigger_auto_escalation(
        cls,
        db: Session,
        resource_type: str,
        resource_id: uuid.UUID,
        title: str,
        reason: str,
        severity: str,
        priority: str,
        level: str,
        trigger_type: str,
        organization_id: Optional[uuid.UUID],
        sector_id: Optional[uuid.UUID],
        source_cse_id: Optional[uuid.UUID] = None,
        source_finding_id: Optional[uuid.UUID] = None,
        source_risk_id: Optional[uuid.UUID] = None,
        source_remediation_id: Optional[uuid.UUID] = None,
        source_assessment_id: Optional[uuid.UUID] = None,
        triggering_user: Optional[User] = None
    ) -> Optional[Dict[str, Any]]:
        actor_id = triggering_user.id if triggering_user else None
        if not actor_id:
            system_user = db.query(User).filter(User.email == "supervision.auth@sat-sa.local").first() or db.query(User).first()
            actor_id = system_user.id if system_user else None

        if not actor_id:
            return None

        # Generate Business IDs
        year = datetime.now().year
        esc_count = db.query(Escalation).count() + 1
        esc_bus_id = f"ESC-{year}-{esc_count:05d}"

        case_count = db.query(SupervisoryCase).count() + 1
        case_bus_id = f"SUP-{year}-{case_count:05d}"

        # Create Supervisory Case
        sup_case = SupervisoryCase(
            business_id=case_bus_id,
            title=title,
            description=reason,
            priority=priority,
            status="OPEN",
            trigger_type=trigger_type,
            organization_id=organization_id,
            sector_id=sector_id,
            created_by_id=actor_id,
            source_cse_id=source_cse_id,
            source_finding_id=source_finding_id,
            source_risk_id=source_risk_id,
            source_remediation_id=source_remediation_id,
            source_assessment_id=source_assessment_id,
        )
        db.add(sup_case)
        db.flush()

        # Create Escalation linked to Supervisory Case
        escalation = Escalation(
            business_id=esc_bus_id,
            resource_type=resource_type,
            resource_id=resource_id,
            reason=reason,
            severity=severity,
            priority=priority,
            level=level,
            status="OPEN",
            escalated_by_id=actor_id,
            organization_id=organization_id,
            sector_id=sector_id,
            supervisory_case_id=sup_case.id,
        )
        db.add(escalation)
        db.flush()

        return {
            "escalation_id": str(escalation.id),
            "escalation_business_id": esc_bus_id,
            "case_id": str(sup_case.id),
            "case_business_id": case_bus_id,
            "trigger_type": trigger_type,
            "resource_type": resource_type,
            "title": title
        }
