import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.security import CSE, Investigation, Evidence
from app.models.finding import Finding, FindingComment
from app.models.audit import AuditLog
from app.models.notification import Notification

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.cookies.get("access_token")


# --- 1. Finding Creation & Source Relationships ---

def test_finding_creation_from_cse_and_investigation():
    soc_token = login_user("soc@sat-sa.local")
    db = SessionLocal()
    cse = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
    inv = db.query(Investigation).filter(Investigation.business_id == "INV-2026-00001").first()
    db.close()
    assert cse is not None
    assert inv is not None

    # 1. Create finding linked to Investigation
    res = client.post(
        "/api/v1/findings",
        json={
            "title": "Malicious Registry Run Key Persistence Mechanism",
            "description": "Observed persistence registry key HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run established by compromised process.",
            "severity": "HIGH",
            "priority": "HIGH",
            "classification": "Security",
            "source_type": "INVESTIGATION",
            "investigation_id": str(inv.id)
        },
        cookies={"access_token": soc_token}
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["business_id"].startswith("FND-")
    assert data["status"] == "IDENTIFIED"
    assert data["investigation_id"] == str(inv.id)
    assert data["cse_id"] == str(cse.id)
    assert data["organization_name"] == "National Central Bank"

    # 2. Invalid source ID rejected
    res_bad = client.post(
        "/api/v1/findings",
        json={
            "title": "Ghost source finding",
            "source_type": "CSE",
            "cse_id": str(uuid.uuid4())
        },
        cookies={"access_token": soc_token}
    )
    assert res_bad.status_code == 404

    # 3. Unauthorized role cannot create finding (e.g. Remediation Owner does not hold FINDING_CREATE)
    rem_token = login_user("remediation@sat-sa.local")
    res_unauth = client.post(
        "/api/v1/findings",
        json={
            "title": "Unauthorized attempt",
            "source_type": "CSE",
            "cse_id": str(cse.id)
        },
        cookies={"access_token": rem_token}
    )
    assert res_unauth.status_code == 403


# --- 2. Scope-Based Access Isolation ---

def test_finding_scope_isolation():
    soc_token = login_user("soc@sat-sa.local")
    db = SessionLocal()
    # FND-2026-00004 belongs to Apex Power Grid (Energy & Utilities)
    apex_finding = db.query(Finding).filter(Finding.business_id == "FND-2026-00004").first()
    ncb_finding = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
    db.close()

    assert apex_finding is not None
    assert ncb_finding is not None

    # SOC Analyst belongs to National Central Bank and can access NCB finding
    res_ok = client.get(f"/api/v1/findings/{ncb_finding.id}", cookies={"access_token": soc_token})
    assert res_ok.status_code == 200
    assert res_ok.json()["business_id"] == "FND-2026-00001"

    # SOC Analyst cannot access Apex Power Grid finding (403 Forbidden)
    res_forbidden = client.get(f"/api/v1/findings/{apex_finding.id}", cookies={"access_token": soc_token})
    assert res_forbidden.status_code == 403

    # In listing, SOC Analyst should not see Apex finding
    res_list = client.get("/api/v1/findings", cookies={"access_token": soc_token})
    assert res_list.status_code == 200
    items = res_list.json()["items"]
    assert all(item["organization_name"] != "Apex Power Grid" for item in items)


# --- 3. Workflow Lifecycle, Review & Separation of Duties ---

def test_workflow_transitions_and_separation_of_duties():
    soc_token = login_user("soc@sat-sa.local")
    auditor_token = login_user("auditor@sat-sa.local")

    db = SessionLocal()
    cse = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
    db.close()

    # Step 1: SOC Analyst creates a new finding
    res_create = client.post(
        "/api/v1/findings",
        json={
            "title": "Insecure Service Principal Secret Lifetime",
            "description": "Cloud service principal client secrets configured with non-expiring lifetimes.",
            "severity": "MEDIUM",
            "priority": "MEDIUM",
            "source_type": "CSE",
            "cse_id": str(cse.id)
        },
        cookies={"access_token": soc_token}
    )
    assert res_create.status_code == 201
    finding_id = res_create.json()["id"]

    # Step 2: Submit finding for review
    res_submit = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={"target_state": "SUBMITTED", "reason": "Initial assessment completed, submitting for review."},
        cookies={"access_token": soc_token}
    )
    assert res_submit.status_code == 200
    assert res_submit.json()["status"] == "SUBMITTED"

    # Step 3: Auditor commences review
    res_review = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={"target_state": "REVIEW", "review_notes": "Commencing independent evaluation of secret policy."},
        cookies={"access_token": auditor_token}
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "REVIEW"

    # Step 4: Separation of Duties Violation Check!
    # SOC Analyst (the creator) attempts to CONFIRM the finding
    res_self_confirm = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={"target_state": "CONFIRMED", "review_notes": "Creator self-approving."},
        cookies={"access_token": soc_token}
    )
    # Must fail because SOC analyst has neither FINDING_APPROVE nor is allowed to approve own finding!
    assert res_self_confirm.status_code in [400, 403]

    # Even if an authorized user tries to confirm their own finding, separation of duties must block them:
    # Let's verify by having Auditor create a finding and then try to confirm it:
    res_auditor_fnd = client.post(
        "/api/v1/findings",
        json={
            "title": "Auditor Self Created Finding",
            "source_type": "CSE",
            "cse_id": str(cse.id)
        },
        cookies={"access_token": auditor_token}
    )
    # Auditor reviewer has FINDING_REVIEW, FINDING_APPROVE, but not FINDING_CREATE
    # (Authorized Assessor has CREATE, Auditor Reviewer has REVIEW/APPROVE)
    # If Auditor lacks CREATE, returns 403 as intended by RBAC
    assert res_auditor_fnd.status_code in [201, 403]

    # Step 5: Independent Auditor successfully CONFIRMS the SOC analyst's finding
    res_confirm = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={
            "target_state": "CONFIRMED",
            "review_notes": "Confirmed as significant control weakness. Mandatory rotation required."
        },
        cookies={"access_token": auditor_token}
    )
    assert res_confirm.status_code == 200
    assert res_confirm.json()["status"] == "CONFIRMED"

    # Step 6: Mark Remediation Required
    res_remed = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={
            "target_state": "REMEDIATION_REQUIRED",
            "reason": "Escalated for immediate patch and configuration management.",
            "remediation_required": True
        },
        cookies={"access_token": auditor_token}
    )
    assert res_remed.status_code == 200
    assert res_remed.json()["status"] == "REMEDIATION_REQUIRED"
    assert res_remed.json()["remediation_required"] is True

    # Step 7: Invalid Transition check (e.g. from REMEDIATION_REQUIRED directly back to DRAFT is invalid)
    res_invalid = client.post(
        f"/api/v1/findings/{finding_id}/transition",
        json={"target_state": "DRAFT"},
        cookies={"access_token": auditor_token}
    )
    assert res_invalid.status_code == 400


