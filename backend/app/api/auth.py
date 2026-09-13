from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.config import settings
import uuid
from app.models.identity import User, Role
from app.models.access import AccessRequest
from app.models.organization import Organization, Sector
from app.models.audit import AuditLog
from app.api.deps import get_current_user

from pydantic import BaseModel, EmailStr, ConfigDict
from app.rbac.service import AuthorizationService

router = APIRouter()

class PublicAccessRequestCreate(BaseModel):
    full_name: str
    email: EmailStr
    organization_name: str | None = None
    organization: str | None = None
    department_name: str | None = None
    department: str | None = None
    job_title: str | None = None
    requested_role: str | None = None
    role: str | None = None
    sector_name: str | None = None
    sector: str | None = None
    reason: str
    additional_notes: str | None = None

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

@router.post("/request-access")
def submit_access_request(req_data: PublicAccessRequestCreate, db: Session = Depends(get_db)):
    clean_email = req_data.email.strip().lower()
    
    # Split name into first and last name
    name_parts = req_data.full_name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # 1. Look up or create prospective user
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        base_username = clean_email.split("@")[0]
        existing_username = db.query(User).filter(User.username == base_username).first()
        username = base_username if not existing_username else f"{base_username}_{uuid.uuid4().hex[:6]}"
        
        user = User(
            email=clean_email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            is_active=False,  # Gated until administrator review
            password_hash=None
        )
        db.add(user)
        db.flush()
    else:
        # Update name if previously blank
        if not user.first_name and first_name:
            user.first_name = first_name
        if not user.last_name and last_name:
            user.last_name = last_name
        db.flush()
        
    # Resolve fields with aliases
    org_input = (req_data.organization_name or req_data.organization or "").strip()
    role_input = (req_data.requested_role or req_data.role or "").strip()
    sec_input = (req_data.sector_name or req_data.sector or "").strip()
    dept_input = (req_data.department_name or req_data.department or "").strip()

    # 2. Match requested role if specified
    matched_role = None
    if role_input:
        matched_role = db.query(Role).filter(Role.name.ilike(role_input)).first()
        
    # 3. Match organization if specified
    matched_org = None
    if org_input:
        matched_org = db.query(Organization).filter(Organization.name.ilike(f"%{org_input}%")).first()
        
    # 4. Match sector if specified
    matched_sec = None
    if sec_input:
        matched_sec = db.query(Sector).filter(Sector.name.ilike(f"%{sec_input}%")).first()
        
    # Build comprehensive reason details
    detailed_reason = req_data.reason.strip()
    extras = []
    if req_data.job_title:
        extras.append(f"Title: {req_data.job_title.strip()}")
    if dept_input:
        extras.append(f"Department: {dept_input}")
    if org_input and not matched_org:
        extras.append(f"Organization: {org_input}")
    if role_input and not matched_role:
        extras.append(f"Requested Role: {role_input}")
    if req_data.additional_notes:
        extras.append(f"Notes: {req_data.additional_notes.strip()}")
        
    if extras:
        detailed_reason += " [" + " | ".join(extras) + "]"
        
    # 5. Create AccessRequest with status PENDING
    access_req = AccessRequest(
        requester_id=user.id,
        requested_role_id=matched_role.id if matched_role else None,
        requested_organization_id=matched_org.id if matched_org else None,
        requested_sector_id=matched_sec.id if matched_sec else None,
        status="PENDING",
        reason=detailed_reason
    )
    db.add(access_req)
    db.flush()
    
    # 6. Immutable Audit Log
    audit = AuditLog(
        actor_user_id=user.id,
        action="ACCESS_REQUEST_SUBMITTED",
        resource_type="AccessRequest",
        resource_id=access_req.id
    )
    db.add(audit)
    db.commit()
    
    return {
        "status": "PENDING",
        "request_id": str(access_req.id),
        "message": "Access request submitted successfully. Your request has been queued for administrator review."
    }

