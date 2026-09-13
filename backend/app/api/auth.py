from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.models.identity import User
from app.models.audit import AuditLog
from app.api.deps import get_current_user

from pydantic import BaseModel, EmailStr, ConfigDict
from app.rbac.service import AuthorizationService

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool
    roles: list[str] = []
    department: str | None = None
    permissions: list[str] = []
    scope: str
    organization_id: str | None = None
    sector_id: str | None = None

@router.post("/login")
def login(login_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    audit_log = AuditLog(
        actor_user_id=user.id,
        action="LOGIN",
        resource_type="User",
        resource_id=user.id
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Successfully logged in"}

@router.post("/logout")
def logout(response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    response.delete_cookie(key="access_token", httponly=True, samesite="lax")

    audit_log = AuditLog(
        actor_user_id=current_user.id,
        action="LOGOUT",
        resource_type="User",
        resource_id=current_user.id
    )
    db.add(audit_log)
    db.commit()

    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    roles = [role.name for role in current_user.roles if role.is_active]
    dept_name = current_user.department.name if current_user.department else None
    permissions = sorted(list(AuthorizationService.get_user_permissions(current_user)))
    scope = AuthorizationService.get_user_effective_scope(current_user)

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        roles=roles,
        department=dept_name,
        permissions=permissions,
        scope=str(scope),
        organization_id=str(current_user.organization_id) if current_user.organization_id else None,
        sector_id=str(current_user.sector_id) if current_user.sector_id else None,
    )
