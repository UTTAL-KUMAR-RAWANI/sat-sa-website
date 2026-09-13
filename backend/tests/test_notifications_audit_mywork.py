"""
Automated tests for Step 16:
Notifications + Audit & Activity History + My Work & Attention Center.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.audit.service import AuditService
from app.audit.constants import AuditActions, AuditResourceTypes
from app.notifications.service import NotificationService
from app.notifications.constants import NotificationTypes, NotificationPriorities

client = TestClient(app)


def get_auth_token(email: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "DemoPassword123!"},
    )
    assert response.status_code == 200, f"Failed login for {email}: {response.text}"
    token = response.cookies.get("access_token")
    if not token and response.json().get("access_token"):
        token = response.json()["access_token"]
    return token


# =============================================================================
# 1. NOTIFICATIONS TESTS
# =============================================================================

def test_notification_creation_and_unread_count():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        assert user is not None

        initial_count = NotificationService.get_unread_count(db, user.id)

        # Send test notification
        res_id = uuid.uuid4()
        notif = NotificationService.notify(
            db=db,
            recipient_id=user.id,
            type=NotificationTypes.CRITICAL_RISK,
            title="Critical Risk Escalation Test",
            message="Immediate leadership mitigation required for core system.",
            priority=NotificationPriorities.CRITICAL,
            resource_type="RISK",
            resource_id=res_id,
            business_reference="RSK-2026-TEST",
            action_url="/risks/test",
            auto_commit=True,
        )
        assert notif is not None
        assert notif.is_read is False

        # API unread count
        token = get_auth_token("ciso@sat-sa.local")
        res = client.get("/api/v1/notifications/unread-count", cookies={"access_token": token})
        assert res.status_code == 200
        data = res.json()
        assert data["unread_count"] >= initial_count + 1

        # API list notifications
        res_list = client.get("/api/v1/notifications?is_read=false", cookies={"access_token": token})
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert list_data["total"] >= 1
        found = any(n["id"] == str(notif.id) for n in list_data["items"])
        assert found, "Created notification should be returned in unread list"

    finally:
        db.close()


def test_notification_mark_read_and_unread():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        token = get_auth_token("ciso@sat-sa.local")

        notif = NotificationService.notify(
            db=db,
            recipient_id=user.id,
            type=NotificationTypes.ASSIGNMENT,
            title="Assessment Assignment Test",
            message="You have been assigned to review ISO 27001 assessment.",
            priority=NotificationPriorities.NORMAL,
            auto_commit=True,
        )

        # Mark read
        res_read = client.post(f"/api/v1/notifications/{notif.id}/read", cookies={"access_token": token})
        assert res_read.status_code == 200
        read_data = res_read.json()
        assert read_data["is_read"] is True
        assert read_data["read_at"] is not None

        # Mark unread
        res_unread = client.post(f"/api/v1/notifications/{notif.id}/unread", cookies={"access_token": token})
        assert res_unread.status_code == 200
        unread_data = res_unread.json()
        assert unread_data["is_read"] is False
        assert unread_data["read_at"] is None

        # Mark all as read
        res_all = client.post("/api/v1/notifications/read-all", cookies={"access_token": token})
        assert res_all.status_code == 200
        all_data = res_all.json()
        assert "updated_count" in all_data

        # Verify unread count is now 0
        res_count = client.get("/api/v1/notifications/unread-count", cookies={"access_token": token})
        assert res_count.json()["unread_count"] == 0

    finally:
        db.close()


def test_notification_isolation_between_users():
    db = SessionLocal()
    try:
        ciso = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        soc = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        assert ciso is not None and soc is not None

        # Create notification for CISO
        notif = NotificationService.notify(
            db=db,
            recipient_id=ciso.id,
            type=NotificationTypes.SYSTEM,
            title="Confidential CISO Alert",
            message="Internal only",
            auto_commit=True,
        )

        # SOC Analyst cannot mark CISO's notification as read
        soc_token = get_auth_token("soc@sat-sa.local")
        res = client.post(f"/api/v1/notifications/{notif.id}/read", cookies={"access_token": soc_token})
        assert res.status_code == 404

        # SOC Analyst list should not contain CISO's notification
        res_list = client.get("/api/v1/notifications", cookies={"access_token": soc_token})
        assert res_list.status_code == 200
        items = res_list.json()["items"]
        assert not any(n["id"] == str(notif.id) for n in items)

    finally:
        db.close()


def test_notification_deduplication():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        res_id = uuid.uuid4()

        # First notify
        n1 = NotificationService.notify(
            db=db,
            recipient_id=user.id,
            type=NotificationTypes.REVIEW_REQUIRED,
            title="Initial Review Required",
            message="Message version 1",
            priority=NotificationPriorities.NORMAL,
            resource_type="ASSESSMENT",
            resource_id=res_id,
            auto_commit=True,
        )

        # Duplicate notify for same resource while unread
        n2 = NotificationService.notify(
            db=db,
            recipient_id=user.id,
            type=NotificationTypes.REVIEW_REQUIRED,
            title="Updated Review Required",
            message="Message version 2",
            priority=NotificationPriorities.HIGH,
            resource_type="ASSESSMENT",
            resource_id=res_id,
            auto_commit=True,
        )

        # Should update existing record instead of creating duplicate row
        assert n1.id == n2.id
        assert n2.title == "Updated Review Required"
        assert n2.priority == "HIGH"

    finally:
        db.close()


# =============================================================================
# 2. AUDIT LOGGING & ACTIVITY HISTORY TESTS
# =============================================================================

def test_audit_sanitization_and_logging():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@sat-sa.local").first()
        res_id = uuid.uuid4()

        audit = AuditService.log(
            db=db,
            actor=user,
            action=AuditActions.UPDATE,
            resource_type=AuditResourceTypes.USER,
            resource_id=res_id,
            business_reference="USR-TEST-001",
            old_value={"username": "user1", "password": "PlainTextPassword!", "token": "jwt_secret_token"},
            new_value={"username": "user1_new", "password": "NewPlainTextPassword!"},
            reason="User requested password update",
            auto_commit=True,
        )

        assert audit.old_value["password"] == "[REDACTED]"
        assert audit.old_value["token"] == "[REDACTED]"
        assert audit.new_value["password"] == "[REDACTED]"
        assert audit.old_value["username"] == "user1"
        assert audit.new_value["username"] == "user1_new"

    finally:
        db.close()


def test_resource_activity_history():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        token = get_auth_token("ciso@sat-sa.local")
        res_id = uuid.uuid4()

        # Create two audit events for a mock CSE
        AuditService.log(
            db=db,
            actor=user,
            action=AuditActions.CREATE,
            resource_type=AuditResourceTypes.CSE,
            resource_id=res_id,
            business_reference="CSE-2026-TEST1",
            new_value={"status": "OPEN", "priority": "MEDIUM"},
            reason="Created initial incident record",
            auto_commit=True,
        )

        AuditService.log(
            db=db,
            actor=user,
            action=AuditActions.STATUS_CHANGE,
            resource_type=AuditResourceTypes.CSE,
            resource_id=res_id,
            business_reference="CSE-2026-TEST1",
            old_value={"status": "OPEN", "priority": "MEDIUM"},
            new_value={"status": "IN_PROGRESS", "priority": "HIGH"},
            reason="Escalated to active investigation",
            auto_commit=True,
        )

        # Call resource history API
        res = client.get(f"/api/v1/audit-logs/resource/CSE/{res_id}", cookies={"access_token": token})
        assert res.status_code == 200
        history = res.json()
        assert len(history) == 2

        # Verify most recent is first
        latest = history[0]
        assert latest["action"] == "STATUS_CHANGE"
        assert latest["status_transition"] == {"from": "OPEN", "to": "IN_PROGRESS"}
        assert len(latest["field_changes"]) >= 1
        assert any(c["field"] == "priority" for c in latest["field_changes"])

    finally:
        db.close()


def test_audit_logs_list_export_and_access_control():
    admin_token = get_auth_token("admin@sat-sa.local")
    unauth_token = get_auth_token("assessor@sat-sa.local")

    # 1. Admin with AUDIT_LOGS_READ can list
    res_admin = client.get("/api/v1/audit-logs", cookies={"access_token": admin_token})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "items" in data
    assert "total" in data

    # 2. Assessor without AUDIT_LOGS_READ is forbidden (403)
    res_unauth = client.get("/api/v1/audit-logs", cookies={"access_token": unauth_token})
    assert res_unauth.status_code == 403

    # 3. Admin can export CSV and verify self-audit
    res_exp = client.get("/api/v1/audit-logs/export", cookies={"access_token": admin_token})
    assert res_exp.status_code == 200
    assert "text/csv" in res_exp.headers.get("content-type", "")
    csv_content = res_exp.text
    assert "Audit ID" in csv_content
    assert "Business Reference" in csv_content

    # Verify self-audit logged EXPORT action
    db = SessionLocal()
    try:
        export_log = (
            db.query(AuditLog)
            .filter(AuditLog.action == AuditActions.EXPORT, AuditLog.resource_type == "AUDIT_LOG")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert export_log is not None
        assert "Exported" in export_log.reason
    finally:
        db.close()


# =============================================================================
# 3. MY WORK & ATTENTION CENTER TESTS
# =============================================================================

def test_my_work_endpoints():
    ciso_token = get_auth_token("ciso@sat-sa.local")

    # 1. Summary endpoint
    res_sum = client.get("/api/v1/my-work/summary", cookies={"access_token": ciso_token})
    assert res_sum.status_code == 200
    sum_data = res_sum.json()
    assert "total_assigned" in sum_data
    assert "needs_review_count" in sum_data
    assert "overdue_count" in sum_data
    assert "critical_count" in sum_data
    assert "by_category" in sum_data

    # 2. Main work items endpoint with bucket filters
    res_all = client.get("/api/v1/my-work?bucket=all", cookies={"access_token": ciso_token})
    assert res_all.status_code == 200
    all_data = res_all.json()
    assert "items" in all_data
    assert "summary" in all_data
    assert "effective_scope" in all_data

    # 3. Filter buckets
    for bucket in ["assigned", "needs_review", "overdue", "critical"]:
        res_b = client.get(f"/api/v1/my-work?bucket={bucket}", cookies={"access_token": ciso_token})
        assert res_b.status_code == 200
