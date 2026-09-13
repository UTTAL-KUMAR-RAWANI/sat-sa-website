import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.models.identity import User
from app.models.security import CSE, Investigation
from app.models.assessment import Assessment
from app.models.finding import Finding
from app.models.risk import Risk
from app.models.remediation import Remediation
from app.models.supervision import SupervisoryCase, SupervisoryDecision
from app.models.workflow import Escalation
from app.rbac import permissions as p
from app.rbac.service import AuthorizationService
from app.my_work.schemas import (
    WorkItem,
    MyWorkSummaryResponse,
    MyWorkResponse,
)


class MyWorkService:

    @classmethod
    def get_my_work(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
        bucket: str = "all",  # all, assigned, needs_review, overdue, critical
    ) -> MyWorkResponse:
        user_perms = AuthorizationService.get_user_permissions(user)
        now = datetime.now(timezone.utc)
        items: List[WorkItem] = []

        # 1. CSEs (Cyber Security Events)
        if p.CSE_READ in user_perms:
            cse_q = db.query(CSE).options(joinedload(CSE.organization)).filter(
                CSE.status != "CLOSED",
                or_(CSE.assigned_to_id == user.id, CSE.created_by_id == user.id),
            )
            for c in cse_q.all():
                is_crit = c.severity in ["CRITICAL", "HIGH"]
                items.append(
                    WorkItem(
                        id=str(c.id),
                        item_type="CSE",
                        business_id=c.business_id,
                        title=c.title,
                        severity=c.severity or "MEDIUM",
                        status=c.status,
                        role_relationship="ASSIGNED",
                        due_date=None,
                        is_overdue=False,
                        needs_review=False,
                        is_critical=is_crit,
                        action_url=f"/cse/{c.id}",
                        organization_name=c.organization.name if c.organization else None,
                        created_at=c.created_at,
                    )
                )

        # 2. Investigations
        if p.INVESTIGATIONS_READ in user_perms:
            inv_q = db.query(Investigation).filter(
                Investigation.status != "CLOSED",
                Investigation.lead_analyst_id == user.id,
            )
            for inv in inv_q.all():
                items.append(
                    WorkItem(
                        id=str(inv.id),
                        item_type="INVESTIGATION",
                        business_id=inv.business_id,
                        title=inv.title,
                        severity="HIGH",
                        status=inv.status,
                        role_relationship="ASSIGNED",
                        due_date=None,
                        is_overdue=False,
                        needs_review=False,
                        is_critical=True,
                        action_url=f"/investigations/{inv.id}",
                        organization_name=None,
                        created_at=inv.created_at,
                    )
                )

        # 3. Assessments
        if p.ASSESSMENT_READ in user_perms:
            asmt_q = db.query(Assessment).options(joinedload(Assessment.organization)).filter(
                Assessment.status != "COMPLETED",
                Assessment.status != "ARCHIVED",
            )
            can_review_asmt = p.ASSESSMENT_REVIEW in user_perms or p.ASSESSMENT_APPROVE in user_perms
            for a in asmt_q.all():
                is_owner = a.assessor_id == user.id or a.created_by_id == user.id
                in_review = a.status in ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"]

                scope_match = True
                if effective_scope == "organization" and user.organization_id != a.organization_id:
                    scope_match = False
                elif effective_scope == "sector" and user.sector_id != a.sector_id:
                    scope_match = False

                if is_owner or (can_review_asmt and in_review and scope_match):
                    due = a.due_date
                    is_ov = due is not None and due < now
                    rel = "REVIEWER" if (in_review and not is_owner) else "ASSIGNED"
                    items.append(
                        WorkItem(
                            id=str(a.id),
                            item_type="ASSESSMENT",
                            business_id=a.business_id,
                            title=a.title,
                            severity="HIGH" if is_ov else "MEDIUM",
                            status=a.status,
                            role_relationship=rel,
                            due_date=due,
                            is_overdue=is_ov,
                            needs_review=in_review,
                            is_critical=is_ov,
                            action_url=f"/assessments/{a.id}",
                            organization_name=a.organization.name if a.organization else None,
                            created_at=a.created_at,
                        )
                    )

        # 4. Findings
        if p.FINDING_READ in user_perms:
            fnd_q = db.query(Finding).options(joinedload(Finding.organization)).filter(
                Finding.status != "CLOSED",
                Finding.status != "REMEDIATED",
            )
            can_review_fnd = p.FINDING_REVIEW in user_perms or p.FINDING_APPROVE in user_perms
            for f in fnd_q.all():
                is_assigned = f.assigned_to_id == user.id or f.created_by_id == user.id
                is_crit = f.severity == "CRITICAL"
                in_review = f.status in ["SUBMITTED", "UNDER_REVIEW"]

                scope_match = True
                if effective_scope == "organization" and user.organization_id != f.organization_id:
                    scope_match = False
                elif effective_scope == "sector" and user.sector_id != f.sector_id:
                    scope_match = False

                if is_assigned or (can_review_fnd and in_review and scope_match) or (is_crit and scope_match):
                    rel = "ASSIGNED" if is_assigned else ("REVIEWER" if in_review else "SCOPE_CRITICAL")
                    items.append(
                        WorkItem(
                            id=str(f.id),
                            item_type="FINDING",
                            business_id=f.business_id,
                            title=f.title,
                            severity=f.severity,
                            status=f.status,
                            role_relationship=rel,
                            due_date=None,
                            is_overdue=False,
                            needs_review=in_review,
                            is_critical=is_crit,
                            action_url=f"/findings/{f.id}",
                            organization_name=f.organization.name if f.organization else None,
                            created_at=f.created_at,
                        )
                    )

        # 5. Risks & GRC
        if p.RISK_READ in user_perms:
            risk_q = db.query(Risk).options(joinedload(Risk.organization)).filter(
                Risk.status != "CLOSED",
            )
            for r in risk_q.all():
                is_owner = r.owner_id == user.id or r.identified_by_id == user.id
                is_crit = r.inherent_risk_level == "CRITICAL" or getattr(r, "current_level", None) == "CRITICAL"
                due = r.review_date
                is_ov = due is not None and due < now

                scope_match = True
                if effective_scope == "organization" and user.organization_id != r.organization_id:
                    scope_match = False
                elif effective_scope == "sector" and user.sector_id != r.sector_id:
                    scope_match = False

                if (is_owner or (is_crit and scope_match)) and scope_match:
                    items.append(
                        WorkItem(
                            id=str(r.id),
                            item_type="RISK",
                            business_id=r.business_id,
                            title=r.title,
                            severity="CRITICAL" if is_crit else "HIGH",
                            status=r.status,
                            role_relationship="ASSIGNED" if is_owner else "SCOPE_CRITICAL",
                            due_date=due,
                            is_overdue=is_ov,
                            needs_review=r.status == "TREATMENT_REQUIRED",
                            is_critical=is_crit,
                            action_url=f"/risks/{r.id}",
                            organization_name=r.organization.name if r.organization else None,
                            created_at=r.created_at,
                        )
                    )

        # 6. Remediations
        if p.REMEDIATION_READ in user_perms:
            rem_q = db.query(Remediation).options(joinedload(Remediation.organization)).filter(
                Remediation.status != "VERIFIED",
                Remediation.status != "CLOSED",
            )
            for rm in rem_q.all():
                is_owner = rm.owner_id == user.id or rm.created_by_id == user.id
                due = rm.target_date
                is_ov = due is not None and due < now
                is_crit = rm.priority in ["CRITICAL", "HIGH"] or is_ov

                scope_match = True
                if effective_scope == "organization" and user.organization_id != rm.organization_id:
                    scope_match = False
                elif effective_scope == "sector" and user.sector_id != rm.sector_id:
                    scope_match = False

                if (is_owner or (is_ov and scope_match)) and scope_match:
                    items.append(
                        WorkItem(
                            id=str(rm.id),
                            item_type="REMEDIATION",
                            business_id=rm.business_id,
                            title=rm.title,
                            severity=rm.priority,
                            status=rm.status,
                            role_relationship="ASSIGNED" if is_owner else "SCOPE_CRITICAL",
                            due_date=due,
                            is_overdue=is_ov,
                            needs_review=rm.status == "AWAITING_VALIDATION",
                            is_critical=is_crit,
                            action_url=f"/remediations/{rm.id}",
                            organization_name=rm.organization.name if rm.organization else None,
                            created_at=rm.created_at,
                        )
                    )

        # 7. Supervisory Cases & Decisions
        if p.SUPERVISION_READ in user_perms or p.SUPERVISORY_CASE_READ in user_perms:
            case_q = db.query(SupervisoryCase).options(joinedload(SupervisoryCase.organization)).filter(
                SupervisoryCase.status != "CLOSED",
            )
            can_decide = p.SUPERVISION_DECIDE in user_perms or p.SUPERVISORY_DECISION_APPROVE in user_perms
            for sc in case_q.all():
                is_lead = sc.assigned_analyst_id == user.id or sc.created_by_id == user.id
                needs_rev = sc.status in ["AUTHORITY_REVIEW", "DECISION_REQUIRED"]

                scope_match = True
                if effective_scope == "organization" and user.organization_id != sc.organization_id:
                    scope_match = False
                elif effective_scope == "sector" and user.sector_id != sc.sector_id:
                    scope_match = False

                if (is_lead or (needs_rev and can_decide)) and scope_match:
                    items.append(
                        WorkItem(
                            id=str(sc.id),
                            item_type="SUPERVISORY_CASE",
                            business_id=sc.business_id,
                            title=sc.title,
                            severity="CRITICAL" if sc.status == "DECISION_REQUIRED" else "HIGH",
                            status=sc.status,
                            role_relationship="REVIEWER" if (needs_rev and not is_lead) else "ASSIGNED",
                            due_date=sc.due_date,
                            is_overdue=sc.due_date is not None and sc.due_date < now,
                            needs_review=needs_rev,
                            is_critical=sc.status == "DECISION_REQUIRED",
                            action_url=f"/supervision/cases/{sc.id}",
                            organization_name=sc.organization.name if sc.organization else None,
                            created_at=sc.created_at,
                        )
                    )

        # Deduplicate items by (item_type, id)
        seen = set()
        deduped: List[WorkItem] = []
        for it in items:
            key = (it.item_type, it.id)
            if key not in seen:
                seen.add(key)
                deduped.append(it)

        # Sort: Overdue first, then Critical, then Needs Review, then created_at desc
        deduped.sort(
            key=lambda x: (
                1 if x.is_overdue else 0,
                1 if x.is_critical else 0,
                1 if x.needs_review else 0,
                x.created_at.timestamp() if x.created_at else 0,
            ),
            reverse=True,
        )

        # Calculate summary metrics
        total_assigned = sum(1 for it in deduped if it.role_relationship in ["ASSIGNED", "OWNER"])
        needs_review_count = sum(1 for it in deduped if it.needs_review)
        overdue_count = sum(1 for it in deduped if it.is_overdue)
        critical_count = sum(1 for it in deduped if it.is_critical)

        by_category = {}
        for it in deduped:
            by_category[it.item_type] = by_category.get(it.item_type, 0) + 1

        summary = MyWorkSummaryResponse(
            total_assigned=total_assigned,
            needs_review_count=needs_review_count,
            overdue_count=overdue_count,
            critical_count=critical_count,
            by_category=by_category,
        )

        # Apply bucket filter
        filtered_items = deduped
        if bucket == "assigned":
            filtered_items = [it for it in deduped if it.role_relationship in ["ASSIGNED", "OWNER"]]
        elif bucket == "needs_review":
            filtered_items = [it for it in deduped if it.needs_review]
        elif bucket == "overdue":
            filtered_items = [it for it in deduped if it.is_overdue]
        elif bucket == "critical":
            filtered_items = [it for it in deduped if it.is_critical]

        return MyWorkResponse(
            items=filtered_items,
            summary=summary,
            effective_scope=effective_scope,
        )

    @classmethod
    def get_summary(
        cls,
        db: Session,
        user: User,
        effective_scope: str,
    ) -> MyWorkSummaryResponse:
        res = cls.get_my_work(db=db, user=user, effective_scope=effective_scope, bucket="all")
        return res.summary
