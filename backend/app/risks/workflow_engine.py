from typing import Dict, List, Set
from fastapi import HTTPException, status
import uuid

class RiskStatus:
    IDENTIFIED = "IDENTIFIED"
    ASSESSED = "ASSESSED"
    TREATMENT_REQUIRED = "TREATMENT_REQUIRED"
    TREATMENT_PLANNED = "TREATMENT_PLANNED"
    MONITORED = "MONITORED"
    ACCEPTED = "ACCEPTED"
    CLOSED = "CLOSED"


class RiskExceptionStatus:
    REQUESTED = "REQUESTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CLOSED = "CLOSED"


RISK_TRANSITIONS: Dict[str, Set[str]] = {
    RiskStatus.IDENTIFIED: {RiskStatus.ASSESSED, RiskStatus.CLOSED},
    RiskStatus.ASSESSED: {RiskStatus.TREATMENT_REQUIRED, RiskStatus.ACCEPTED, RiskStatus.CLOSED},
    RiskStatus.TREATMENT_REQUIRED: {RiskStatus.TREATMENT_PLANNED, RiskStatus.ACCEPTED, RiskStatus.CLOSED},
    RiskStatus.TREATMENT_PLANNED: {RiskStatus.MONITORED, RiskStatus.TREATMENT_REQUIRED, RiskStatus.CLOSED},
    RiskStatus.MONITORED: {RiskStatus.CLOSED, RiskStatus.TREATMENT_REQUIRED, RiskStatus.ACCEPTED},
    RiskStatus.ACCEPTED: {RiskStatus.MONITORED, RiskStatus.TREATMENT_REQUIRED, RiskStatus.CLOSED},
    RiskStatus.CLOSED: {RiskStatus.IDENTIFIED, RiskStatus.TREATMENT_REQUIRED},
}

EXCEPTION_TRANSITIONS: Dict[str, Set[str]] = {
    RiskExceptionStatus.REQUESTED: {RiskExceptionStatus.UNDER_REVIEW, RiskExceptionStatus.APPROVED, RiskExceptionStatus.REJECTED, RiskExceptionStatus.CLOSED},
    RiskExceptionStatus.UNDER_REVIEW: {RiskExceptionStatus.APPROVED, RiskExceptionStatus.REJECTED, RiskExceptionStatus.CLOSED},
    RiskExceptionStatus.APPROVED: {RiskExceptionStatus.EXPIRED, RiskExceptionStatus.CLOSED},
    RiskExceptionStatus.REJECTED: {RiskExceptionStatus.CLOSED, RiskExceptionStatus.REQUESTED},
    RiskExceptionStatus.EXPIRED: {RiskExceptionStatus.CLOSED, RiskExceptionStatus.REQUESTED},
    RiskExceptionStatus.CLOSED: {RiskExceptionStatus.REQUESTED},
}


class RiskWorkflowEngine:
    @staticmethod
    def validate_risk_transition(current_state: str, target_state: str) -> None:
        curr = current_state.upper()
        target = target_state.upper()
        
        allowed = RISK_TRANSITIONS.get(curr, set())
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid risk lifecycle transition from '{curr}' to '{target}'. Allowed target states: {sorted(list(allowed))}."
            )

    @staticmethod
    def validate_risk_acceptance_sod(
        actor_id: uuid.UUID,
        identified_by_id: uuid.UUID | None,
        owner_id: uuid.UUID | None
    ) -> None:
        """
        Separation of Duties Check:
        The user who identified or owns the risk cannot self-approve its risk acceptance.
        """
        if identified_by_id and actor_id == identified_by_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Separation of Duties violation: The user who identified this risk cannot approve its risk acceptance. An independent authority (e.g. CISO or GRC Officer) must accept the risk."
            )
        if owner_id and actor_id == owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Separation of Duties violation: The assigned risk owner cannot approve their own risk acceptance. Independent formal authorization is required."
            )

    @staticmethod
    def validate_exception_transition(current_state: str, target_state: str) -> None:
        curr = current_state.upper()
        target = target_state.upper()
        
        allowed = EXCEPTION_TRANSITIONS.get(curr, set())
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid risk exception transition from '{curr}' to '{target}'. Allowed target states: {sorted(list(allowed))}."
            )

    @staticmethod
    def validate_exception_approval_sod(
        actor_id: uuid.UUID,
        requested_by_id: uuid.UUID
    ) -> None:
        """
        Separation of Duties Check:
        The user who requested the risk exception cannot approve or sign off their own exception.
        """
        if actor_id == requested_by_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Separation of Duties violation: The requester of a risk exception cannot approve or sign off their own exception. Independent supervisory authorization is required."
            )
