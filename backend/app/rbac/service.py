from typing import Any, Set, List
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.identity import User
from app.models.audit import AuditLog
from app.rbac.scopes import ScopeType, SCOPE_HIERARCHY, check_resource_scope
from app.rbac.separation import check_separation_of_duties

class AuthorizationService:
    @staticmethod
    def get_user_permissions(user: User) -> Set[str]:
        """Collects all unique granted permissions across user's active roles."""
        permissions: Set[str] = set()
        if not user or not user.is_active:
            return permissions

        for role in getattr(user, "roles", []):
            if role.is_active:
                for perm in getattr(role, "permissions", []):
                    permissions.add(perm.name)
        return permissions

    @staticmethod
    def get_user_effective_scope(user: User) -> str:
        """Determines the broadest effective scope among the user's active roles."""
        highest_scope = ScopeType.OWN.value
        highest_rank = SCOPE_HIERARCHY[ScopeType.OWN]

        for role in getattr(user, "roles", []):
            if role.is_active:
                raw_scope = getattr(role, "scope_type", None)
                if not raw_scope:
                    raw_scope = ScopeType.ORGANIZATION.value
                elif hasattr(raw_scope, "value"):
                    raw_scope = raw_scope.value
                elif "." in str(raw_scope):
                    raw_scope = str(raw_scope).split(".")[-1].lower()
                else:
                    raw_scope = str(raw_scope).lower()

                rank = SCOPE_HIERARCHY.get(raw_scope, 1)
                if rank > highest_rank:
                    highest_rank = rank
                    highest_scope = raw_scope

        return highest_scope

    @classmethod
    def authorize(
        cls,
        user: User,
        action: str,
        resource: Any = None,
        db: Session = None,
        raise_exception: bool = True
    ) -> bool:
        """
        Main authoritative evaluation engine:
        1. Action permission check
        2. Scope check against resource
        3. Separation of duties check
        4. Audit log emission upon rejection
        """
        if not user or not user.is_active:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            return False

        # 1. Permission check
        user_perms = cls.get_user_permissions(user)
        if action not in user_perms:
            cls._log_audit(db, user, "PERMISSION_DENIED", action, resource)
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Action '{action}' forbidden for current user"
                )
            return False

        # 2. Scope check
        effective_scope = cls.get_user_effective_scope(user)
        if resource is not None:
            if not check_resource_scope(user, effective_scope, resource):
                cls._log_audit(db, user, "SCOPE_DENIED", action, resource)
                if raise_exception:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access forbidden outside authorized scope"
                    )
                return False

        # 3. Separation of duties check
        if resource is not None:
            allowed, conflict_reason = check_separation_of_duties(user, action, resource)
            if not allowed:
                cls._log_audit(db, user, "SEPARATION_OF_DUTIES_DENIED", action, resource, conflict_reason)
                if raise_exception:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=conflict_reason or "Separation of duties constraint violated"
                    )
                return False

        return True

    @staticmethod
    def _log_audit(
        db: Session,
        user: User,
        event_action: str,
        requested_action: str,
        resource: Any = None,
        notes: str = None
    ) -> None:
        if db is not None and user is not None:
            try:
                res_type = type(resource).__name__ if resource else "Permission"
                res_id = getattr(resource, "id", None)
                if res_id and not isinstance(res_id, uuid.UUID):
                    try:
                        res_id = uuid.UUID(str(res_id))
                    except (ValueError, AttributeError):
                        res_id = None
                
                log = AuditLog(
                    actor_user_id=user.id,
                    action=event_action,
                    resource_type=res_type,
                    resource_id=res_id if isinstance(res_id, uuid.UUID) else None,
                    new_value={"denied_action": requested_action, "notes": notes or ""}
                )
                db.add(log)
                db.commit()
            except Exception as e:
                # Never let audit log failure mask the security denial
                db.rollback()
