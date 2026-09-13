"""
Executive Reporting & Dashboard Aggregation Service.
Computes deterministic, explainable security posture, risk exposure,
remediation health, detection coverage, and executive summaries.
Consumes real PostgreSQL data across Steps 1-14 with RBAC and Scope isolation.
"""

import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func, and_, case

from app.models.security import CSE, Alert, Investigation, SecurityEvent
from app.models.finding import Finding
from app.models.assessment import Assessment, AssessmentControl
from app.models.risk import Risk, RiskTreatment, RiskException
from app.models.remediation import Remediation
from app.models.negative_space import NegativeSpaceAssessment, NegativeSpaceSignal
from app.models.supervision import SupervisoryCase, SupervisoryDecision
from app.models.workflow import Escalation
from app.models.organization import Organization, Sector
from app.models.audit import AuditLog
from app.models.identity import User
from app.rbac.scopes import ScopeType
from app.executive.schemas import (
    PostureScoreBreakdown,
    AttentionRequiredItem,
    CISOSummaryKPIs,
    CISOSummaryResponse,
    ManagementSummaryKPIs,
    ManagementSummaryResponse,
    ExecutiveRiskOverview,
    ExecutiveFindingsOverview,
    ExecutiveRemediationOverview,
    ExecutiveAssessmentOverview,
    ExecutiveNegativeSpaceOverview,
    ExecutiveSupervisionOverview,
    ExecutiveTrendsResponse,
    ExecutiveComparisonResponse,
)


