import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.identity import User
from app.models.supervision import SupervisoryCase
from app.models.security import CSE
from app.core.database import SessionLocal

client = TestClient(app)

def get_auth_token(email: str):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "DemoPassword123!"}
    )
    assert response.status_code == 200, f"Failed login for {email}: {response.text}"
    token = response.cookies.get("access_token")
    if not token and response.json().get("access_token"):
        token = response.json()["access_token"]
    return token

def test_supervisory_summary_stats():
    token = get_auth_token("supervision.auth@sat-sa.local")
    response = client.get(
        "/api/v1/supervision/summary",
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    data = response.json()
    assert "open_cases" in data
    assert "critical_escalations" in data
    assert "cases_awaiting_authority" in data
    assert data["open_cases"] >= 1

def test_supervisory_case_creation_and_business_id():
    token = get_auth_token("supervision.auth@sat-sa.local")
    payload = {
        "title": "Automated Test Supervisory Investigation",
        "description": "Verification of supervisory case lifecycle and business ID allocation.",
        "priority": "HIGH",
        "trigger_type": "MANUAL_ESCALATION"
    }
    response = client.post(
        "/api/v1/supervision/cases",
        json=payload,
        cookies={"access_token": token}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["business_id"].startswith("SUP-")
    assert data["status"] == "OPEN"
    assert data["title"] == payload["title"]

def test_manual_escalation_flow():
    token = get_auth_token("soc@sat-sa.local")
    
    # Fetch a CSE to escalate
    db = SessionLocal()
    cse = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
    db.close()
    assert cse is not None

    payload = {
        "resource_type": "CSE",
        "resource_id": str(cse.id),
        "reason": "Suspicious persistence mechanism requires urgent supervisory intervention.",
        "severity": "CRITICAL",
        "priority": "CRITICAL",
        "level": "LEVEL_3"
    }
    response = client.post(
        "/api/v1/supervision/escalations",
        json=payload,
        cookies={"access_token": token}
    )
    assert response.status_code == 201
    esc_data = response.json()
    assert esc_data["business_id"].startswith("ESC-")
    assert esc_data["status"] == "OPEN"
    assert esc_data["supervisory_case_id"] is not None

    esc_id = esc_data["id"]

    # Acknowledge escalation as supervisor
    sup_token = get_auth_token("supervision.auth@sat-sa.local")
    ack_res = client.post(
        f"/api/v1/supervision/escalations/{esc_id}/acknowledge",
        cookies={"access_token": sup_token}
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # Resolve escalation
    res_res = client.post(
        f"/api/v1/supervision/escalations/{esc_id}/resolve",
        json={"resolution": "Containment protocol verified and supervisory oversight initiated."},
        cookies={"access_token": sup_token}
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

def test_supervision_analyst_workflow():
    analyst_token = get_auth_token("supervision.analyst@sat-sa.local")

    # List cases assigned to analyst
    list_res = client.get(
        "/api/v1/supervision/cases",
        cookies={"access_token": analyst_token}
    )
    assert list_res.status_code == 200
    cases = list_res.json()
    assert len(cases) >= 1

    target_case = next((c for c in cases if c["status"] in ["OPEN", "ASSIGNED"]), cases[0])
    case_id = target_case["id"]

    # Start review
    start_res = client.post(
        f"/api/v1/supervision/cases/{case_id}/start-review",
        json={"analyst_notes": "Forensic log inspection confirmed secondary beaconing."},
        cookies={"access_token": analyst_token}
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "UNDER_REVIEW"

    # Submit recommendation
    rec_res = client.post(
        f"/api/v1/supervision/cases/{case_id}/submit-recommendation",
        json={
            "recommendation": "Require mandatory key rotation and host re-imaging.",
            "analyst_notes": "All indicators of compromise cataloged in investigation dossier.",
            "target_status": "RECOMMENDATION_READY"
        },
        cookies={"access_token": analyst_token}
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "RECOMMENDATION_READY"

def test_separation_of_duties_enforcement():
    analyst_token = get_auth_token("supervision.analyst@sat-sa.local")
    auth_token = get_auth_token("supervision.auth@sat-sa.local")

    # 1. Fetch SUP-2026-00003 (where assigned analyst is Alex Vance)
    db = SessionLocal()
    case = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00003").first()
    db.close()
    assert case is not None
    case_id = str(case.id)

    # 2. Analyst attempts to issue authority decision -> Must fail with HTTP 400 or 403
    decision_payload = {
        "decision_type": "REQUIRE_ACTION",
        "rationale": "Analyst attempting self-decision approval.",
        "action_required": "Execute database encryption."
    }
    analyst_attempt = client.post(
        f"/api/v1/supervision/cases/{case_id}/record-decision",
        json=decision_payload,
        cookies={"access_token": analyst_token}
    )
    assert analyst_attempt.status_code in [400, 403]
    if analyst_attempt.status_code == 400:
        assert "SEPARATION_OF_DUTIES_VIOLATION" in analyst_attempt.json()["detail"]

    # 3. Independent Authority issues decision -> Must succeed
    auth_res = client.post(
        f"/api/v1/supervision/cases/{case_id}/record-decision",
        json={
            "decision_type": "REQUIRE_ACTION",
            "rationale": "Independent authority validation confirms regulatory necessity.",
            "action_required": "Enforce Transparent Data Encryption across all customer tables."
        },
        cookies={"access_token": auth_token}
    )
    assert auth_res.status_code == 200
    assert auth_res.json()["status"] == "ACTION_REQUIRED"
    assert auth_res.json()["final_decision"] == "REQUIRE_ACTION"

def test_supervisory_finding_creation():
    analyst_token = get_auth_token("supervision.analyst@sat-sa.local")

    db = SessionLocal()
    case = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00001").first()
    db.close()
    assert case is not None

    payload = {
        "title": "Supervisory Finding: Unaudited Domain Trust Relationship",
        "description": "Bidirectional trust exists with compromised secondary forest.",
        "severity": "HIGH",
        "priority": "HIGH",
        "remediation_required": True
    }
    response = client.post(
        f"/api/v1/supervision/cases/{case.id}/finding",
        json=payload,
        cookies={"access_token": analyst_token}
    )
    assert response.status_code == 201
    finding_data = response.json()
    assert finding_data["business_id"].startswith("FND-")
    assert finding_data["source_type"] == "SUPERVISORY_REVIEW"

def test_automatic_trigger_scan():
    auth_token = get_auth_token("supervision.auth@sat-sa.local")
    response = client.post(
        "/api/v1/supervision/escalations/trigger-scan",
        cookies={"access_token": auth_token}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "triggered_count" in data
