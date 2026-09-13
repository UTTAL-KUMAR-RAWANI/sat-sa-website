import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User, Role
from app.models.access import AccessRequest
from app.models.audit import AuditLog
from app.models.system import SystemSetting

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.cookies.get("access_token")

def test_admin_dashboard_stats_for_cse_admin():
    token = login_user("admin@sat-sa.local")
    res = client.get("/api/v1/admin/dashboard", cookies={"access_token": token})
    assert res.status_code == 200
    data = res.json()
    assert data["total_users"] >= 10
    assert data["database_connected"] is True
    assert data["system_status"] == "HEALTHY"
    assert "recent_audit_actions" in data

def test_admin_dashboard_stats_forbidden_for_soc_analyst():
    token = login_user("soc@sat-sa.local")
    res = client.get("/api/v1/admin/dashboard", cookies={"access_token": token})
    assert res.status_code == 403

def test_admin_user_crud_lifecycle():
    token = login_user("admin@sat-sa.local")
    
    # 1. List users
    res_list = client.get("/api/v1/admin/users?limit=5", cookies={"access_token": token})
    assert res_list.status_code == 200
    users_data = res_list.json()
    assert len(users_data) > 0

    import uuid as py_uuid
    rand_id = py_uuid.uuid4().hex[:8]
    new_username = f"auditor_{rand_id}"
    new_email = f"auditor_{rand_id}@sat-sa.local"
    res_create = client.post(
        "/api/v1/admin/users",
        json={
            "username": new_username,
            "email": new_email,
            "password": "TemporaryPassword123!",
            "first_name": "Test",
            "last_name": "Auditor",
            "role_ids": []
        },
        cookies={"access_token": token}
    )
    assert res_create.status_code == 200
    created_user = res_create.json()
    user_id = created_user["id"]
    assert created_user["email"] == new_email
    assert created_user["is_active"] is True

    # 3. Deactivate user
    res_toggle = client.post(
        f"/api/v1/admin/users/{user_id}/status",
        json={"is_active": False},
        cookies={"access_token": token}
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_active"] is False

    # 4. Verify audit log was recorded
    db = SessionLocal()
    try:
        log_create = db.query(AuditLog).filter(
            AuditLog.action == "USER_CREATED",
            AuditLog.resource_id == user_id
        ).first()
        assert log_create is not None

        log_deactivate = db.query(AuditLog).filter(
            AuditLog.action == "USER_DEACTIVATED",
            AuditLog.resource_id == user_id
        ).first()
        assert log_deactivate is not None
    finally:
        db.close()

def test_admin_access_request_approval_flow():
    token = login_user("admin@sat-sa.local")
    db = SessionLocal()
    try:
        # Create a fresh pending request for idempotency
        soc_user = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        grc_role = db.query(Role).filter(Role.name == "GRC/Risk Officer").first()
        assert soc_user is not None
        assert grc_role is not None

        fresh_req = AccessRequest(
            requester_id=soc_user.id,
            requested_role_id=grc_role.id,
            status="PENDING",
            reason="Automated test role escalation request."
        )
        db.add(fresh_req)
        db.commit()
        db.refresh(fresh_req)
        target_req_id = str(fresh_req.id)
    finally:
        db.close()

    # 1. List pending requests
    res_reqs = client.get("/api/v1/admin/access-requests?status=PENDING", cookies={"access_token": token})
    assert res_reqs.status_code == 200
    reqs = res_reqs.json()
    assert len(reqs) > 0

    # 2. Approve the request
    res_review = client.post(
        f"/api/v1/admin/access-requests/{target_req_id}/review",
        json={"decision": "APPROVE", "comments": "Approved for official risk assessment duties."},
        cookies={"access_token": token}
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "APPROVED"

    # 3. Verify user's actual record in DB has the role applied
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        assert user is not None
        assigned_roles = [r.name for r in user.roles]
        assert "GRC/Risk Officer" in assigned_roles
    finally:
        db.close()

def test_admin_system_settings_and_status():
    token = login_user("admin@sat-sa.local")

    # 1. List settings
    res_settings = client.get("/api/v1/admin/settings", cookies={"access_token": token})
    assert res_settings.status_code == 200
    settings = res_settings.json()
    assert len(settings) > 0

    # 2. Update setting
    test_key = "platform.environment"
    res_update = client.patch(
        f"/api/v1/admin/settings/{test_key}",
        json={"value": "Live Verification Stage"},
        cookies={"access_token": token}
    )
    assert res_update.status_code == 200
    assert res_update.json()["value"] == "Live Verification Stage"

    # 3. Check system status
    res_status = client.get("/api/v1/admin/system-status", cookies={"access_token": token})
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["database_status"] == "CONNECTED"
    assert status_data["database_latency_ms"] >= 0

def test_public_request_access_and_admin_review_flow():
    # 1. Prospective user submits public access request without authentication
    test_email = "prospective.analyst@national-bank.org"
    req_payload = {
        "full_name": "Elena Rostova",
        "email": test_email,
        "organization_name": "National Central Bank",
        "department_name": "Threat Intelligence Unit",
        "job_title": "Senior Forensic Analyst",
        "requested_role": "SOC Analyst",
        "sector_name": "Financial Services",
        "reason": "Need platform access to correlate financial telemetry against supervisory indicators.",
        "additional_notes": "Clearance Level 3 Certified."
    }

    res_submit = client.post("/api/v1/auth/request-access", json=req_payload)
    assert res_submit.status_code == 200
    submit_data = res_submit.json()
    assert submit_data["status"] == "PENDING"
    request_id = submit_data["request_id"]

    # 2. Administrator logs in and views the pending access request
    admin_token = login_user("admin@sat-sa.local")
    res_list = client.get("/api/v1/admin/access-requests?status=PENDING", cookies={"access_token": admin_token})
    assert res_list.status_code == 200
    pending_requests = res_list.json()
    matched = [r for r in pending_requests if r["id"] == request_id]
    assert len(matched) == 1
    assert matched[0]["requester_email"] == test_email
    assert matched[0]["status"] == "PENDING"

    # 3. Administrator approves the request
    res_review = client.post(
        f"/api/v1/admin/access-requests/{request_id}/review",
        json={"decision": "APPROVE", "comments": "Approved after verification of operational credentials."},
        cookies={"access_token": admin_token}
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "APPROVED"

    # 4. Verify the prospective user is now active in the database
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == test_email).first()
        assert user is not None
        assert user.is_active is True
        assert any(r.name == "SOC Analyst" for r in user.roles)
    finally:
        db.close()

