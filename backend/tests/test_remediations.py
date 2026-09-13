import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.remediation import Remediation
from app.models.finding import Finding
from app.models.risk import Risk, RiskTreatment
from app.models.control import Control
from app.models.security import Evidence

client = TestClient(app)

DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Failed to login user {email}: {resp.text}"
    return resp.cookies.get("access_token")


def test_remediation_creation_and_business_id():
    grc_token = login_user("grc@sat-sa.local")

    db = SessionLocal()
    fnd = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
    rsk = db.query(Risk).filter(Risk.business_id == "RSK-2026-00001").first()
    trt = db.query(RiskTreatment).filter(RiskTreatment.business_id == "TRT-2026-00001").first()
    ctrl = db.query(Control).filter(Control.business_id == "CTRL-2026-00001").first()
    rem_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
    db.close()

    assert fnd is not None
    assert rsk is not None
    assert rem_user is not None

    payload = {
        "title": "Remediation for Gateway Cryptographic Keys Exposure",
        "description": "Secure storage deployment and vault migration for compromised gateway keys.",
        "priority": "HIGH",
        "corrective_action": "Relocate private keys to enterprise HSM.",
        "root_cause": "Hardcoded default configuration during automated staging deployment.",
        "implementation_steps": "1. Deploy KMS backend\n2. Key pair rotation\n3. Verification audit",
        "expected_outcome": "Zero cleartext keys on disk.",
        "completion_criteria": "HSM audit log verifies key generation and storage.",
        "source": "FINDING",
        "finding_id": str(fnd.id),
        "risk_id": str(rsk.id),
        "risk_treatment_id": str(trt.id) if trt else None,
        "control_id": str(ctrl.id) if ctrl else None,
        "owner_id": str(rem_user.id),
        "assigned_team": "IT Infrastructure Team",
        "target_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    }

    res = client.post("/api/v1/remediations", json=payload, cookies={"access_token": grc_token})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["business_id"].startswith("REM-")
    assert data["status"] == "ASSIGNED" # Since owner_id was provided
    assert data["source"] == "FINDING"
    assert data["finding_id"] == str(fnd.id)
    assert data["risk_id"] == str(rsk.id)
    assert data["assigned_team"] == "IT Infrastructure Team"
    assert data["owner_id"] == str(rem_user.id)


def test_remediation_lifecycle_and_state_machine():
    grc_token = login_user("grc@sat-sa.local")
    rem_token = login_user("remediation@sat-sa.local")

    # 1. Create a NEW remediation without owner
    create_res = client.post(
        "/api/v1/remediations",
        json={
            "title": "Database TLS Encryption in Transit Enforcement",
            "description": "Configure TLS cipher suites and enforce verify-full across microservices.",
            "priority": "MEDIUM",
            "corrective_action": "Enable sslmode=verify-full in connection pools."
        },
        cookies={"access_token": grc_token}
    )
    assert create_res.status_code == 200
    rem_id = create_res.json()["id"]
    assert create_res.json()["status"] == "OPEN"

    # 2. Assign to owner & team -> ASSIGNED
    db = SessionLocal()
    rem_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
    db.close()

    assign_res = client.post(
        f"/api/v1/remediations/{rem_id}/assign",
        json={
            "owner_id": str(rem_user.id),
            "assigned_team": "Database Operations",
            "target_date": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        },
        cookies={"access_token": grc_token}
    )
    assert assign_res.status_code == 200

    assert assign_res.json()["status"] == "ASSIGNED"
    assert assign_res.json()["assigned_team"] == "Database Operations"

    # 3. Start execution -> IN_PROGRESS
    start_res = client.post(
        f"/api/v1/remediations/{rem_id}/start",
        cookies={"access_token": rem_token}
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "IN_PROGRESS"
    assert start_res.json()["started_at"] is not None


def test_remediation_blocked_workflow_and_validation():
    grc_token = login_user("grc@sat-sa.local")
    rem_token = login_user("remediation@sat-sa.local")

    # Create & start a remediation
    db = SessionLocal()
    rem_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
    db.close()

    rem = client.post(
        "/api/v1/remediations",
        json={
            "title": "Core Router OS Patch Application",
            "description": "Critical firmware security vulnerability remediation.",
            "priority": "CRITICAL",
            "owner_id": str(rem_user.id),
            "assigned_team": "Network Engineering"
        },
        cookies={"access_token": grc_token}
    ).json()
    rem_id = rem["id"]

    client.post(f"/api/v1/remediations/{rem_id}/start", cookies={"access_token": rem_token})

    # Try blocking without reason -> should fail
    bad_block = client.post(
        f"/api/v1/remediations/{rem_id}/block",
        json={"reason": ""},
        cookies={"access_token": rem_token}
    )
    assert bad_block.status_code in (400, 422)

    # Block with valid reason
    good_block = client.post(
        f"/api/v1/remediations/{rem_id}/block",
        json={"reason": "Awaiting change-freeze waiver approval from CAB committee."},
        cookies={"access_token": rem_token}
    )
    assert good_block.status_code == 200
    assert good_block.json()["status"] == "BLOCKED"
    assert "CAB committee" in good_block.json()["blocked_reason"]

    # Unblock -> transitions back to IN_PROGRESS
    unblock = client.post(
        f"/api/v1/remediations/{rem_id}/unblock",
        cookies={"access_token": rem_token}
    )
    assert unblock.status_code == 200
    assert unblock.json()["status"] == "IN_PROGRESS"
    assert unblock.json()["blocked_reason"] is None


def test_separation_of_duties_in_validation_and_closure():
    grc_token = login_user("grc@sat-sa.local")
    rem_token = login_user("remediation@sat-sa.local")
    ciso_token = login_user("ciso@sat-sa.local")

    # 1. Create remediation where remediation@sat-sa.local is owner
    db = SessionLocal()
    rem_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
    db.close()

    create_res = client.post(
        "/api/v1/remediations",
        json={
            "title": "Firewall Ingress Port Restriction",
            "description": "Close TCP port 3389 and 22 on public interfaces.",
            "priority": "HIGH",
            "owner_id": str(rem_user.id),
            "assigned_team": "SecOps Infra"
        },
        cookies={"access_token": grc_token}
    )
    rem_id = create_res.json()["id"]

    # Start it
    client.post(f"/api/v1/remediations/{rem_id}/start", cookies={"access_token": rem_token})

    # Submit evidence for validation -> enters VALIDATION
    sub_res = client.post(
        f"/api/v1/remediations/{rem_id}/submit-evidence",
        json={
            "notes": "Firewall policies applied and ports confirmed closed."
        },
        cookies={"access_token": rem_token}
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] in ("EVIDENCE_SUBMITTED", "VALIDATION")

    # 2. Separation of Duties enforcement:
    # A. Remediation Owner (rem_token) lacks verify permission -> 403 Forbidden
    sod_perm_res = client.post(
        f"/api/v1/remediations/{rem_id}/validate-decision",
        json={
            "decision": "VERIFIED",
            "comments": "I verify my own work."
        },
        cookies={"access_token": rem_token}
    )
    assert sod_perm_res.status_code == 403

    # B. Authorized validator (CISO) who is ALSO the owner attempts self-verification -> 400 Bad Request (SoD violation)
    db = SessionLocal()
    ciso_user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
    db.close()

    ciso_owned_rem = client.post(
        "/api/v1/remediations",
        json={
            "title": "CISO Self-Owned Remediation",
            "priority": "HIGH",
            "owner_id": str(ciso_user.id)
        },
        cookies={"access_token": ciso_token}
    ).json()
    ciso_rem_id = ciso_owned_rem["id"]
    client.post(f"/api/v1/remediations/{ciso_rem_id}/start", cookies={"access_token": ciso_token})
    client.post(f"/api/v1/remediations/{ciso_rem_id}/submit-evidence", cookies={"access_token": ciso_token})

    sod_owner_res = client.post(
        f"/api/v1/remediations/{ciso_rem_id}/validate-decision",
        json={
            "decision": "VERIFIED",
            "comments": "I am the owner and validator."
        },
        cookies={"access_token": ciso_token}
    )
    assert sod_owner_res.status_code == 400
    assert "Separation of Duties" in sod_owner_res.json()["detail"]


    # 3. Return for correction requires mandatory comments
    no_comment_return = client.post(
        f"/api/v1/remediations/{rem_id}/validate-decision",
        json={
            "decision": "RETURNED_FOR_CORRECTION",
            "comments": ""
        },
        cookies={"access_token": ciso_token}
    )
    assert no_comment_return.status_code == 400

    # 4. Independent validator (CISO) performs return for correction
    return_res = client.post(
        f"/api/v1/remediations/{rem_id}/validate-decision",
        json={
            "decision": "RETURNED_FOR_CORRECTION",
            "comments": "Port 3389 is still open on DMZ secondary failover gateway. Please close and resubmit."
        },
        cookies={"access_token": ciso_token}
    )
    assert return_res.status_code == 200
    assert return_res.json()["status"] == "IN_PROGRESS"
    assert "Port 3389 is still open" in return_res.json()["validator_comments"]

    # 5. Owner resubmits to validation
    client.post(
        f"/api/v1/remediations/{rem_id}/submit-evidence",
        json={"notes": "Closed on secondary failover gateway as well."},
        cookies={"access_token": rem_token}
    )

    # 6. Independent validator approves -> VERIFIED
    verify_res = client.post(
        f"/api/v1/remediations/{rem_id}/validate-decision",
        json={
            "decision": "VERIFIED",
            "comments": "Independent port scan verified all management ports closed on both primary and secondary."
        },
        cookies={"access_token": ciso_token}
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "VERIFIED"
    assert verify_res.json()["verified_by_id"] is not None

    # 7. Close remediation
    close_res = client.post(
        f"/api/v1/remediations/{rem_id}/close",
        cookies={"access_token": ciso_token}
    )
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "CLOSED"
    assert close_res.json()["closed_at"] is not None


def test_remediation_evidence_attachment_and_review():
    grc_token = login_user("grc@sat-sa.local")
    rem_token = login_user("remediation@sat-sa.local")
    ciso_token = login_user("ciso@sat-sa.local")

    db = SessionLocal()
    rem_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
    db.close()

    # Create remediation assigned to remediation owner
    create_res = client.post(
        "/api/v1/remediations",
        json={
            "title": "Application Container Vulnerability Patching",
            "priority": "HIGH",
            "owner_id": str(rem_user.id)
        },
        cookies={"access_token": grc_token}
    )
    rem_id = create_res.json()["id"]


    # Upload evidence item linked to this remediation
    evd_res = client.post(
        f"/api/v1/remediations/{rem_id}/evidence",
        json={
            "title": "Trivy Container Scan Verification Artifact",
            "description": "Zero critical and high vulnerabilities in patched base image.",
            "evidence_type": "SCAN_REPORT",
            "file_url": "https://storage.sat-sa.local/scans/trivy-20260913.json"
        },
        cookies={"access_token": rem_token}
    )
    assert evd_res.status_code == 200
    evd_data = evd_res.json()
    assert evd_data["remediation_id"] == rem_id
    assert evd_data["evidence_type"] == "SCAN_REPORT"
    assert evd_data["verification_status"] == "PENDING"
    evd_id = evd_data["id"]

    # Review evidence (VERIFIED) by auditor / reviewer
    rev_res = client.post(
        f"/api/v1/remediations/{rem_id}/evidence/{evd_id}/review",
        json={
            "status": "VERIFIED",
            "comments": "Confirmed report authenticity and clean status."
        },
        cookies={"access_token": ciso_token}
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["verification_status"] == "VERIFIED"


def test_remediations_stats_and_filter_endpoint():
    grc_token = login_user("grc@sat-sa.local")

    # Stats endpoint
    stats_res = client.get("/api/v1/remediations/stats", cookies={"access_token": grc_token})
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_remediations" in stats
    assert "status_distribution" in stats
    assert "priority_distribution" in stats
    assert "overdue" in stats
    assert stats["total_remediations"] >= 1

    # Filter by status
    list_res = client.get("/api/v1/remediations?status=IN_PROGRESS", cookies={"access_token": grc_token})
    assert list_res.status_code == 200
    items = list_res.json()
    assert all(item["status"] == "IN_PROGRESS" for item in items)

