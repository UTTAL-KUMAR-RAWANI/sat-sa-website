from typing import Any, Tuple
from app.rbac import permissions

def check_separation_of_duties(user: Any, action: str, resource: Any) -> Tuple[bool, str | None]:
    """
    Enforces separation-of-duty constraints.
    Returns (True, None) if compliant, or (False, "Conflict description") if violation detected.
    """
    if not resource:
        return True, None

    user_id = getattr(user, "id", None)
    if not user_id:
        return False, "Invalid user identifier"

    # Rule 1: Assessor cannot approve or reject their own assessment
    if action in (permissions.ASSESSMENT_APPROVE, permissions.ASSESSMENT_REJECT):
        assessor_id = getattr(resource, "assessor_id", None)
        created_by_id = getattr(resource, "created_by_id", None)
        if assessor_id == user_id or created_by_id == user_id:
            return False, "Separation of duties: An assessor cannot approve or reject their own assessment"

    # Rule 2: Finding creator cannot approve their own finding
    if action in (permissions.FINDING_APPROVE, permissions.FINDING_REJECT):
        created_by_id = getattr(resource, "created_by_id", None)
        if created_by_id == user_id:
            return False, "Separation of duties: A finding creator cannot approve or reject their own finding"

    # Rule 3: Remediation owner/assignee cannot validate or close their own remediation task
    if action in (permissions.REMEDIATION_VALIDATE, permissions.REMEDIATION_CLOSE):
        assigned_to_id = getattr(resource, "assigned_to_id", None)
        created_by_id = getattr(resource, "created_by_id", None)
        if assigned_to_id == user_id or created_by_id == user_id:
            return False, "Separation of duties: Remediation owners cannot validate or close their own remediation actions"

    return True, None
