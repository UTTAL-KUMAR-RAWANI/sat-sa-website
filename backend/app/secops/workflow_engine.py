from typing import Dict, Set
from fastapi import HTTPException, status

ALERT_TRANSITIONS: Dict[str, Set[str]] = {
    "NEW": {"ACKNOWLEDGED", "TRIAGED", "ESCALATED", "CLOSED"},
    "ACKNOWLEDGED": {"TRIAGED", "ESCALATED", "CLOSED"},
    "TRIAGED": {"ESCALATED", "CLOSED"},
    "ESCALATED": {"TRIAGED", "CLOSED"},
    "CLOSED": {"NEW", "TRIAGED"},  # Allow reopening if needed
}

CSE_TRANSITIONS: Dict[str, Set[str]] = {
    "NEW": {"TRIAGED", "INVESTIGATING", "ESCALATED", "CLOSED"},
    "TRIAGED": {"INVESTIGATING", "ESCALATED", "CLOSED"},
    "INVESTIGATING": {"ESCALATED", "FINDING_IDENTIFIED", "UNDER_REVIEW", "RESOLVED", "CLOSED"},
    "ESCALATED": {"INVESTIGATING", "UNDER_REVIEW", "RESOLVED"},
    "FINDING_IDENTIFIED": {"REMEDIATION_REQUIRED", "UNDER_REVIEW", "RESOLVED"},
    "REMEDIATION_REQUIRED": {"UNDER_REVIEW", "RESOLVED"},
    "UNDER_REVIEW": {"RESOLVED", "INVESTIGATING"},
    "RESOLVED": {"CLOSED", "INVESTIGATING"},
    "CLOSED": {"INVESTIGATING"},
}

INVESTIGATION_TRANSITIONS: Dict[str, Set[str]] = {
    "OPEN": {"IN_PROGRESS", "CLOSED"},
    "IN_PROGRESS": {"ESCALATED", "CONCLUDED", "CLOSED"},
    "ESCALATED": {"IN_PROGRESS", "CONCLUDED"},
    "CONCLUDED": {"CLOSED", "IN_PROGRESS"},
    "CLOSED": {"IN_PROGRESS"},
}

ESCALATION_TRANSITIONS: Dict[str, Set[str]] = {
    "OPEN": {"ACKNOWLEDGED", "IN_REVIEW", "RESOLVED", "CLOSED"},
    "ACKNOWLEDGED": {"IN_REVIEW", "RESOLVED", "CLOSED"},
    "IN_REVIEW": {"RESOLVED", "CLOSED"},
    "RESOLVED": {"CLOSED"},
    "CLOSED": set(),
}

def validate_transition(resource_name: str, allowed_map: Dict[str, Set[str]], current_state: str, requested_state: str) -> None:
    current = current_state.upper()
    requested = requested_state.upper()
    
    if current == requested:
        return
    
    allowed = allowed_map.get(current, set())
    if requested not in allowed:
        allowed_str = ", ".join(sorted(allowed)) if allowed else "none"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {resource_name} state transition: Cannot transition from '{current}' to '{requested}'. Allowed transitions from '{current}': [{allowed_str}]."
        )
