from typing import Optional, Set
from fastapi import HTTPException, status
from app.models.supervision import SupervisoryCase
from app.models.workflow import Escalation

class SupervisionWorkflowEngine:
    # Supervisory Case Transitions
    ALLOWED_CASE_TRANSITIONS = {
        "OPEN": {"ASSIGNED", "UNDER_REVIEW", "CLOSED"},
        "ASSIGNED": {"UNDER_REVIEW", "OPEN", "CLOSED"},
        "UNDER_REVIEW": {"RECOMMENDATION_READY", "AUTHORITY_REVIEW", "OPEN", "CLOSED"},
        "RECOMMENDATION_READY": {"AUTHORITY_REVIEW", "UNDER_REVIEW", "DECISION_REQUIRED", "ACTION_REQUIRED", "MONITORING", "CLOSED"},
        "AUTHORITY_REVIEW": {"DECISION_REQUIRED", "UNDER_REVIEW", "ACTION_REQUIRED", "MONITORING", "CLOSED"},
        "DECISION_REQUIRED": {"ACTION_REQUIRED", "MONITORING", "CLOSED", "UNDER_REVIEW"},
        "ACTION_REQUIRED": {"MONITORING", "UNDER_REVIEW", "CLOSED"},
        "MONITORING": {"CLOSED", "UNDER_REVIEW", "ACTION_REQUIRED"},
        "CLOSED": {"OPEN"},
    }

    # Escalation Transitions
    ALLOWED_ESCALATION_TRANSITIONS = {
        "OPEN": {"ACKNOWLEDGED", "IN_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"},
        "ACKNOWLEDGED": {"IN_REVIEW", "ACTION_REQUIRED", "RESOLVED", "CLOSED"},
        "IN_REVIEW": {"ACTION_REQUIRED", "RESOLVED", "CLOSED"},
        "ACTION_REQUIRED": {"IN_REVIEW", "RESOLVED", "CLOSED"},
        "RESOLVED": {"CLOSED", "IN_REVIEW"},
        "CLOSED": {"OPEN"},
    }

    VALID_DECISION_TYPES = {
        "CLOSE",
        "CONTINUE_MONITORING",
        "REQUIRE_ACTION",
        "ESCALATE",
        "ACCEPT_RISK",
        "REQUEST_REVIEW",
    }

    @classmethod
    def validate_case_transition(cls, current_status: str, target_status: str) -> None:
        if current_status == target_status:
            return
        allowed = cls.ALLOWED_CASE_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid supervisory case status transition from '{current_status}' to '{target_status}'. Allowed: {sorted(list(allowed))}"
            )

    @classmethod
    def validate_escalation_transition(cls, current_status: str, target_status: str) -> None:
        if current_status == target_status:
            return
        allowed = cls.ALLOWED_ESCALATION_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid escalation status transition from '{current_status}' to '{target_status}'. Allowed: {sorted(list(allowed))}"
            )

    @classmethod
    def validate_authority_decision_sod(cls, actor_id: any, case: SupervisoryCase) -> None:
        """
        Separation of Duties (SoD) Rule:
        Supervision Analyst who reviewed and submitted the recommendation cannot approve
        or render the final supervisory authority decision on their own recommendation.
        """
        if case.assigned_analyst_id and str(actor_id) == str(case.assigned_analyst_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SEPARATION_OF_DUTIES_VIOLATION: The assigned Supervision Analyst cannot issue the final supervisory decision on their own recommendation."
            )
        if case.created_by_id and str(actor_id) == str(case.created_by_id) and case.assigned_analyst_id is None:
            # If the analyst created the case and directly attempts authority decision without independent authority
            pass