class ExecutiveService:

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
            elif model_cls == NegativeSpaceSignal:
                return query.filter(
                    NegativeSpaceSignal.assessment.has(NegativeSpaceAssessment.sector_id == user_sector_id)
                )
            return query

        if effective_scope == ScopeType.ORGANIZATION:
            if hasattr(model_cls, "organization_id"):
                return query.filter(model_cls.organization_id == user_org_id)
            elif model_cls == NegativeSpaceSignal:
                return query.filter(
                    NegativeSpaceSignal.assessment.has(NegativeSpaceAssessment.organization_id == user_org_id)
                )
            return query

        if effective_scope in [ScopeType.ASSIGNED, ScopeType.OWN]:
            if hasattr(model_cls, "owner_id"):
                return query.filter(model_cls.owner_id == user_id)
            elif hasattr(model_cls, "assigned_to_id"):
                return query.filter(model_cls.assigned_to_id == user_id)
            elif hasattr(model_cls, "created_by_id"):
                return query.filter(model_cls.created_by_id == user_id)
            return query

        return query

    # =========================================================================
    # 1. EXPLAINABLE & DETERMINISTIC POSTURE CALCULATION
    # =========================================================================

    @classmethod
    def calculate_posture(
        cls, db: Session, user: User, effective_scope: str
    ) -> PostureScoreBreakdown:
        """
        Calculates a deterministic, explainable security posture score (0-100)
        from 5 weighted security health dimensions:
            - Risk Health (25%): Open critical/high risks and overdue treatments
            - Finding Health (25%): Open critical/high findings and aging items
            - Remediation Health (20%): Remediation completion rate and overdue/blocked penalties
            - Assessment Health (15%): Control effectiveness proportions
            - Detection Health (15%): Active negative-space signals & coverage gaps
        """
        now = datetime.now(timezone.utc)

        # 1. Risk Health
        risk_q = db.query(Risk).filter(Risk.status != "CLOSED")
        risk_q = cls._apply_scope_filter(risk_q, Risk, user, effective_scope)
        open_risks = risk_q.all()

        total_risks_count = db.query(Risk)
        total_risks_count = cls._apply_scope_filter(total_risks_count, Risk, user, effective_scope).count()

        risk_score = 100
        if open_risks:
            crit_count = sum(1 for r in open_risks if (r.residual_risk_level or r.inherent_risk_level) == "CRITICAL")
            high_count = sum(1 for r in open_risks if (r.residual_risk_level or r.inherent_risk_level) == "HIGH")
            overdue_count = sum(1 for r in open_risks if r.review_date and r.review_date < now)

            risk_score -= min(crit_count * 15, 45)
            risk_score -= min(high_count * 8, 32)
            risk_score -= min(overdue_count * 5, 20)
            risk_score = max(0, min(100, risk_score))

        # 2. Finding Health
        fnd_q = db.query(Finding).filter(Finding.status != "CLOSED")
        fnd_q = cls._apply_scope_filter(fnd_q, Finding, user, effective_scope)
        open_findings = fnd_q.all()

        total_findings_count = db.query(Finding)
        total_findings_count = cls._apply_scope_filter(total_findings_count, Finding, user, effective_scope).count()

        finding_score = 100
        if open_findings:
            crit_fnd = sum(1 for f in open_findings if f.severity == "CRITICAL")
            high_fnd = sum(1 for f in open_findings if f.severity == "HIGH")
            aging_fnd = sum(1 for f in open_findings if f.created_at and (now - f.created_at).days > 30)

            finding_score -= min(crit_fnd * 15, 45)
            finding_score -= min(high_fnd * 7, 35)
            finding_score -= min(aging_fnd * 4, 20)
            finding_score = max(0, min(100, finding_score))

        # 3. Remediation Health
        rem_q = db.query(Remediation)
        rem_q = cls._apply_scope_filter(rem_q, Remediation, user, effective_scope)
        all_remediations = rem_q.all()
        total_remediations_count = len(all_remediations)

        remediation_score = 100
        if all_remediations:
            completed_count = sum(1 for r in all_remediations if r.status in ["VERIFIED", "CLOSED"])
            overdue_rem = sum(1 for r in all_remediations if r.status not in ["VERIFIED", "CLOSED"] and r.due_date and r.due_date < now)
            blocked_rem = sum(1 for r in all_remediations if r.status == "BLOCKED")

            base_rate = (completed_count / total_remediations_count) * 100.0
            remediation_score = round(base_rate - min(overdue_rem * 10, 30) - min(blocked_rem * 8, 24))
            remediation_score = max(0, min(100, remediation_score))

        # 4. Assessment & Control Health
        ctrl_q = db.query(AssessmentControl).join(Assessment, AssessmentControl.assessment_id == Assessment.id)
        ctrl_q = cls._apply_scope_filter(ctrl_q, Assessment, user, effective_scope)
        controls = ctrl_q.all()
        total_controls_count = len(controls)

        assessment_score = 100
        if controls:
            eff_points = 0
            for c in controls:
                eff = (c.effectiveness or "NOT_ASSESSED").upper()
                if eff == "EFFECTIVE":
                    eff_points += 100
                elif eff == "PARTIALLY_EFFECTIVE":
                    eff_points += 50
                elif eff == "NOT_ASSESSED":
                    eff_points += 40
                elif eff == "INEFFECTIVE":
                    eff_points += 0
            assessment_score = round(eff_points / total_controls_count)
            assessment_score = max(0, min(100, assessment_score))

        # 5. Detection Coverage & Negative-Space Health
        sig_q = db.query(NegativeSpaceSignal).filter(NegativeSpaceSignal.status.in_(["DETECTED", "REVIEWING", "VALIDATED"]))
        sig_q = cls._apply_scope_filter(sig_q, NegativeSpaceSignal, user, effective_scope)
        active_signals = sig_q.all()
        total_signals_count = len(active_signals)

        detection_score = 100
        if active_signals:
            crit_sigs = sum(1 for s in active_signals if s.severity == "CRITICAL")
            high_sigs = sum(1 for s in active_signals if s.severity == "HIGH")
            med_sigs = sum(1 for s in active_signals if s.severity == "MEDIUM")

            detection_score -= min(crit_sigs * 15, 45)
            detection_score -= min(high_sigs * 8, 32)
            detection_score -= min(med_sigs * 4, 20)
            detection_score = max(0, min(100, detection_score))

        weights = {
            "risk_health": 0.25,
            "findings_health": 0.25,
            "remediation_health": 0.20,
            "assessment_health": 0.15,
            "detection_health": 0.15,
        }

        # Check if database has zero telemetry or records across all domains
        total_entities = (
            total_risks_count
            + total_findings_count
            + total_remediations_count
            + total_controls_count
            + total_signals_count
        )

        if total_entities == 0:
            return PostureScoreBreakdown(
                score=None,
                risk_health=risk_score,
                findings_health=finding_score,
                remediation_health=remediation_score,
                assessment_health=assessment_score,
                detection_health=detection_score,
                weights=weights,
                status="INSUFFICIENT_DATA",
                description="Posture score unavailable — insufficient data.",
                formula="Composite = 0.25*Risk + 0.25*Findings + 0.20*Remediation + 0.15*Assessment + 0.15*Detection",
            )

        overall_score = round(
            (risk_score * weights["risk_health"])
            + (finding_score * weights["findings_health"])
            + (remediation_score * weights["remediation_health"])
            + (assessment_score * weights["assessment_health"])
            + (detection_score * weights["detection_health"])
        )
        overall_score = max(0, min(100, overall_score))

        if overall_score >= 85:
            status = "OPTIMAL"
            desc = "Security posture is optimal with minimal high-priority exposures."
        elif overall_score >= 70:
            status = "STABLE"
            desc = "Security posture is stable. Controls and remediations are progressing normally."
        elif overall_score >= 50:
            status = "ELEVATED_RISK"
            desc = "Elevated risk observed. Attention required on open findings and overdue remediations."
        else:
            status = "CRITICAL_EXPOSURE"
            desc = "Critical exposure detected across multiple security and compliance dimensions."

        return PostureScoreBreakdown(
            score=overall_score,
            risk_health=risk_score,
            findings_health=finding_score,
            remediation_health=remediation_score,
            assessment_health=assessment_score,
            detection_health=detection_score,
            weights=weights,
            status=status,
            description=desc,
            formula="Composite = 0.25*Risk + 0.25*Findings + 0.20*Remediation + 0.15*Assessment + 0.15*Detection",
        )

    # =========================================================================
    # 2. PRIORITIZED ATTENTION REQUIRED PANEL
    # =========================================================================

    @classmethod
    def get_attention_required(
        cls, db: Session, user: User, effective_scope: str, limit: int = 10
    ) -> List[AttentionRequiredItem]:
        now = datetime.now(timezone.utc)
        items: List[AttentionRequiredItem] = []

        # 1. Critical Risks requiring treatment or overdue review
        crit_risks_q = db.query(Risk).filter(
            Risk.status != "CLOSED",
            or_(Risk.residual_risk_level == "CRITICAL", Risk.inherent_risk_level == "CRITICAL"),
        )
        crit_risks = cls._apply_scope_filter(crit_risks_q, Risk, user, effective_scope).limit(4).all()
        for r in crit_risks:
            age = (now - r.created_at).days if r.created_at else 0
            act = "Treatment plan required" if r.status in ["IDENTIFIED", "ASSESSED"] else "Review overdue"
            items.append(
                AttentionRequiredItem(
                    id=str(r.id),
                    type="CRITICAL_RISK",
                    business_id=r.business_id,
                    title=r.title,
                    severity="CRITICAL",
                    age_days=age,
                    owner=r.owner.username if r.owner else None,
                    status=r.status,
                    required_action=act,
                    link_url=f"/risks/{r.id}",
                )
            )

        # 2. Critical Findings
        crit_fnd_q = db.query(Finding).filter(
            Finding.status != "CLOSED",
            Finding.severity.in_(["CRITICAL", "HIGH"]),
        )
        crit_fnds = cls._apply_scope_filter(crit_fnd_q, Finding, user, effective_scope).limit(4).all()
        for f in crit_fnds:
            age = (now - f.created_at).days if f.created_at else 0
            items.append(
                AttentionRequiredItem(
                    id=str(f.id),
                    type="CRITICAL_FINDING",
                    business_id=f.business_id,
                    title=f.title,
                    severity=f.severity,
                    age_days=age,
                    owner=f.assigned_to.username if f.assigned_to else None,
                    status=f.status,
                    required_action="Assign remediation and review exposure",
                    link_url=f"/findings/{f.id}",
                )
            )

        # 3. Overdue or Blocked Remediations
        rem_q = db.query(Remediation).filter(
            Remediation.status.in_(["BLOCKED", "OPEN", "IN_PROGRESS"]),
            or_(Remediation.status == "BLOCKED", Remediation.due_date < now),
        )
        crit_rems = cls._apply_scope_filter(rem_q, Remediation, user, effective_scope).limit(4).all()
        for rm in crit_rems:
            age = (now - rm.created_at).days if rm.created_at else 0
            act = f"Unblock: {rm.blocked_reason[:40]}..." if rm.status == "BLOCKED" else "Remediation overdue"
            items.append(
                AttentionRequiredItem(
                    id=str(rm.id),
                    type="OVERDUE_REMEDIATION",
                    business_id=rm.business_id,
                    title=rm.title,
                    severity=rm.priority,
                    age_days=age,
                    owner=rm.assigned_team or (rm.owner.username if rm.owner else None),
                    status=rm.status,
                    required_action=act,
                    link_url=f"/remediations/{rm.id}",
                )
            )

        # 4. Validated / Critical Negative-Space Gaps
        sig_q = db.query(NegativeSpaceSignal).filter(
            NegativeSpaceSignal.status.in_(["DETECTED", "VALIDATED"]),
            NegativeSpaceSignal.severity.in_(["CRITICAL", "HIGH"]),
        )
        crit_sigs = cls._apply_scope_filter(sig_q, NegativeSpaceSignal, user, effective_scope).limit(3).all()
        for s in crit_sigs:
            items.append(
                AttentionRequiredItem(
                    id=str(s.id),
                    type="DETECTION_GAP",
                    business_id=s.business_id,
                    title=f"Telemetry Silence / Gap: {s.category.replace('_', ' ').title()}",
                    severity=s.severity,
                    age_days=(now - s.created_at).days if s.created_at else 0,
                    owner=s.source,
                    status=s.status,
                    required_action="Validate coverage gap & convert to Finding",
                    link_url=f"/negative-space/signals/{s.id}",
                )
            )

        # 5. Supervisory Decisions awaiting action
        case_q = db.query(SupervisoryCase).filter(
            SupervisoryCase.status.in_(["AUTHORITY_REVIEW", "DECISION_REQUIRED", "OPEN"])
        )
        sup_cases = cls._apply_scope_filter(case_q, SupervisoryCase, user, effective_scope).limit(3).all()
        for c in sup_cases:
            items.append(
                AttentionRequiredItem(
                    id=str(c.id),
                    type="SUPERVISORY_DECISION",
                    business_id=c.business_id,
                    title=c.title,
                    severity=c.priority,
                    age_days=(now - c.created_at).days if c.created_at else 0,
                    owner=c.assigned_analyst.username if c.assigned_analyst else None,
                    status=c.status,
                    required_action="Supervisory authority review required",
                    link_url=f"/supervision/cases/{c.id}",
                )
            )

        # Sort items: CRITICAL first, then HIGH
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        items.sort(key=lambda x: sev_order.get(x.severity, 4))
        return items[:limit]

    # =========================================================================
    # 3. CISO DASHBOARD SUMMARY & DETAILED SECTIONS
    # =========================================================================

    @classmethod
    def get_ciso_summary(cls, db: Session, user: User, effective_scope: str) -> CISOSummaryResponse:
        posture = cls.calculate_posture(db, user, effective_scope)
        now = datetime.now(timezone.utc)

        # KPI counts
        cse_q = db.query(CSE).filter(CSE.severity == "CRITICAL", CSE.status != "CLOSED")
        crit_cses = cls._apply_scope_filter(cse_q, CSE, user, effective_scope).count()

        fnd_q = db.query(Finding).filter(Finding.severity.in_(["CRITICAL", "HIGH"]), Finding.status != "CLOSED")
        high_crit_fnds = cls._apply_scope_filter(fnd_q, Finding, user, effective_scope).count()

        risk_q = db.query(Risk).filter(
            Risk.status != "CLOSED",
            or_(Risk.residual_risk_level == "CRITICAL", Risk.inherent_risk_level == "CRITICAL"),
        )
        crit_risks = cls._apply_scope_filter(risk_q, Risk, user, effective_scope).count()

        rem_q = db.query(Remediation).filter(Remediation.status.notin_(["VERIFIED", "CLOSED"]))
        open_rems = cls._apply_scope_filter(rem_q, Remediation, user, effective_scope).count()

        overdue_q = db.query(Remediation).filter(
            Remediation.status.notin_(["VERIFIED", "CLOSED"]),
            Remediation.due_date < now,
        )
        overdue_rems = cls._apply_scope_filter(overdue_q, Remediation, user, effective_scope).count()

        case_q = db.query(SupervisoryCase).filter(SupervisoryCase.status != "CLOSED")
        active_cases = cls._apply_scope_filter(case_q, SupervisoryCase, user, effective_scope).count()

        sig_q = db.query(NegativeSpaceSignal).filter(
            NegativeSpaceSignal.severity.in_(["CRITICAL", "HIGH"]),
            NegativeSpaceSignal.status.in_(["DETECTED", "REVIEWING", "VALIDATED"]),
        )
        high_crit_sigs = cls._apply_scope_filter(sig_q, NegativeSpaceSignal, user, effective_scope).count()

        attention = cls.get_attention_required(db, user, effective_scope, limit=8)

        return CISOSummaryResponse(
            posture=posture,
            kpis=CISOSummaryKPIs(
                critical_cses=crit_cses,
                high_critical_findings=high_crit_fnds,
                critical_risks=crit_risks,
                open_remediations=open_rems,
                overdue_remediations=overdue_rems,
                active_supervisory_cases=active_cases,
                high_critical_signals=high_crit_sigs,
            ),
            attention_required=attention,
            last_updated=now,
        )

    @classmethod
    def get_ciso_risks(cls, db: Session, user: User, effective_scope: str) -> ExecutiveRiskOverview:
        now = datetime.now(timezone.utc)
        q = db.query(Risk)
        q = cls._apply_scope_filter(q, Risk, user, effective_scope)
        all_risks = q.all()

        by_level: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        by_category: Dict[str, int] = {}
        by_org: Dict[str, int] = {}
        by_sec: Dict[str, int] = {}
        requiring_treatment = 0
        accepted_risks = 0
        overdue_reviews = 0

        for r in all_risks:
            lvl = (r.residual_risk_level or r.inherent_risk_level or "MEDIUM").upper()
            by_level[lvl] = by_level.get(lvl, 0) + 1

            cat = r.category or "Cybersecurity"
            by_category[cat] = by_category.get(cat, 0) + 1

            if r.organization and r.organization.name:
                by_org[r.organization.name] = by_org.get(r.organization.name, 0) + 1
            if r.sector and r.sector.name:
                by_sec[r.sector.name] = by_sec.get(r.sector.name, 0) + 1

            if r.status in ["IDENTIFIED", "ASSESSED", "TREATMENT_REQUIRED"]:
                requiring_treatment += 1
            elif r.status == "ACCEPTED":
                accepted_risks += 1

            if r.review_date and r.review_date < now and r.status != "CLOSED":
                overdue_reviews += 1

        exc_q = db.query(RiskException).filter(RiskException.status.in_(["OPEN", "APPROVED"]))
        exc_q = cls._apply_scope_filter(exc_q, RiskException, user, effective_scope)
        open_exceptions = exc_q.count()

        return ExecutiveRiskOverview(
            by_level=by_level,
            requiring_treatment=requiring_treatment,
            accepted_risks=accepted_risks,
            open_exceptions=open_exceptions,
            overdue_reviews=overdue_reviews,
            by_category=by_category,
            by_organization=by_org,
            by_sector=by_sec,
        )

    @classmethod
    def get_ciso_findings(cls, db: Session, user: User, effective_scope: str) -> ExecutiveFindingsOverview:
        now = datetime.now(timezone.utc)
        q = db.query(Finding).filter(Finding.status != "CLOSED")
        q = cls._apply_scope_filter(q, Finding, user, effective_scope)
        findings = q.all()

        by_sev: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        aging_30 = 0
        aging_60 = 0
        req_rem = 0
        linked_crit_risk = 0
        neg_space = 0

        for f in findings:
            sev = (f.severity or "MEDIUM").upper()
            by_sev[sev] = by_sev.get(sev, 0) + 1

            if f.created_at:
                age = (now - f.created_at).days
                if age > 60:
                    aging_60 += 1
                elif age > 30:
                    aging_30 += 1

            if f.remediation_required:
                req_rem += 1

            if f.source_type == "NEGATIVE_SPACE":
                neg_space += 1

            if f.risks:
                if any(
                    (r.residual_risk_level or r.inherent_risk_level) == "CRITICAL" for r in f.risks
                ):
                    linked_crit_risk += 1

        return ExecutiveFindingsOverview(
            by_severity=by_sev,
            aging_over_30d=aging_30,
            aging_over_60d=aging_60,
            requiring_remediation=req_rem,
            linked_to_critical_risks=linked_crit_risk,
            negative_space_findings=neg_space,
        )

    @classmethod
    def get_ciso_remediation(cls, db: Session, user: User, effective_scope: str) -> ExecutiveRemediationOverview:
        now = datetime.now(timezone.utc)
        q = db.query(Remediation)
        q = cls._apply_scope_filter(q, Remediation, user, effective_scope)
        rems = q.all()

        by_status: Dict[str, int] = {}
        overdue = 0
        blocked = 0
        crit_high = 0
        ages = []

        for r in rems:
            st = (r.status or "OPEN").upper()
            by_status[st] = by_status.get(st, 0) + 1

            if st not in ["VERIFIED", "CLOSED"] and r.due_date and r.due_date < now:
                overdue += 1

            if st == "BLOCKED":
                blocked += 1

            if r.priority in ["CRITICAL", "HIGH"]:
                crit_high += 1

            if r.created_at:
                ages.append((now - r.created_at).days)

        total = len(rems)
        completed = by_status.get("VERIFIED", 0) + by_status.get("CLOSED", 0)
        rate = round((completed / total * 100.0), 1) if total > 0 else 100.0
        avg_age = round(sum(ages) / len(ages), 1) if ages else None

        return ExecutiveRemediationOverview(
            by_status=by_status,
            completion_rate_pct=rate,
            overdue_count=overdue,
            blocked_count=blocked,
            critical_high_count=crit_high,
            average_age_days=avg_age,
        )

    @classmethod
    def get_ciso_assessments(cls, db: Session, user: User, effective_scope: str) -> ExecutiveAssessmentOverview:
        now = datetime.now(timezone.utc)
        q = db.query(Assessment)
        q = cls._apply_scope_filter(q, Assessment, user, effective_scope)
        asmts = q.all()

        completed = 0
        in_progress = 0
        review = 0
        changes = 0
        overdue = 0

        for a in asmts:
            st = (a.status or "DRAFT").upper()
            if st in ["APPROVED", "CLOSED"]:
                completed += 1
            elif st in ["IN_PROGRESS", "DRAFT"]:
                in_progress += 1
            elif st in ["SUBMITTED", "UNDER_REVIEW"]:
                review += 1
            elif st == "CHANGES_REQUESTED":
                changes += 1

            if a.due_date and a.due_date < now and st not in ["APPROVED", "CLOSED"]:
                overdue += 1

        # Control effectiveness
        ctrl_q = db.query(AssessmentControl).join(Assessment, AssessmentControl.assessment_id == Assessment.id)
        ctrl_q = cls._apply_scope_filter(ctrl_q, Assessment, user, effective_scope)
        controls = ctrl_q.all()

        eff_counts = {"EFFECTIVE": 0, "PARTIALLY_EFFECTIVE": 0, "INEFFECTIVE": 0, "NOT_ASSESSED": 0}
        for c in controls:
            eff = (c.effectiveness or "NOT_ASSESSED").upper()
            eff_counts[eff] = eff_counts.get(eff, 0) + 1

        return ExecutiveAssessmentOverview(
            assessments_completed=completed,
            assessments_in_progress=in_progress,
            assessments_under_review=review,
            changes_requested=changes,
            overdue_assessments=overdue,
            control_effectiveness=eff_counts,
        )

    @classmethod
    def get_ciso_negative_space(cls, db: Session, user: User, effective_scope: str) -> ExecutiveNegativeSpaceOverview:
        asmt_q = db.query(NegativeSpaceAssessment)
        asmt_q = cls._apply_scope_filter(asmt_q, NegativeSpaceAssessment, user, effective_scope)
        asmts_run = asmt_q.count()

        sig_q = db.query(NegativeSpaceSignal)
        sig_q = cls._apply_scope_filter(sig_q, NegativeSpaceSignal, user, effective_scope)
        all_sigs = sig_q.all()

        high_crit = 0
        under_review = 0
        validated = 0
        converted = 0

        for s in all_sigs:
            if s.severity in ["HIGH", "CRITICAL"]:
                high_crit += 1
            if s.status == "REVIEWING":
                under_review += 1
            elif s.status == "VALIDATED":
                validated += 1
            elif s.status == "CONVERTED_TO_FINDING":
                converted += 1

        return ExecutiveNegativeSpaceOverview(
            assessments_run=asmts_run,
            coverage_gaps_count=len(all_sigs),
            high_critical_signals=high_crit,
            signals_under_review=under_review,
            validated_signals=validated,
            converted_to_findings=converted,
        )

    @classmethod
    def get_ciso_supervision(cls, db: Session, user: User, effective_scope: str) -> ExecutiveSupervisionOverview:
        case_q = db.query(SupervisoryCase)
        case_q = cls._apply_scope_filter(case_q, SupervisoryCase, user, effective_scope)
        cases = case_q.all()

        open_c = 0
        awaiting_rev = 0
        monitoring = 0
        for c in cases:
            st = (c.status or "OPEN").upper()
            if st != "CLOSED":
                open_c += 1
            if st in ["AUTHORITY_REVIEW", "DECISION_REQUIRED"]:
                awaiting_rev += 1
            if st == "MONITORING":
                monitoring += 1

        esc_q = db.query(Escalation).filter(Escalation.severity == "CRITICAL", Escalation.status != "RESOLVED")
        esc_q = cls._apply_scope_filter(esc_q, Escalation, user, effective_scope)
        crit_esc = esc_q.count()

        dec_q = db.query(SupervisoryDecision).filter(SupervisoryDecision.status == "PENDING")
        dec_q = cls._apply_scope_filter(dec_q, SupervisoryDecision, user, effective_scope)
        pending_dec = dec_q.count()

        recent_dec_q = db.query(SupervisoryDecision).order_by(desc(SupervisoryDecision.created_at)).limit(5)
        recent_dec_q = cls._apply_scope_filter(recent_dec_q, SupervisoryDecision, user, effective_scope)
        recent_decs = [
            {
                "id": str(d.id),
                "business_id": d.business_id,
                "title": f"{d.decision_type}: {d.rationale[:60]}" if d.rationale else d.decision_type,
                "decision_type": d.decision_type,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in recent_dec_q.all()
        ]

        return ExecutiveSupervisionOverview(
            open_cases=open_c,
            critical_escalations=crit_esc,
            pending_decisions=pending_dec,
            cases_awaiting_review=awaiting_rev,
            cases_under_monitoring=monitoring,
            recent_decisions=recent_decs,
        )

    # =========================================================================
    # 4. SENIOR MANAGEMENT DASHBOARD SUMMARY
    # =========================================================================

    @classmethod
    def get_management_summary(cls, db: Session, user: User, effective_scope: str) -> ManagementSummaryResponse:
        posture = cls.calculate_posture(db, user, effective_scope)
        now = datetime.now(timezone.utc)

        risk_q = db.query(Risk).filter(
            Risk.status != "CLOSED",
            or_(Risk.residual_risk_level == "CRITICAL", Risk.inherent_risk_level == "CRITICAL"),
        )
        crit_risks = cls._apply_scope_filter(risk_q, Risk, user, effective_scope).count()

        fnd_q = db.query(Finding).filter(Finding.severity.in_(["CRITICAL", "HIGH"]), Finding.status != "CLOSED")
        high_crit_fnds = cls._apply_scope_filter(fnd_q, Finding, user, effective_scope).count()

        overdue_q = db.query(Remediation).filter(
            Remediation.priority.in_(["CRITICAL", "HIGH"]),
            Remediation.status.notin_(["VERIFIED", "CLOSED"]),
            Remediation.due_date < now,
        )
        overdue_crit_rem = cls._apply_scope_filter(overdue_q, Remediation, user, effective_scope).count()

        exc_q = db.query(RiskException).filter(RiskException.status.in_(["OPEN", "APPROVED"]))
        exc_q = cls._apply_scope_filter(exc_q, RiskException, user, effective_scope)
        open_exceptions = exc_q.count()

        case_q = db.query(SupervisoryCase).filter(SupervisoryCase.status != "CLOSED")
        active_cases = cls._apply_scope_filter(case_q, SupervisoryCase, user, effective_scope).count()

        dec_q = db.query(SupervisoryDecision).filter(SupervisoryDecision.status == "PENDING")
        dec_q = cls._apply_scope_filter(dec_q, SupervisoryDecision, user, effective_scope)
        pending_decisions = dec_q.count()

        total_open_issues = crit_risks + high_crit_fnds + overdue_crit_rem

        # Overall risk exposure verbal rating
        if crit_risks > 2 or high_crit_fnds > 5:
            exposure_rating = "HIGH EXPOSURE"
        elif crit_risks > 0 or high_crit_fnds > 2:
            exposure_rating = "MODERATE EXPOSURE"
        else:
            exposure_rating = "LOW EXPOSURE"

        # Remediation Progress %
        rem_q = db.query(Remediation)
        rem_q = cls._apply_scope_filter(rem_q, Remediation, user, effective_scope)
        rems = rem_q.all()
        completed_rems = sum(1 for r in rems if r.status in ["VERIFIED", "CLOSED"])
        rem_prog_pct = round((completed_rems / len(rems) * 100.0), 1) if rems else 100.0

        major_issues = cls.get_attention_required(db, user, effective_scope, limit=8)

        return ManagementSummaryResponse(
            posture=posture,
            kpis=ManagementSummaryKPIs(
                overall_risk_exposure=exposure_rating,
                critical_risks=crit_risks,
                high_critical_findings=high_crit_fnds,
                critical_open_issues=total_open_issues,
                overdue_critical_remediation=overdue_crit_rem,
                open_risk_exceptions=open_exceptions,
                active_supervisory_cases=active_cases,
                pending_executive_decisions=pending_decisions,
            ),
            remediation_progress_pct=rem_prog_pct,
            major_issues=major_issues,
            last_updated=now,
        )

    # =========================================================================
    # 5. REAL TRENDS (7d, 30d, 90d) WITHOUT ARTIFICIAL DATA FABRICATION
    # =========================================================================

    @classmethod
    def get_trends(
        cls, db: Session, user: User, effective_scope: str, days: int = 30
    ) -> ExecutiveTrendsResponse:
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)

        # Query real database records created within period
        def query_bucketed(model_cls: Any, date_col: Any) -> Dict[str, int]:
            q = db.query(
                func.date_trunc("day", date_col).label("day"),
                func.count(model_cls.id),
            ).filter(date_col >= start_date)
            q = cls._apply_scope_filter(q, model_cls, user, effective_scope)
            rows = q.group_by("day").order_by("day").all()
            return {
                r[0].strftime("%Y-%m-%d") if hasattr(r[0], "strftime") else str(r[0])[:10]: r[1]
                for r in rows
            }

        cses_by_day = query_bucketed(CSE, CSE.created_at)
        fnds_by_day = query_bucketed(Finding, Finding.created_at)
        risks_by_day = query_bucketed(Risk, Risk.created_at)
        rems_by_day = query_bucketed(Remediation, Remediation.completed_at)
        sigs_by_day = query_bucketed(NegativeSpaceSignal, NegativeSpaceSignal.created_at)
        escs_by_day = query_bucketed(Escalation, Escalation.created_at)

        all_distinct_dates = set(
            list(cses_by_day.keys())
            + list(fnds_by_day.keys())
            + list(risks_by_day.keys())
            + list(rems_by_day.keys())
            + list(sigs_by_day.keys())
            + list(escs_by_day.keys())
        )

        # Check for insufficient data
        if len(all_distinct_dates) < 2:
            return ExecutiveTrendsResponse(
                period_days=days,
                insufficient_data=True,
                message="Insufficient historical trend data in database for the selected window.",
                dates=sorted(list(all_distinct_dates)),
                cses=[cses_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
                findings=[fnds_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
                risks=[risks_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
                remediations_completed=[rems_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
                negative_space_signals=[sigs_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
                supervisory_escalations=[escs_by_day.get(d, 0) for d in sorted(list(all_distinct_dates))],
            )

        sorted_dates = sorted(list(all_distinct_dates))
        return ExecutiveTrendsResponse(
            period_days=days,
            insufficient_data=False,
            message=None,
            dates=sorted_dates,
            cses=[cses_by_day.get(d, 0) for d in sorted_dates],
            findings=[fnds_by_day.get(d, 0) for d in sorted_dates],
            risks=[risks_by_day.get(d, 0) for d in sorted_dates],
            remediations_completed=[rems_by_day.get(d, 0) for d in sorted_dates],
            negative_space_signals=[sigs_by_day.get(d, 0) for d in sorted_dates],
            supervisory_escalations=[escs_by_day.get(d, 0) for d in sorted_dates],
        )

    # =========================================================================
    # 6. COMPARISONS ACROSS ORGANIZATIONS & SECTORS
    # =========================================================================

    @classmethod
    def get_comparison(cls, db: Session, user: User, effective_scope: str) -> ExecutiveComparisonResponse:
        orgs_q = db.query(Organization)
        if effective_scope == ScopeType.ORGANIZATION and user.organization_id:
            orgs_q = orgs_q.filter(Organization.id == user.organization_id)
        elif effective_scope == ScopeType.SECTOR and user.sector_id:
            orgs_q = orgs_q.filter(Organization.sector_id == user.sector_id)
        orgs = orgs_q.all()

        org_list = []
        for o in orgs:
            rcount = db.query(Risk).filter(Risk.organization_id == o.id, Risk.status != "CLOSED").count()
            fcount = db.query(Finding).filter(Finding.organization_id == o.id, Finding.status != "CLOSED").count()
            rem_q = db.query(Remediation).filter(Remediation.organization_id == o.id)
            total_rem = rem_q.count()
            comp_rem = rem_q.filter(Remediation.status.in_(["VERIFIED", "CLOSED"])).count()
            rem_pct = round((comp_rem / total_rem * 100.0), 1) if total_rem > 0 else 100.0
            asmt_count = db.query(Assessment).filter(Assessment.organization_id == o.id).count()

            org_list.append({
                "id": str(o.id),
                "name": o.name,
                "open_risks": rcount,
                "open_findings": fcount,
                "remediation_rate": rem_pct,
                "assessments": asmt_count,
            })

        sec_q = db.query(Sector)
        if effective_scope in [ScopeType.SECTOR, ScopeType.ORGANIZATION] and user.sector_id:
            sec_q = sec_q.filter(Sector.id == user.sector_id)
        sectors = sec_q.all()

        sec_list = []
        for s in sectors:
            rcount = db.query(Risk).filter(Risk.sector_id == s.id, Risk.status != "CLOSED").count()
            fcount = db.query(Finding).filter(Finding.sector_id == s.id, Finding.status != "CLOSED").count()
            cse_count = db.query(CSE).filter(CSE.sector_id == s.id, CSE.status != "CLOSED").count()
            asmt_count = db.query(Assessment).filter(Assessment.sector_id == s.id).count()

            sec_list.append({
                "id": str(s.id),
                "name": s.name,
                "open_risks": rcount,
                "open_findings": fcount,
                "open_cses": cse_count,
                "assessments": asmt_count,
            })

        return ExecutiveComparisonResponse(organizations=org_list, sectors=sec_list)

    # =========================================================================
    # 7. EXECUTIVE CSV EXPORT WITH AUDIT LOGGING
    # =========================================================================

    @classmethod
    def export_summary_csv(cls, db: Session, user: User, effective_scope: str) -> str:
        summary = cls.get_ciso_summary(db, user, effective_scope)

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["SAT-SA EXECUTIVE SUMMARY EXPORT"])
        writer.writerow(["Exported At", summary.last_updated.isoformat()])
        writer.writerow(["Exported By", user.email])
        writer.writerow(["Scope", effective_scope])
        writer.writerow([])

        writer.writerow(["OVERALL SECURITY POSTURE"])
        writer.writerow(["Score", summary.posture.score if summary.posture.score is not None else "N/A"])
        writer.writerow(["Status", summary.posture.status])
        writer.writerow(["Description", summary.posture.description])
        writer.writerow(["Risk Health (25%)", summary.posture.risk_health])
        writer.writerow(["Findings Health (25%)", summary.posture.findings_health])
        writer.writerow(["Remediation Health (20%)", summary.posture.remediation_health])
        writer.writerow(["Assessment Health (15%)", summary.posture.assessment_health])
        writer.writerow(["Detection Health (15%)", summary.posture.detection_health])
        writer.writerow([])

        writer.writerow(["KEY PERFORMANCE INDICATORS"])
        writer.writerow(["Critical CSEs", summary.kpis.critical_cses])
        writer.writerow(["High & Critical Findings", summary.kpis.high_critical_findings])
        writer.writerow(["Critical Risks", summary.kpis.critical_risks])
        writer.writerow(["Open Remediations", summary.kpis.open_remediations])
        writer.writerow(["Overdue Remediations", summary.kpis.overdue_remediations])
        writer.writerow(["Active Supervisory Cases", summary.kpis.active_supervisory_cases])
        writer.writerow(["High/Critical Negative-Space Signals", summary.kpis.high_critical_signals])
        writer.writerow([])

        writer.writerow(["PRIORITIZED ATTENTION REQUIRED"])
        writer.writerow(["Type", "Business ID", "Title", "Severity", "Age (Days)", "Owner", "Required Action"])
        for item in summary.attention_required:
            writer.writerow([
                item.type,
                item.business_id,
                item.title,
                item.severity,
                item.age_days if item.age_days is not None else "--",
                item.owner or "Unassigned",
                item.required_action,
            ])

        csv_content = output.getvalue()

        # Audit Log
        db.add(
            AuditLog(
                actor_user_id=user.id,
                action="EXECUTIVE_REPORT_EXPORTED",
                resource_type="executive_summary",
                resource_id=None,
                new_value={"format": "csv", "scope": effective_scope, "score": summary.posture.score},
            )
        )
        db.commit()

        return csv_content
