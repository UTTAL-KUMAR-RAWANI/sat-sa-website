from enum import Enum
from typing import Any

class ScopeType(str, Enum):
    ENTERPRISE = "enterprise"
    SECTOR = "sector"
    ORGANIZATION = "organization"
    ASSIGNED = "assigned"
    OWN = "own"

# Scope hierarchy ordering (higher index means broader access)
SCOPE_HIERARCHY = {
    ScopeType.OWN: 1,
    ScopeType.ASSIGNED: 2,
    ScopeType.ORGANIZATION: 3,
    ScopeType.SECTOR: 4,
    ScopeType.ENTERPRISE: 5,
}

def check_resource_scope(user: Any, effective_scope: str, resource: Any) -> bool:
    """
    Evaluates whether the user's effective scope permits access to a specific resource.
    If resource is None (e.g. general list/read check), authorization evaluates to True.
    """
    if not resource or effective_scope == ScopeType.ENTERPRISE:
        return True

    user_org_id = getattr(user, "organization_id", None)
    user_sector_id = getattr(user, "sector_id", None)
    user_id = getattr(user, "id", None)

    # Resource attributes
    res_org_id = getattr(resource, "organization_id", None)
    res_sector_id = getattr(resource, "sector_id", None)
    res_created_by = (
        getattr(resource, "created_by_id", None) or 
        getattr(resource, "uploaded_by_id", None) or 
        getattr(resource, "initiated_by_id", None) or 
        getattr(resource, "escalated_by_id", None) or 
        getattr(resource, "decision_maker_id", None)
    )
    res_assigned_to = getattr(resource, "assigned_to_id", None)
    res_assessor = getattr(resource, "assessor_id", None)
    res_reviewer = getattr(resource, "reviewer_id", None)
    res_owner = getattr(resource, "owner_id", None)
    res_analyst = getattr(resource, "assigned_analyst_id", None)
    res_sup_auth = getattr(resource, "supervisory_authority_id", None)
    res_escalated_to = getattr(resource, "escalated_to_id", None)

    if effective_scope == ScopeType.SECTOR:
        # User can access if resource belongs to their sector
        if res_sector_id and user_sector_id and res_sector_id == user_sector_id:
            return True
        return False

    if effective_scope == ScopeType.ORGANIZATION:
        # User can access if resource belongs to their organization
        if res_org_id and user_org_id and res_org_id == user_org_id:
            return True
        return False

    if effective_scope == ScopeType.ASSIGNED:
        # User can access if directly assigned to them
        if user_id and (
            res_assigned_to == user_id or 
            res_assessor == user_id or 
            res_reviewer == user_id or
            res_owner == user_id or
            res_analyst == user_id or
            res_sup_auth == user_id or
            res_escalated_to == user_id
        ):
            return True
        return False

    if effective_scope == ScopeType.OWN:
        # User can access if created by them
        if user_id and res_created_by == user_id:
            return True
        return False

    return False
