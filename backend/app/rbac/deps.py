from typing import Callable, Any
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.identity import User
from app.rbac.service import AuthorizationService

def require_permission(permission: str) -> Callable:
    """FastAPI route dependency ensuring current user holds the required permission."""
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        AuthorizationService.authorize(
            user=current_user,
            action=permission,
            db=db,
            raise_exception=True
        )
        return current_user
    return dependency

def require_any_permission(*permissions: str) -> Callable:
    """FastAPI route dependency ensuring current user holds at least one of the specified permissions."""
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        user_perms = AuthorizationService.get_user_permissions(current_user)
        for perm in permissions:
            if perm in user_perms:
                return current_user
        
        # Log denial for first permission as reference
        if permissions:
            AuthorizationService._log_audit(db, current_user, "PERMISSION_DENIED", f"ANY_OF({','.join(permissions)})")
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Missing required permissions ({', '.join(permissions)})"
        )
    return dependency

def get_effective_scope(current_user: User = Depends(get_current_user)) -> str:
    """Dependency returning the user's effective scope as a string."""
    return AuthorizationService.get_user_effective_scope(current_user)
