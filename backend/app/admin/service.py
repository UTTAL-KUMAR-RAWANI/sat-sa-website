import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
from fastapi import HTTPException, status

from app.models.identity import User, Role, Permission, Department, UserRole, RolePermission
from app.models.organization import Organization, Sector
from app.models.access import AccessRequest
from app.models.audit import AuditLog
from app.models.system import SystemSetting
from app.core.security import get_password_hash
from app.rbac.service import AuthorizationService
from app.rbac.scopes import ScopeType
from app.admin import schemas

class AdminService:

    # --- Audit Logger Helper ---
    @staticmethod
    def _log_audit(
        db: Session,
        actor: User,
        action: str,
        resource_type: str,
        resource_id: Optional[uuid.UUID],
        old_val: Optional[Dict] = None,
        new_val: Optional[Dict] = None
    ):
        log = AuditLog(
            actor_user_id=actor.id if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_val,
            new_value=new_val
        )
        db.add(log)
        db.flush()

    # --- Dashboard Stats ---
    @classmethod
    def get_dashboard_stats(cls, db: Session) -> schemas.AdminDashboardStats:
        total_users = db.query(func.count(User.id)).scalar() or 0
        active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
        inactive_users = total_users - active_users
        total_orgs = db.query(func.count(Organization.id)).scalar() or 0
        total_sectors = db.query(func.count(Sector.id)).scalar() or 0
        total_depts = db.query(func.count(Department.id)).scalar() or 0
        total_roles = db.query(func.count(Role.id)).scalar() or 0
        pending_requests = db.query(func.count(AccessRequest.id)).filter(AccessRequest.status == "PENDING").scalar() or 0

        # Recent audit logs
        recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5).all()
        recent_audit_actions = []
        for l in recent_logs:
            actor = db.query(User).filter(User.id == l.actor_user_id).first() if l.actor_user_id else None
            recent_audit_actions.append({
                "id": str(l.id),
                "action": l.action,
                "resource_type": l.resource_type,
                "actor_email": actor.email if actor else "System",
                "timestamp": l.created_at.isoformat() if l.created_at else None
            })

        # DB connection test
        db_connected = True
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            db_connected = False

        return schemas.AdminDashboardStats(
            total_users=total_users,
            active_users=active_users,
            inactive_users=inactive_users,
            total_organizations=total_orgs,
            total_sectors=total_sectors,
            total_departments=total_depts,
            total_roles=total_roles,
            pending_access_requests=pending_requests,
            system_status="HEALTHY" if db_connected else "DEGRADED",
            database_connected=db_connected,
            recent_audit_actions=recent_audit_actions
        )

    # --- Users ---
    @classmethod
    def list_users(
        cls,
        db: Session,
        query: Optional[str] = None,
        role_id: Optional[str] = None,
        department_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[schemas.AdminUserResponse]:
        q = db.query(User)

        if query:
            search = f"%{query}%"
            q = q.filter(
                or_(
                    User.username.ilike(search),
                    User.email.ilike(search),
                    User.first_name.ilike(search),
                    User.last_name.ilike(search)
                )
            )

        if department_id:
            try:
                dept_uuid = uuid.UUID(department_id)
                q = q.filter(User.department_id == dept_uuid)
            except ValueError:
                pass

        if is_active is not None:
            q = q.filter(User.is_active == is_active)

        if role_id:
            try:
                r_uuid = uuid.UUID(role_id)
                q = q.join(User.roles).filter(Role.id == r_uuid)
            except ValueError:
                pass

        users = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

        results = []
        for u in users:
            dept = u.department
            org = u.organization
            sec = u.sector
            roles = [r.name for r in u.roles if r.is_active]
            scope = AuthorizationService.get_user_effective_scope(u)

            results.append(schemas.AdminUserResponse(
                id=str(u.id),
                username=u.username,
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                is_active=u.is_active,
                created_at=u.created_at,
                department_id=str(u.department_id) if u.department_id else None,
                department_name=dept.name if dept else None,
                organization_id=str(u.organization_id) if u.organization_id else None,
                organization_name=org.name if org else None,
                sector_id=str(u.sector_id) if u.sector_id else None,
                sector_name=sec.name if sec else None,
                roles=roles,
                scope=scope
            ))
        return results

    @classmethod
    def create_user(cls, db: Session, actor: User, req: schemas.CreateUserRequest) -> schemas.AdminUserResponse:
        # Check uniqueness
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already in use")
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already in use")

        dept_id = uuid.UUID(req.department_id) if req.department_id else None
        org_id = uuid.UUID(req.organization_id) if req.organization_id else None
        sec_id = uuid.UUID(req.sector_id) if req.sector_id else None

        new_user = User(
            username=req.username,
            email=req.email,
            password_hash=get_password_hash(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            is_active=True,
            department_id=dept_id,
            organization_id=org_id,
            sector_id=sec_id
        )
        db.add(new_user)
        db.flush()

        # Attach roles
        if req.role_ids:
            for rid in req.role_ids:
                try:
                    r_uuid = uuid.UUID(rid)
                    role = db.query(Role).filter(Role.id == r_uuid).first()
                    if role:
                        new_user.roles.append(role)
                except ValueError:
                    pass
            db.flush()

        cls._log_audit(
            db=db,
            actor=actor,
            action="USER_CREATED",
            resource_type="User",
            resource_id=new_user.id,
            new_val={"email": new_user.email, "username": new_user.username}
        )
        db.commit()

        dept = new_user.department
        org = new_user.organization
        sec = new_user.sector
        roles = [r.name for r in new_user.roles if r.is_active]
        scope = AuthorizationService.get_user_effective_scope(new_user)

        return schemas.AdminUserResponse(
            id=str(new_user.id),
            username=new_user.username,
            email=new_user.email,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            is_active=new_user.is_active,
            created_at=new_user.created_at,
            department_id=str(new_user.department_id) if new_user.department_id else None,
            department_name=dept.name if dept else None,
            organization_id=str(new_user.organization_id) if new_user.organization_id else None,
            organization_name=org.name if org else None,
            sector_id=str(new_user.sector_id) if new_user.sector_id else None,
            sector_name=sec.name if sec else None,
            roles=roles,
            scope=scope
        )

    @classmethod
    def update_user(cls, db: Session, actor: User, user_id: str, req: schemas.UpdateUserRequest) -> schemas.AdminUserResponse:
        u_uuid = uuid.UUID(user_id)
        user = db.query(User).filter(User.id == u_uuid).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        old_state = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "department_id": str(user.department_id) if user.department_id else None,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "sector_id": str(user.sector_id) if user.sector_id else None,
            "roles": [r.name for r in user.roles]
        }

        if req.first_name is not None:
            user.first_name = req.first_name
        if req.last_name is not None:
            user.last_name = req.last_name
        if req.email is not None and req.email != user.email:
            if db.query(User).filter(User.email == req.email, User.id != user.id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
            user.email = req.email

        if req.department_id is not None:
            user.department_id = uuid.UUID(req.department_id) if req.department_id else None
        if req.organization_id is not None:
            user.organization_id = uuid.UUID(req.organization_id) if req.organization_id else None
        if req.sector_id is not None:
            user.sector_id = uuid.UUID(req.sector_id) if req.sector_id else None

        if req.role_ids is not None:
            user.roles.clear()
            for rid in req.role_ids:
                try:
                    r_uuid = uuid.UUID(rid)
                    role = db.query(Role).filter(Role.id == r_uuid).first()
                    if role:
                        user.roles.append(role)
                except ValueError:
                    pass

        db.flush()
        new_state = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "department_id": str(user.department_id) if user.department_id else None,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "sector_id": str(user.sector_id) if user.sector_id else None,
            "roles": [r.name for r in user.roles]
        }

        cls._log_audit(
            db=db,
            actor=actor,
            action="USER_UPDATED",
            resource_type="User",
            resource_id=user.id,
            old_val=old_state,
            new_val=new_state
        )
        db.commit()

        dept = user.department
        org = user.organization
        sec = user.sector
        roles = [r.name for r in user.roles if r.is_active]
        scope = AuthorizationService.get_user_effective_scope(user)

        return schemas.AdminUserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            created_at=user.created_at,
            department_id=str(user.department_id) if user.department_id else None,
            department_name=dept.name if dept else None,
            organization_id=str(user.organization_id) if user.organization_id else None,
            organization_name=org.name if org else None,
            sector_id=str(user.sector_id) if user.sector_id else None,
            sector_name=sec.name if sec else None,
            roles=roles,
            scope=scope
        )

    @classmethod
    def toggle_user_status(cls, db: Session, actor: User, user_id: str, is_active: bool) -> schemas.AdminUserResponse:
        u_uuid = uuid.UUID(user_id)
        user = db.query(User).filter(User.id == u_uuid).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Prevent deactivating oneself
        if actor.id == user.id and not is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Administrators cannot deactivate their own account")

        user.is_active = is_active
        cls._log_audit(
            db=db,
            actor=actor,
            action="USER_ACTIVATED" if is_active else "USER_DEACTIVATED",
            resource_type="User",
            resource_id=user.id,
            new_val={"is_active": is_active}
        )
        db.commit()

        dept = user.department
        org = user.organization
        sec = user.sector
        roles = [r.name for r in user.roles if r.is_active]
        scope = AuthorizationService.get_user_effective_scope(user)

        return schemas.AdminUserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            created_at=user.created_at,
            department_id=str(user.department_id) if user.department_id else None,
            department_name=dept.name if dept else None,
            organization_id=str(user.organization_id) if user.organization_id else None,
            organization_name=org.name if org else None,
            sector_id=str(user.sector_id) if user.sector_id else None,
            sector_name=sec.name if sec else None,
            roles=roles,
            scope=scope
        )

    # --- Roles ---
    @classmethod
    def list_roles(cls, db: Session) -> List[schemas.AdminRoleResponse]:
        roles = db.query(Role).order_by(Role.name.asc()).all()
        results = []
        for r in roles:
            perm_count = len(r.permissions)
            user_count = len(r.users)
            perms = [p.name for p in r.permissions]
            results.append(schemas.AdminRoleResponse(
                id=str(r.id),
                name=r.name,
                description=r.description,
                scope_type=r.scope_type,
                is_active=r.is_active,
                permission_count=perm_count,
                assigned_users_count=user_count,
                permissions=perms
            ))
        return results

    @classmethod
    def update_role_permissions(cls, db: Session, actor: User, role_id: str, permission_ids: List[str]) -> schemas.AdminRoleResponse:
        r_uuid = uuid.UUID(role_id)
        role = db.query(Role).filter(Role.id == r_uuid).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

        # Validation: do not leave CSE Administrator with zero permissions
        if role.name == "CSE Administrator" and len(permission_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Safety check: Cannot revoke all permissions from platform administrator"
            )

        old_perms = [p.name for p in role.permissions]
        role.permissions.clear()

        for pid in permission_ids:
            try:
                p_uuid = uuid.UUID(pid)
                perm = db.query(Permission).filter(Permission.id == p_uuid).first()
                if perm:
                    role.permissions.append(perm)
            except ValueError:
                # If passed permission name instead of UUID
                perm = db.query(Permission).filter(Permission.name == pid).first()
                if perm:
                    role.permissions.append(perm)

        db.flush()
        new_perms = [p.name for p in role.permissions]

        cls._log_audit(
            db=db,
            actor=actor,
            action="ROLE_PERMISSIONS_CHANGED",
            resource_type="Role",
            resource_id=role.id,
            old_val={"permissions": old_perms},
            new_val={"permissions": new_perms}
        )
        db.commit()

        return schemas.AdminRoleResponse(
            id=str(role.id),
            name=role.name,
            description=role.description,
            scope_type=role.scope_type,
            is_active=role.is_active,
            permission_count=len(role.permissions),
            assigned_users_count=len(role.users),
            permissions=new_perms
        )

    # --- Permissions Grouped Catalog ---
    @classmethod
    def list_permissions(cls, db: Session) -> List[schemas.GroupedPermissionsResponse]:
        all_perms = db.query(Permission).order_by(Permission.name.asc()).all()
        categories = {
            "Platform & Administration": ["users.", "roles.", "permissions.", "departments.", "organizations.", "sectors.", "access_requests.", "system_settings.", "system_status.", "audit_logs."],
            "Supervision & CSE": ["alerts.", "cse.", "investigations.", "evidence.", "supervision."],
            "Findings & Vulnerabilities": ["finding."],
            "Assessments & Controls": ["assessment.", "control."],
            "Risk & Governance": ["risk."],
            "Remediation & Operations": ["remediation.", "assignments."],
            "Analytics & Datasets": ["analytics.", "datasets.", "notifications."]
        }

        grouped: Dict[str, List[schemas.PermissionItem]] = {cat: [] for cat in categories}
        grouped["General"] = []

        for p in all_perms:
            assigned = False
            item = schemas.PermissionItem(id=str(p.id), name=p.name, description=p.description)
            for cat, prefixes in categories.items():
                if any(p.name.startswith(pfx) for pfx in prefixes):
                    grouped[cat].append(item)
                    assigned = True
                    break
            if not assigned:
                grouped["General"].append(item)

        return [
            schemas.GroupedPermissionsResponse(category=cat, permissions=items)
            for cat, items in grouped.items() if items
        ]

    # --- Departments ---
    @classmethod
    def list_departments(cls, db: Session) -> List[schemas.DepartmentResponse]:
        depts = db.query(Department).order_by(Department.name.asc()).all()
        results = []
        for d in depts:
            u_count = db.query(func.count(User.id)).filter(User.department_id == d.id).scalar() or 0
            results.append(schemas.DepartmentResponse(
                id=str(d.id),
                name=d.name,
                description=d.description,
                user_count=u_count
            ))
        return results

    @classmethod
    def create_department(cls, db: Session, actor: User, req: schemas.CreateDepartmentRequest) -> schemas.DepartmentResponse:
        existing = db.query(Department).filter(Department.name == req.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department with this name already exists")

        dept = Department(name=req.name, description=req.description)
        db.add(dept)
        db.flush()

        cls._log_audit(
            db=db,
            actor=actor,
            action="DEPARTMENT_CREATED",
            resource_type="Department",
            resource_id=dept.id,
            new_val={"name": dept.name}
        )
        db.commit()

        return schemas.DepartmentResponse(
            id=str(dept.id),
            name=dept.name,
            description=dept.description,
            user_count=0
        )

    # --- Organizations ---
    @classmethod
    def list_organizations(cls, db: Session) -> List[schemas.OrganizationResponse]:
        orgs = db.query(Organization).order_by(Organization.name.asc()).all()
        results = []
        for o in orgs:
            sec_count = len(o.sectors)
            u_count = db.query(func.count(User.id)).filter(User.organization_id == o.id).scalar() or 0
            results.append(schemas.OrganizationResponse(
                id=str(o.id),
                name=o.name,
                description=o.description,
                sector_count=sec_count,
                user_count=u_count
            ))
        return results

    @classmethod
    def create_organization(cls, db: Session, actor: User, req: schemas.CreateOrganizationRequest) -> schemas.OrganizationResponse:
        existing = db.query(Organization).filter(Organization.name == req.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization with this name already exists")

        org = Organization(name=req.name, description=req.description)
        db.add(org)
        db.flush()

        cls._log_audit(
            db=db,
            actor=actor,
            action="ORGANIZATION_CREATED",
            resource_type="Organization",
            resource_id=org.id,
            new_val={"name": org.name}
        )
        db.commit()

        return schemas.OrganizationResponse(
            id=str(org.id),
            name=org.name,
            description=org.description,
            sector_count=0,
            user_count=0
        )

    # --- Sectors ---
    @classmethod
    def list_sectors(cls, db: Session) -> List[schemas.SectorResponse]:
        sectors = db.query(Sector).order_by(Sector.name.asc()).all()
        results = []
        for s in sectors:
            org = s.organization
            u_count = db.query(func.count(User.id)).filter(User.sector_id == s.id).scalar() or 0
            results.append(schemas.SectorResponse(
                id=str(s.id),
                name=s.name,
                description=s.description,
                organization_id=str(s.organization_id),
                organization_name=org.name if org else None,
                user_count=u_count
            ))
        return results

    @classmethod
    def create_sector(cls, db: Session, actor: User, req: schemas.CreateSectorRequest) -> schemas.SectorResponse:
        org_uuid = uuid.UUID(req.organization_id)
        org = db.query(Organization).filter(Organization.id == org_uuid).first()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced Organization not found")

        sector = Sector(name=req.name, description=req.description, organization_id=org_uuid)
        db.add(sector)
        db.flush()

        cls._log_audit(
            db=db,
            actor=actor,
            action="SECTOR_CREATED",
            resource_type="Sector",
            resource_id=sector.id,
            new_val={"name": sector.name, "organization_id": str(org_uuid)}
        )
        db.commit()

        return schemas.SectorResponse(
            id=str(sector.id),
            name=sector.name,
            description=sector.description,
            organization_id=str(org.id),
            organization_name=org.name,
            user_count=0
        )

    # --- Access Requests ---
    @classmethod
    def list_access_requests(cls, db: Session, status_filter: Optional[str] = None) -> List[schemas.AccessRequestResponse]:
        q = db.query(AccessRequest)
        if status_filter:
            q = q.filter(AccessRequest.status == status_filter.upper())
        requests = q.order_by(AccessRequest.created_at.desc()).all()

        results = []
        for r in requests:
            req_user = r.requester
            req_role = r.requested_role
            req_org = r.requested_organization
            req_sec = r.requested_sector
            rev_user = r.reviewer

            req_name = f"{req_user.first_name or ''} {req_user.last_name or ''}".strip() or req_user.username if req_user else "Unknown"
            rev_name = f"{rev_user.first_name or ''} {rev_user.last_name or ''}".strip() or rev_user.username if rev_user else None

            results.append(schemas.AccessRequestResponse(
                id=str(r.id),
                requester_id=str(r.requester_id),
                requester_name=req_name,
                requester_email=req_user.email if req_user else "unknown@sat-sa.local",
                requested_role_id=str(r.requested_role_id) if r.requested_role_id else None,
                requested_role_name=req_role.name if req_role else None,
                requested_organization_id=str(r.requested_organization_id) if r.requested_organization_id else None,
                requested_organization_name=req_org.name if req_org else None,
                requested_sector_id=str(r.requested_sector_id) if r.requested_sector_id else None,
                requested_sector_name=req_sec.name if req_sec else None,
                status=r.status,
                reason=r.reason,
                reviewer_name=rev_name,
                created_at=r.created_at
            ))
        return results

    @classmethod
    def review_access_request(cls, db: Session, actor: User, request_id: str, review: schemas.ReviewAccessRequest) -> schemas.AccessRequestResponse:
        req_uuid = uuid.UUID(request_id)
        access_req = db.query(AccessRequest).filter(AccessRequest.id == req_uuid).first()
        if not access_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")

        if access_req.status != "PENDING":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot review request that is already {access_req.status}")

        decision = review.decision.upper()
        if decision not in ("APPROVE", "REJECT"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be APPROVE or REJECT")

        access_req.reviewer_id = actor.id

        if decision == "APPROVE":
            access_req.status = "APPROVED"
            # Immediately update the requester's actual User record in PostgreSQL!
            requester = access_req.requester
            if requester:
                if access_req.requested_role and access_req.requested_role not in requester.roles:
                    requester.roles.append(access_req.requested_role)
                if access_req.requested_organization_id:
                    requester.organization_id = access_req.requested_organization_id
                if access_req.requested_sector_id:
                    requester.sector_id = access_req.requested_sector_id
                db.flush()

            cls._log_audit(
                db=db,
                actor=actor,
                action="ACCESS_REQUEST_APPROVED",
                resource_type="AccessRequest",
                resource_id=access_req.id,
                new_val={"requester_id": str(access_req.requester_id), "comments": review.comments}
            )
        else:
            access_req.status = "REJECTED"
            cls._log_audit(
                db=db,
                actor=actor,
                action="ACCESS_REQUEST_REJECTED",
                resource_type="AccessRequest",
                resource_id=access_req.id,
                new_val={"requester_id": str(access_req.requester_id), "comments": review.comments}
            )

        db.commit()

        req_user = access_req.requester
        req_role = access_req.requested_role
        req_org = access_req.requested_organization
        req_sec = access_req.requested_sector
        req_name = f"{req_user.first_name or ''} {req_user.last_name or ''}".strip() or req_user.username if req_user else "Unknown"
        rev_name = f"{actor.first_name or ''} {actor.last_name or ''}".strip() or actor.username

        return schemas.AccessRequestResponse(
            id=str(access_req.id),
            requester_id=str(access_req.requester_id),
            requester_name=req_name,
            requester_email=req_user.email if req_user else "unknown@sat-sa.local",
            requested_role_id=str(access_req.requested_role_id) if access_req.requested_role_id else None,
            requested_role_name=req_role.name if req_role else None,
            requested_organization_id=str(access_req.requested_organization_id) if access_req.requested_organization_id else None,
            requested_organization_name=req_org.name if req_org else None,
            requested_sector_id=str(access_req.requested_sector_id) if access_req.requested_sector_id else None,
            requested_sector_name=req_sec.name if req_sec else None,
            status=access_req.status,
            reason=access_req.reason,
            reviewer_name=rev_name,
            created_at=access_req.created_at
        )

    # --- Audit Logs ---
    @classmethod
    def list_audit_logs(
        cls,
        db: Session,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> schemas.PaginatedAuditLogsResponse:
        q = db.query(AuditLog)

        if actor_id:
            try:
                a_uuid = uuid.UUID(actor_id)
                q = q.filter(AuditLog.actor_user_id == a_uuid)
            except ValueError:
                pass
        if action:
            q = q.filter(AuditLog.action == action)
        if resource_type:
            q = q.filter(AuditLog.resource_type == resource_type)

        total = q.count()
        logs = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

        results = []
        for l in logs:
            actor = db.query(User).filter(User.id == l.actor_user_id).first() if l.actor_user_id else None
            actor_name = f"{actor.first_name or ''} {actor.last_name or ''}".strip() or actor.username if actor else "System / Anonymous"
            
            # Sanitize old and new value display
            clean_details = {}
            if l.new_value:
                clean_details["changes"] = l.new_value
            elif l.old_value:
                clean_details["previous"] = l.old_value

            results.append(schemas.AuditLogResponse(
                id=str(l.id),
                actor_id=str(l.actor_user_id) if l.actor_user_id else None,
                actor_name=actor_name,
                actor_email=actor.email if actor else None,
                action=l.action,
                resource_type=l.resource_type,
                resource_id=str(l.resource_id) if l.resource_id else None,
                details=clean_details,
                created_at=l.created_at
            ))

        return schemas.PaginatedAuditLogsResponse(total=total, items=results)

    # --- System Settings ---
    @classmethod
    def list_system_settings(cls, db: Session) -> List[schemas.SystemSettingResponse]:
        settings = db.query(SystemSetting).order_by(SystemSetting.category.asc(), SystemSetting.key.asc()).all()
        return [
            schemas.SystemSettingResponse(
                id=str(s.id),
                key=s.key,
                value="********" if s.is_secret else s.value,
                category=s.category,
                description=s.description,
                is_secret=s.is_secret,
                updated_at=s.updated_at
            )
            for s in settings
        ]

    @classmethod
    def update_system_setting(cls, db: Session, actor: User, key: str, req: schemas.UpdateSettingRequest) -> schemas.SystemSettingResponse:
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"System setting '{key}' not found")

        old_val = setting.value
        setting.value = req.value
        db.flush()

        cls._log_audit(
            db=db,
            actor=actor,
            action="SYSTEM_SETTING_CHANGED",
            resource_type="SystemSetting",
            resource_id=setting.id,
            old_val={"key": setting.key, "value": "********" if setting.is_secret else old_val},
            new_val={"key": setting.key, "value": "********" if setting.is_secret else req.value}
        )
        db.commit()

        return schemas.SystemSettingResponse(
            id=str(setting.id),
            key=setting.key,
            value="********" if setting.is_secret else setting.value,
            category=setting.category,
            description=setting.description,
            is_secret=setting.is_secret,
            updated_at=setting.updated_at
        )

    # --- System Status ---
    @classmethod
    def get_system_status(cls, db: Session) -> schemas.SystemStatusResponse:
        start_time = time.time()
        db_ok = True
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            db_ok = False
        latency_ms = round((time.time() - start_time) * 1000, 2)

        # Connection pool check
        conn_count = 1
        try:
            conn_count = db.execute(text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();")).scalar() or 1
        except Exception:
            pass

        return schemas.SystemStatusResponse(
            status="HEALTHY" if db_ok else "CRITICAL",
            database_status="CONNECTED" if db_ok else "DISCONNECTED",
            database_latency_ms=latency_ms,
            server_time=datetime.now(timezone.utc),
            active_connections=conn_count,
            app_version="2.0.0-rc1",
            environment="Demonstration / Production-Ready"
        )