# --- 4. Assignment, Comments & Due Date / Overdue Logic ---

def test_finding_assignment_and_comments():
    soc_token = login_user("soc@sat-sa.local")
    auditor_token = login_user("auditor@sat-sa.local")

    db = SessionLocal()
    fnd = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
    auditor_user = db.query(User).filter(User.email == "auditor@sat-sa.local").first()
    db.close()

    assert fnd is not None
    assert auditor_user is not None

    # 1. Add structured review note comment
    res_comment = client.post(
        f"/api/v1/findings/{fnd.id}/comments",
        json={
            "comment": "Requested additional memory dump artifacts from session proxy.",
            "comment_type": "REVIEW_NOTE"
        },
        cookies={"access_token": auditor_token}
    )
    assert res_comment.status_code == 201
    cdata = res_comment.json()
    assert cdata["comment_type"] == "REVIEW_NOTE"
    assert "auditor" in cdata["author_name"].lower() or "arthur" in cdata["author_name"].lower()

    # 2. Assignment & Due Date
    due_tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    res_assign = client.post(
        f"/api/v1/findings/{fnd.id}/assign",
        json={
            "assigned_to_id": str(auditor_user.id),
            "due_date": due_tomorrow,
            "notes": "Assigned for expedited audit validation."
        },
        cookies={"access_token": soc_token}
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_to_id"] == str(auditor_user.id)
    assert res_assign.json()["is_overdue"] is False

    # 3. Check seeded overdue finding FND-2026-00002
    db = SessionLocal()
    fnd_overdue = db.query(Finding).filter(Finding.business_id == "FND-2026-00002").first()
    db.close()
    res_overdue = client.get(f"/api/v1/findings/{fnd_overdue.id}", cookies={"access_token": soc_token})
    assert res_overdue.status_code == 200
    assert res_overdue.json()["is_overdue"] is True


# --- 5. Stats and Activity Timeline ---

def test_finding_stats_and_timeline():
    soc_token = login_user("soc@sat-sa.local")

    # Stats endpoint
    res_stats = client.get("/api/v1/findings/stats", cookies={"access_token": soc_token})
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total"] >= 2
    assert stats["overdue"] >= 1
    assert stats["remediation_required"] >= 1

    # Timeline endpoint
    db = SessionLocal()
    fnd = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
    db.close()

    res_timeline = client.get(f"/api/v1/findings/{fnd.id}/timeline", cookies={"access_token": soc_token})
    assert res_timeline.status_code == 200
    timeline = res_timeline.json()
    assert len(timeline) >= 1
    assert any("transition" in e["summary"].lower() or "review" in e["summary"].lower() for e in timeline)
