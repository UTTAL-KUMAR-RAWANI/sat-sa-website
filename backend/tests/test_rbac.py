import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User, Role
from app.models.audit import AuditLog
from app.models.security import CSE
from app.models.assessment import Assessment
from app.models.organization import Sector, Organization
from app.rbac.service import AuthorizationService
from app.rbac import permissions as p
from app.rbac.scopes import ScopeType

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.cookies.get("access_token")

def test_auth_me_returns_rbac_context():
    token = login_user("soc@sat-sa.local")
    response = client.get("/api/v1/auth/me", cookies={"access_token": token})
    assert response.status_code == 200
    data = response.json()

    assert data["email"] == "soc@sat-sa.local"
    assert "SOC Analyst" in data["roles"]
    assert data["department"] == "Operations"
    assert p.CSE_READ in data["permissions"]
    assert p.ALERTS_READ in data["permissions"]
    assert p.USERS_MANAGE not in data["permissions"]
    assert data["scope"] == ScopeType.ORGANIZATION
    assert data["organization_id"] is not None
    assert data["sector_id"] is not None

def test_admin_status_allowed_for_cse_admin():
    token = login_user("admin@sat-sa.local")
    response = client.get("/api/v1/rbac/admin/status", cookies={"access_token": token})
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"

def test_admin_status_forbidden_for_soc_analyst():
    token = login_user("soc@sat-sa.local")
    response = client.get("/api/v1/rbac/admin/status", cookies={"access_token": token})
    assert response.status_code == 403
    assert "forbidden" in response.json()["detail"].lower()

    # Verify audit log was recorded for the permission denial
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        log = db.query(AuditLog).filter(
            AuditLog.actor_user_id == user.id,
            AuditLog.action == "PERMISSION_DENIED"
        ).order_by(AuditLog.created_at.desc()).first()
        assert log is not None
        assert p.SYSTEM_STATUS_READ in str(log.new_value)
    finally:
        db.close()

def test_permission_check_endpoint():
    token = login_user("soc@sat-sa.local")
    
    # SOC Analyst has cse.read
    res1 = client.post(
        "/api/v1/rbac/check",
        json={"action": p.CSE_READ},
        cookies={"access_token": token}
    )
    assert res1.status_code == 200
    assert res1.json()["allowed"] is True

    # SOC Analyst does NOT have users.manage
    res2 = client.post(
        "/api/v1/rbac/check",
        json={"action": p.USERS_MANAGE},
        cookies={"access_token": token}
    )
    assert res2.status_code == 200
    assert res2.json()["allowed"] is False
    assert "lacks" in res2.json()["reason"]

def test_scope_authorization():
    db = SessionLocal()
    try:
        sup_user = db.query(User).filter(User.email == "supervision.analyst@sat-sa.local").first()
        assert sup_user is not None

        other_sector = db.query(Sector).filter(Sector.name == "Energy & Utilities").first()
        own_sector = db.query(Sector).filter(Sector.name == "Financial Services").first()
        assert other_sector is not None
        assert own_sector is not None

        # Resource in a different sector
        cse_diff_sector = CSE(
            business_id="CSE-TEST-DIFF-001",
            title="External Sector CSE",
            sector_id=other_sector.id
        )

        # Resource in user's sector
        cse_same_sector = CSE(
            business_id="CSE-TEST-SAME-001",
            title="Internal Sector CSE",
            sector_id=own_sector.id
        )

        # Authorized within sector
        allowed_same = AuthorizationService.authorize(
            user=sup_user,
            action=p.CSE_READ,
            resource=cse_same_sector,
            raise_exception=False
        )
        assert allowed_same is True

        # Blocked outside sector
        allowed_diff = AuthorizationService.authorize(
            user=sup_user,
            action=p.CSE_READ,
            resource=cse_diff_sector,
            raise_exception=False
        )
        assert allowed_diff is False
    finally:
        db.close()

def test_separation_of_duties():
    db = SessionLocal()
    try:
        assessor_user = db.query(User).filter(User.email == "assessor@sat-sa.local").first()
        assert assessor_user is not None

        # Create mock assessment authored by this assessor
        assessment = Assessment(
            business_id="ASM-TEST-SOD-001",
            title="Core Banking Review",
            assessor_id=assessor_user.id
        )

        # Even if assessor attempts to approve, separation of duties must block it
        conflict_detected = False
        try:
            AuthorizationService.authorize(
                user=assessor_user,
                action=p.ASSESSMENT_APPROVE,
                resource=assessment,
                raise_exception=True
            )
        except Exception as exc:
            conflict_detected = True

        assert conflict_detected is True
    finally:
        db.close()
