from typing import Dict, Set, Optional
from fastapi import HTTPException, status
import uuid

# Allowed finding state transitions
FINDING_TRANSITIONS: Dict[str, Set[str]] = {
    "IDENTIFIED": {"DRAFT", "SUBMITTED", "REJECTED"},
    "DRAFT": {"SUBMITTED", "REJECTED"},
    "SUBMITTED": {"REVIEW", "REJECTED"},
    "REVIEW": {"CONFIRMED", "REJECTED", "DRAFT"},  # Transitioning to DRAFT represents "Changes Requested"
    "CONFIRMED": {"REMEDIATION_REQUIRED", "CLOSED"},
    "REMEDIATION_REQUIRED": {"REMEDIATION", "CLOSED"},
    "REMEDIATION": {"VALIDATION", "REMEDIATION_REQUIRED"},
    "VALIDATION": {"CLOSED", "REMEDIATION"},
    "CLOSED": {"REVIEW"},  # Controlled reopening
    "REJECTED": {"DRAFT"},  # Allow reopening for draft revisions
}

def validate_finding_transition(
    current_state: str,
    requested_state: str,
    creator_id: Optional[uuid.UUID],
    actor_id: uuid.UUID,
    is_admin: bool = False
) -> None:
    current = current_state.upper()
    requested = requested_state.upper()
    
    if current == requested:
        return
    
    allowed = FINDING_TRANSITIONS.get(current, set())
    if requested not in allowed:
        allowed_str = ", ".join(sorted(allowed)) if allowed else "none"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid finding state transition: Cannot transition from '{current}' to '{requested}'. Allowed transitions from '{current}': [{allowed_str}]."
        )
    
    # Separation of Duties Rule: Finding Creator ≠ Finding Approver/Reviewer
    # When a finding is submitted for review and a reviewer confirms or rejects it,
    # the creator CANNOT confirm or reject their own finding (unless system admin emergency override, but strict business rule applies).
    if requested in {"CONFIRMED", "REJECTED"} and current == "REVIEW":
        if creator_id and actor_id == creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Separation of Duties violation: The creator of a finding cannot confirm or reject their own finding. Independent review is required."
            )
