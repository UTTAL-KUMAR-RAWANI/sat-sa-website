"""
Service layer for Negative-Space Assessment and Negative-Space Signals.
Handles business logic, baseline vs comparison analysis, scoping, state transitions,
finding conversion, audit logging, and notifications.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func, and_
from fastapi import HTTPException, status

from app.models.negative_space import NegativeSpaceAssessment, NegativeSpaceSignal
from app.models.dataset import Dataset, DatasetImport, AnalyticsRun
from app.models.security import SecurityEvent, Alert, CSE
from app.models.finding import Finding
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.identity import User
from app.models.organization import Organization, Sector
from app.rbac.scopes import ScopeType, check_resource_scope
from app.negative_space.engine import NegativeSpaceEngine
from app.negative_space.schemas import (
    NegativeSpaceAssessmentCreate,
    NegativeSpaceAssessmentUpdate,
    NegativeSpaceAssessmentRunRequest,
    NegativeSpaceSignalReviewRequest,
    NegativeSpaceSignalValidateRequest,
    NegativeSpaceSignalDismissRequest,
    NegativeSpaceSignalConvertFindingRequest,
    AssessmentConfig,
)


class NegativeSpaceService:

    @staticmethod
    def _generate_business_id(prefix: str, model_cls: Any, db: Session, offset: int = 0) -> str:
        current_year = datetime.now(timezone.utc).year
        year_prefix = f"{prefix}-{current_year}-"

        last_item = (
            db.query(model_cls)
            .filter(model_cls.business_id.like(f"{year_prefix}%"))
            .order_by(desc(model_cls.business_id))
            .first()
        )

        if last_item and last_item.business_id:
            try:
                seq = int(last_item.business_id.split("-")[-1]) + 1 + offset
            except (ValueError, IndexError):
                seq = 1 + offset
        else:
            seq = 1 + offset

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
            elif model_cls == NegativeSpaceSignal:
                return query.join(
                    NegativeSpaceAssessment, NegativeSpaceSignal.assessment_id == NegativeSpaceAssessment.id
                ).filter(NegativeSpaceAssessment.sector_id == user_sector_id)
            return query

        if effective_scope == ScopeType.ORGANIZATION:
            if hasattr(model_cls, "organization_id"):
                return query.filter(model_cls.organization_id == user_org_id)
            elif model_cls == NegativeSpaceSignal:
                return query.join(
                    NegativeSpaceAssessment, NegativeSpaceSignal.assessment_id == NegativeSpaceAssessment.id
                ).filter(NegativeSpaceAssessment.organization_id == user_org_id)
            return query

        if effective_scope == ScopeType.ANALYST:
            if hasattr(model_cls, "initiated_by_id"):
                return query.filter(
                    or_(
                        model_cls.initiated_by_id == user_id,
                        model_cls.organization_id == user_org_id,
                    )
                )
            elif model_cls == NegativeSpaceSignal:
                return query.join(
                    NegativeSpaceAssessment, NegativeSpaceSignal.assessment_id == NegativeSpaceAssessment.id
                ).filter(
                    or_(
                        NegativeSpaceAssessment.initiated_by_id == user_id,
                        NegativeSpaceAssessment.organization_id == user_org_id,
                        NegativeSpaceSignal.reviewed_by_id == user_id,
                    )
                )
            return query

        return query

    # =========================================================================
    # ASSESSMENT OPERATIONS
    # =========================================================================

    @classmethod
    def create_assessment(
        cls,
        db: Session,
        req: NegativeSpaceAssessmentCreate,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceAssessment:
        org_id = req.organization_id or current_user.organization_id
        sec_id = req.sector_id or current_user.sector_id

        # If dataset provided, inherit org/sector from dataset
        dataset = None
        if req.dataset_id:
            dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
            if not dataset:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Dataset with ID '{req.dataset_id}' not found",
                )
            if not check_resource_scope(current_user, effective_scope, dataset):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to specified dataset under current scope",
                )
            if not org_id:
                org_id = dataset.organization_id
            if not sec_id:
                sec_id = dataset.sector_id

        # Scope authorization check
        if effective_scope == ScopeType.ORGANIZATION and org_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create assessment outside of user assigned organization",
            )
        if effective_scope == ScopeType.SECTOR and sec_id != current_user.sector_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create assessment outside of user assigned sector",
            )

        b_id = cls._generate_business_id("NSA", NegativeSpaceAssessment, db)
        config_dict = req.configuration.model_dump() if req.configuration else AssessmentConfig().model_dump()

        assessment = NegativeSpaceAssessment(
            business_id=b_id,
            name=req.name,
            description=req.description,
            assessment_type=req.assessment_type,
            status="CONFIGURED" if req.expected_activity_definition or req.dataset_id else "DRAFT",
            dataset_id=req.dataset_id,
            organization_id=org_id,
            sector_id=sec_id,
            initiated_by_id=current_user.id,
            baseline_window_start=req.baseline_window_start,
            baseline_window_end=req.baseline_window_end,
            comparison_window_start=req.comparison_window_start,
            comparison_window_end=req.comparison_window_end,
            configuration=config_dict,
            expected_activity_definition=req.expected_activity_definition,
        )

        db.add(assessment)
        db.flush()

        # Audit Log
        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_ASSESSMENT_CREATED",
                resource_type="negative_space_assessment",
                resource_id=assessment.id,
                new_value={"business_id": b_id, "name": req.name, "type": req.assessment_type},
            )
        )
        db.commit()
        db.refresh(assessment)
        return assessment

    @classmethod
    def get_assessment(
        cls,
        db: Session,
        assessment_id: uuid.UUID,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceAssessment:
        query = db.query(NegativeSpaceAssessment).filter(NegativeSpaceAssessment.id == assessment_id)
        query = cls._apply_scope_filter(query, NegativeSpaceAssessment, current_user, effective_scope)
        assessment = query.first()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Negative space assessment '{assessment_id}' not found or inaccessible",
            )
        return assessment

    @classmethod
    def list_assessments(
        cls,
        db: Session,
        current_user: User,
        effective_scope: str,
        status_filter: Optional[str] = None,
        assessment_type: Optional[str] = None,
        dataset_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[NegativeSpaceAssessment], int]:
        query = db.query(NegativeSpaceAssessment)
        query = cls._apply_scope_filter(query, NegativeSpaceAssessment, current_user, effective_scope)

        if status_filter:
            query = query.filter(NegativeSpaceAssessment.status == status_filter)
        if assessment_type:
            query = query.filter(NegativeSpaceAssessment.assessment_type == assessment_type)
        if dataset_id:
            query = query.filter(NegativeSpaceAssessment.dataset_id == dataset_id)
        if search:
            search_like = f"%{search}%"
            query = query.filter(
                or_(
                    NegativeSpaceAssessment.name.ilike(search_like),
                    NegativeSpaceAssessment.business_id.ilike(search_like),
                    NegativeSpaceAssessment.description.ilike(search_like),
                )
            )

        total = query.count()
        items = query.order_by(desc(NegativeSpaceAssessment.created_at)).offset(skip).limit(limit).all()
        return items, total

    @classmethod
    def update_assessment(
        cls,
        db: Session,
        assessment_id: uuid.UUID,
        req: NegativeSpaceAssessmentUpdate,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceAssessment:
        assessment = cls.get_assessment(db, assessment_id, current_user, effective_scope)

        if assessment.status in ["RUNNING"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify an assessment while it is currently RUNNING",
            )

        old_val = {"status": assessment.status, "name": assessment.name}

        if req.name is not None:
            assessment.name = req.name
        if req.description is not None:
            assessment.description = req.description
        if req.assessment_type is not None:
            assessment.assessment_type = req.assessment_type
        if req.dataset_id is not None:
            dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
            if not dataset:
                raise HTTPException(status_code=404, detail="Dataset not found")
            assessment.dataset_id = req.dataset_id
        if req.baseline_window_start is not None:
            assessment.baseline_window_start = req.baseline_window_start
        if req.baseline_window_end is not None:
            assessment.baseline_window_end = req.baseline_window_end
        if req.comparison_window_start is not None:
            assessment.comparison_window_start = req.comparison_window_start
        if req.comparison_window_end is not None:
            assessment.comparison_window_end = req.comparison_window_end
        if req.configuration is not None:
            assessment.configuration = req.configuration
        if req.expected_activity_definition is not None:
            assessment.expected_activity_definition = req.expected_activity_definition

        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_ASSESSMENT_UPDATED",
                resource_type="negative_space_assessment",
                resource_id=assessment.id,
                old_value=old_val,
                new_value={"name": assessment.name, "status": assessment.status},
            )
        )
        db.commit()
        db.refresh(assessment)
        return assessment

    # =========================================================================
    # ASSESSMENT EXECUTION ENGINE RUN
    # =========================================================================

    @classmethod
    def run_assessment(
        cls,
        db: Session,
        assessment_id: uuid.UUID,
        req: Optional[NegativeSpaceAssessmentRunRequest],
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceAssessment:
        assessment = cls.get_assessment(db, assessment_id, current_user, effective_scope)

        # Update config if requested
        if req and req.configuration:
            assessment.configuration = req.configuration.model_dump()

        cfg = assessment.configuration or AssessmentConfig().model_dump()

        # Mark as RUNNING
        assessment.status = "RUNNING"
        db.commit()

        # Step 1: Baseline determination
        expected_profile = assessment.expected_activity_definition or {}
        dq_score = None
        dq_rating = None

        if assessment.dataset_id:
            dataset = db.query(Dataset).filter(Dataset.id == assessment.dataset_id).first()
            if dataset:
                dq_score = dataset.quality_score
                dq_rating = dataset.quality_rating

        # If expected profile not explicitly set, calculate baseline from dataset events
        if not expected_profile and assessment.dataset_id:
            base_q = db.query(SecurityEvent).filter(SecurityEvent.dataset_id == assessment.dataset_id)
            if assessment.baseline_window_start:
                base_q = base_q.filter(SecurityEvent.occurred_at >= assessment.baseline_window_start)
            if assessment.baseline_window_end:
                base_q = base_q.filter(SecurityEvent.occurred_at <= assessment.baseline_window_end)

            baseline_events = [
                {
                    "event_type": e.event_type,
                    "source": e.source,
                    "source_system": e.source_system,
                    "severity": e.severity,
                    "asset_id": e.asset_id,
                    "user_identifier": e.user_identifier,
                    "action": e.action,
                }
                for e in base_q.limit(5000).all()
            ]
            expected_profile = NegativeSpaceEngine.calculate_baseline(baseline_events)
            assessment.expected_activity_definition = expected_profile

        # Step 2: Observed events determination
        obs_events: List[Dict[str, Any]] = []
        alerts_observed = 0

        if assessment.dataset_id:
            obs_q = db.query(SecurityEvent).filter(SecurityEvent.dataset_id == assessment.dataset_id)
            if assessment.comparison_window_start:
                obs_q = obs_q.filter(SecurityEvent.occurred_at >= assessment.comparison_window_start)
            if assessment.comparison_window_end:
                obs_q = obs_q.filter(SecurityEvent.occurred_at <= assessment.comparison_window_end)
            elif assessment.baseline_window_end:
                # If baseline end defined but no comparison window specified, observe after baseline
                obs_q = obs_q.filter(SecurityEvent.occurred_at > assessment.baseline_window_end)

            obs_events = [
                {
                    "event_type": e.event_type,
                    "source": e.source,
                    "source_system": e.source_system,
                    "severity": e.severity,
                    "asset_id": e.asset_id,
                    "user_identifier": e.user_identifier,
                    "action": e.action,
                }
                for e in obs_q.limit(5000).all()
            ]

            # Count alerts
            alerts_q = db.query(Alert)
            if assessment.organization_id:
                alerts_q = alerts_q.filter(Alert.organization_id == assessment.organization_id)
            alerts_observed = alerts_q.count()

        observed_profile = NegativeSpaceEngine.calculate_observed(obs_events)
        assessment.observed_activity_definition = observed_profile

        # Step 3: Execute Negative Space Engine
        raw_signals, summary = NegativeSpaceEngine.analyze_negative_space(
            expected=expected_profile,
            observed=observed_profile,
            config=cfg,
            alerts_observed_count=alerts_observed,
            dataset_quality_score=dq_score,
            dataset_quality_rating=dq_rating,
            time_window_start=assessment.comparison_window_start,
            time_window_end=assessment.comparison_window_end,
        )

        # Clear existing unvalidated signals if re-running
        db.query(NegativeSpaceSignal).filter(
            NegativeSpaceSignal.assessment_id == assessment.id,
            NegativeSpaceSignal.status.in_(["DETECTED", "REVIEWING"]),
        ).delete(synchronize_session=False)

        # Step 4: Persist generated signals
        created_signals = []
        for idx, s in enumerate(raw_signals):
            sig_bid = cls._generate_business_id("NSS", NegativeSpaceSignal, db, offset=idx)
            sig = NegativeSpaceSignal(
                business_id=sig_bid,
                assessment_id=assessment.id,
                category=s["category"],
                expected_activity=s.get("expected_activity"),
                observed_activity=s.get("observed_activity"),
                gap_description=s["gap_description"],
                gap_percentage=s.get("gap_percentage", 0.0),
                severity=s.get("severity", "MEDIUM"),
                confidence=s.get("confidence", "MEDIUM"),
                time_window_start=s.get("time_window_start"),
                time_window_end=s.get("time_window_end"),
                affected_asset=s.get("affected_asset"),
                affected_user=s.get("affected_user"),
                source=s.get("source"),
                supporting_event_refs=s.get("supporting_event_refs"),
                data_quality_concern=s.get("data_quality_concern", False),
                data_quality_notes=s.get("data_quality_notes"),
                status="DETECTED",
            )
            db.add(sig)
            created_signals.append(sig)

        # Step 5: Update Assessment State
        assessment.gap_count = len(created_signals)
        assessment.signal_count = len(created_signals)
        assessment.potential_missed_threat_count = summary.get("potential_missed_threat_count", 0)
        assessment.assessment_summary = summary
        assessment.completed_at = datetime.now(timezone.utc)
        assessment.status = "COMPLETED" if len(created_signals) == 0 else "REVIEW_REQUIRED"

        # Audit Log
        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_ASSESSMENT_EXECUTED",
                resource_type="negative_space_assessment",
                resource_id=assessment.id,
                new_value={
                    "signals_count": len(created_signals),
                    "potential_missed_threat_count": assessment.potential_missed_threat_count,
                    "status": assessment.status,
                },
            )
        )

        # Notification for user
        db.add(
            Notification(
                recipient_id=current_user.id,
                type="NEGATIVE_SPACE_EXECUTION_COMPLETED",
                title=f"Negative Space Assessment {assessment.business_id} Completed",
                message=(
                    f"Assessment '{assessment.name}' completed with {len(created_signals)} signals detected. "
                    f"Status is now {assessment.status}."
                ),
            )
        )

        db.commit()
        db.refresh(assessment)
        return assessment

    # =========================================================================
    # SIGNAL OPERATIONS & HUMAN REVIEW WORKSPACE
    # =========================================================================

    @classmethod
    def get_signal(
        cls,
        db: Session,
        signal_id: uuid.UUID,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceSignal:
        query = db.query(NegativeSpaceSignal).filter(NegativeSpaceSignal.id == signal_id)
        query = cls._apply_scope_filter(query, NegativeSpaceSignal, current_user, effective_scope)
        signal = query.first()
        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Negative space signal '{signal_id}' not found or inaccessible",
            )
        return signal

    @classmethod
    def list_signals(
        cls,
        db: Session,
        current_user: User,
        effective_scope: str,
        assessment_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        status_filter: Optional[str] = None,
        data_quality_concern: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[NegativeSpaceSignal], int]:
        query = db.query(NegativeSpaceSignal)
        query = cls._apply_scope_filter(query, NegativeSpaceSignal, current_user, effective_scope)

        if assessment_id:
            query = query.filter(NegativeSpaceSignal.assessment_id == assessment_id)
        if category:
            query = query.filter(NegativeSpaceSignal.category == category)
        if severity:
            query = query.filter(NegativeSpaceSignal.severity == severity)
        if status_filter:
            query = query.filter(NegativeSpaceSignal.status == status_filter)
        if data_quality_concern is not None:
            query = query.filter(NegativeSpaceSignal.data_quality_concern == data_quality_concern)
        if search:
            search_like = f"%{search}%"
            query = query.filter(
                or_(
                    NegativeSpaceSignal.business_id.ilike(search_like),
                    NegativeSpaceSignal.gap_description.ilike(search_like),
                    NegativeSpaceSignal.category.ilike(search_like),
                    NegativeSpaceSignal.affected_asset.ilike(search_like),
                    NegativeSpaceSignal.source.ilike(search_like),
                )
            )

        total = query.count()
        items = query.order_by(desc(NegativeSpaceSignal.created_at)).offset(skip).limit(limit).all()
        return items, total

    @classmethod
    def review_signal(
        cls,
        db: Session,
        signal_id: uuid.UUID,
        req: NegativeSpaceSignalReviewRequest,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceSignal:
        signal = cls.get_signal(db, signal_id, current_user, effective_scope)

        if signal.status in ["DISMISSED", "CONVERTED_TO_FINDING"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review signal with terminal status '{signal.status}'",
            )

        old_status = signal.status
        signal.status = "REVIEWING"
        signal.reviewed_by_id = current_user.id
        signal.review_comments = req.review_comments
        signal.reviewed_at = datetime.now(timezone.utc)

        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_SIGNAL_REVIEWED",
                resource_type="negative_space_signal",
                resource_id=signal.id,
                old_value={"status": old_status},
                new_value={"status": signal.status, "comments": req.review_comments},
            )
        )
        db.commit()
        db.refresh(signal)
        return signal

    @classmethod
    def validate_signal(
        cls,
        db: Session,
        signal_id: uuid.UUID,
        req: NegativeSpaceSignalValidateRequest,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceSignal:
        signal = cls.get_signal(db, signal_id, current_user, effective_scope)

        if signal.status in ["DISMISSED", "CONVERTED_TO_FINDING"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot validate signal with terminal status '{signal.status}'",
            )

        old_status = signal.status
        signal.status = "VALIDATED"
        signal.reviewed_by_id = current_user.id
        signal.reviewed_at = datetime.now(timezone.utc)
        if req.notes:
            existing_comm = signal.review_comments or ""
            signal.review_comments = (
                f"{existing_comm}\n[Validation Note]: {req.notes}".strip()
            )
        if req.severity:
            signal.severity = req.severity

        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_SIGNAL_VALIDATED",
                resource_type="negative_space_signal",
                resource_id=signal.id,
                old_value={"status": old_status},
                new_value={"status": "VALIDATED", "severity": signal.severity},
            )
        )
        db.commit()
        db.refresh(signal)
        return signal

    @classmethod
    def dismiss_signal(
        cls,
        db: Session,
        signal_id: uuid.UUID,
        req: NegativeSpaceSignalDismissRequest,
        current_user: User,
        effective_scope: str,
    ) -> NegativeSpaceSignal:
        signal = cls.get_signal(db, signal_id, current_user, effective_scope)

        if signal.status == "CONVERTED_TO_FINDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot dismiss a signal that has already been converted to a Finding",
            )

        old_status = signal.status
        signal.status = "DISMISSED"
        signal.dismissal_reason = req.dismissal_reason
        signal.reviewed_by_id = current_user.id
        signal.reviewed_at = datetime.now(timezone.utc)

        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_SIGNAL_DISMISSED",
                resource_type="negative_space_signal",
                resource_id=signal.id,
                old_value={"status": old_status},
                new_value={"status": "DISMISSED", "dismissal_reason": req.dismissal_reason},
            )
        )
        db.commit()
        db.refresh(signal)
        return signal

    @classmethod
    def convert_signal_to_finding(
        cls,
        db: Session,
        signal_id: uuid.UUID,
        req: NegativeSpaceSignalConvertFindingRequest,
        current_user: User,
        effective_scope: str,
    ) -> Tuple[NegativeSpaceSignal, Finding]:
        signal = cls.get_signal(db, signal_id, current_user, effective_scope)

        if signal.status == "CONVERTED_TO_FINDING" and signal.converted_finding_id:
            existing_finding = db.query(Finding).filter(Finding.id == signal.converted_finding_id).first()
            if existing_finding:
                return signal, existing_finding

        if signal.status == "DISMISSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot convert a dismissed signal to a Finding without re-validation",
            )

        assessment = signal.assessment

        # Generate Finding Business ID
        fnd_bid = cls._generate_business_id("FND", Finding, db)

        title = req.title or f"[Negative-Space] {signal.category.replace('_', ' ').title()}: {signal.gap_description[:90]}..."
        description = (
            req.description
            or (
                f"Negative-Space Assessment finding generated from signal {signal.business_id}.\n\n"
                f"**Category:** {signal.category}\n"
                f"**Gap Description:** {signal.gap_description}\n"
                f"**Gap Magnitude:** {signal.gap_percentage}%\n"
                f"**Confidence:** {signal.confidence}\n"
                f"**Data Quality Concern:** {'YES - ' + str(signal.data_quality_notes) if signal.data_quality_concern else 'NO'}\n\n"
                f"**Expected Telemetry:** {signal.expected_activity}\n"
                f"**Observed Telemetry:** {signal.observed_activity}"
            )
        )

        finding = Finding(
            business_id=fnd_bid,
            title=title,
            description=description,
            severity=req.severity or signal.severity,
            priority=req.priority or "MEDIUM",
            status="IDENTIFIED",
            classification="Coverage Gap",
            source_type="NEGATIVE_SPACE",
            source_id=signal.id,
            organization_id=assessment.organization_id,
            sector_id=assessment.sector_id,
            created_by_id=current_user.id,
            assigned_to_id=req.assigned_to_id,
            assigned_by_id=current_user.id if req.assigned_to_id else None,
            assigned_at=datetime.now(timezone.utc) if req.assigned_to_id else None,
            due_date=req.due_date,
            remediation_required=req.remediation_required,
        )

        db.add(finding)
        db.flush()

        # Link finding to signal
        signal.converted_finding_id = finding.id
        signal.status = "CONVERTED_TO_FINDING"
        signal.reviewed_by_id = current_user.id
        signal.reviewed_at = datetime.now(timezone.utc)

        # Audit Logs
        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="NEGATIVE_SPACE_SIGNAL_CONVERTED_TO_FINDING",
                resource_type="negative_space_signal",
                resource_id=signal.id,
                new_value={"finding_id": str(finding.id), "finding_business_id": fnd_bid},
            )
        )
        db.add(
            AuditLog(
                actor_user_id=current_user.id,
                action="FINDING_CREATED_FROM_NEGATIVE_SPACE",
                resource_type="finding",
                resource_id=finding.id,
                new_value={"business_id": fnd_bid, "source_signal_id": str(signal.id)},
            )
        )

        # Notification
        db.add(
            Notification(
                recipient_id=current_user.id,
                type="NEGATIVE_SPACE_FINDING_CREATED",
                title=f"Finding {fnd_bid} Created from Negative-Space Signal",
                message=f"Signal {signal.business_id} converted to Finding {fnd_bid} with severity {finding.severity}.",
            )
        )

        db.commit()
        db.refresh(signal)
        db.refresh(finding)
        return signal, finding

    # =========================================================================
    # KPIS AND ANALYTICS
    # =========================================================================

    @classmethod
    def get_kpis(
        cls,
        db: Session,
        current_user: User,
        effective_scope: str,
    ) -> Dict[str, Any]:
        asmt_q = db.query(NegativeSpaceAssessment)
        asmt_q = cls._apply_scope_filter(asmt_q, NegativeSpaceAssessment, current_user, effective_scope)
        total_assessments = asmt_q.count()

        sig_q = db.query(NegativeSpaceSignal)
        sig_q = cls._apply_scope_filter(sig_q, NegativeSpaceSignal, current_user, effective_scope)

        total_signals = sig_q.count()
        active_signals = sig_q.filter(NegativeSpaceSignal.status.in_(["DETECTED", "REVIEWING"])).count()
        validated_signals = sig_q.filter(NegativeSpaceSignal.status == "VALIDATED").count()
        dismissed_signals = sig_q.filter(NegativeSpaceSignal.status == "DISMISSED").count()
        converted_findings = sig_q.filter(NegativeSpaceSignal.status == "CONVERTED_TO_FINDING").count()
        high_crit = sig_q.filter(NegativeSpaceSignal.severity.in_(["HIGH", "CRITICAL"])).count()
        dq_concerns = sig_q.filter(NegativeSpaceSignal.data_quality_concern == True).count()

        # Group by category
        by_cat_rows = (
            sig_q.with_entities(NegativeSpaceSignal.category, func.count(NegativeSpaceSignal.id))
            .group_by(NegativeSpaceSignal.category)
            .all()
        )
        by_category = {cat: count for cat, count in by_cat_rows}

        # Group by severity
        by_sev_rows = (
            sig_q.with_entities(NegativeSpaceSignal.severity, func.count(NegativeSpaceSignal.id))
            .group_by(NegativeSpaceSignal.severity)
            .all()
        )
        by_severity = {sev: count for sev, count in by_sev_rows}

        return {
            "total_assessments": total_assessments,
            "total_signals": total_signals,
            "active_signals": active_signals,
            "validated_signals": validated_signals,
            "dismissed_signals": dismissed_signals,
            "converted_to_findings": converted_findings,
            "high_critical_signals": high_crit,
            "data_quality_concerns": dq_concerns,
            "by_category": by_category,
            "by_severity": by_severity,
        }
