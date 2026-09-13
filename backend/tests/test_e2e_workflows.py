import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import (
    Alert, CSE, Investigation, Finding, Risk,
    Remediation, SupervisoryCase, SupervisoryDecision, Assessment
)

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

ALL_13_ROLES = [
    {"email": "admin@sat-sa.local", "expected_role": "CSE Administrator"},
    {"email": "ciso@sat-sa.local", "expected_role": "CISO"},
    {"email": "mgmt@sat-sa.local", "expected_role": "Senior Management"},
    {"email": "grc@sat-sa.local", "expected_role": "GRC/Risk Officer"},
    {"email": "assessor@sat-sa.local", "expected_role": "Authorized Assessor"},
    {"email": "auditor@sat-sa.local", "expected_role": "Auditor Reviewer"},
    {"email": "supervision.auth@sat-sa.local", "expected_role": "Supervision Authority"},
    {"email": "supervision.analyst@sat-sa.local", "expected_role": "Supervision Analyst"},
    {"email": "sector.auth@sat-sa.local", "expected_role": "Sector Security Authority"},
    {"email": "soc@sat-sa.local", "expected_role": "SOC Analyst"},
    {"email": "remediation@sat-sa.local", "expected_role": "Remediation Owner"},
    {"email": "it_infra@sat-sa.local", "expected_role": "IT Infrastructure Team"},
    {"email": "control_owner@sat-sa.local", "expected_role": "Control Owner"},
]

def login(email: str, password: str = DEMO_PASS) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.cookies.get("access_token")

# ==============================================================================
# 1. ALL 13 ROLES AUTHENTICATION & ACCESS VERIFICATION
# ==============================================================================

@pytest.mark.parametrize("role_entry", ALL_13_ROLES)
def test_all_13_roles_authentication_and_scope(role_entry):
    email = role_entry["email"]
    expected_role = role_entry["expected_role"]

    token = login(email)
    res = client.get("/api/v1/auth/me", cookies={"access_token": token})
    assert res.status_code == 200
    user_info = res.json()
    assert user_info["email"] == email
    assert expected_role in user_info["roles"]
    assert user_info["is_active"] is True
    assert len(user_info["permissions"]) > 0
    assert user_info["scope"] is not None

# ==============================================================================
# 2. SEPARATION OF DUTIES (SoD) VERIFICATION
# ==============================================================================

def test_sod_assessor_cannot_approve_assessment():
    """Authorized Assessor cannot perform Auditor approval action on assessments."""
    assessor_token = login("assessor@sat-sa.local")
    
    # Try to approve an assessment using Assessor token
    fake_assessment_id = uuid.uuid4()
    res = client.post(
        f"/api/v1/assessments/{fake_assessment_id}/approve",
        cookies={"access_token": assessor_token}
    )
    # Backend RBAC must reject with 403 Forbidden (missing ASSESSMENT_APPROVE)
    assert res.status_code == 403

def test_sod_remediation_owner_cannot_validate_remediation():
    """Remediation Owner cannot validate/verify their own remediation."""
    remediation_token = login("remediation@sat-sa.local")
    
    fake_rem_id = uuid.uuid4()
    res = client.post(
        f"/api/v1/remediations/{fake_rem_id}/validate",
        cookies={"access_token": remediation_token}
    )
    # Backend RBAC must reject with 403 Forbidden (missing REMEDIATION_VALIDATE)
    assert res.status_code == 403

def test_sod_supervision_analyst_cannot_issue_authority_decision():
    """Supervision Analyst can submit recommendations, but CANNOT issue final Authority decisions."""
    analyst_token = login("supervision.analyst@sat-sa.local")
    
    # Attempt to record a final supervisory decision on a case
    fake_case_id = uuid.uuid4()
    res = client.post(
        f"/api/v1/supervision/cases/{fake_case_id}/record-decision",
        json={
            "final_decision": "REQUIRE_ACTION",
            "decision_reason": "Unauthorized decision attempt by analyst"
        },
        cookies={"access_token": analyst_token}
    )
    # Backend RBAC must reject with 403 Forbidden (missing SUPERVISION_DECIDE / SUPERVISION_APPROVE)
    assert res.status_code == 403

def test_sod_supervision_authority_can_access_decision_endpoint():
    """Supervision Authority has authoritative permission to access supervisory decisions."""
    authority_token = login("supervision.auth@sat-sa.local")
    
    res = client.get(
        "/api/v1/supervision/decisions",
        cookies={"access_token": authority_token}
    )
    assert res.status_code == 200

# ==============================================================================
# 3. WORKFLOW & INVALID STATUS TRANSITIONS
# ==============================================================================

def test_invalid_remediation_transition_rejected():
    """Directly closing an open/in-progress remediation without prior verification must be rejected."""
    # Remediation close requires REMEDIATION_CLOSE permission (e.g. GRC or CISO)
    grc_token = login("grc@sat-sa.local")
    
    db = SessionLocal()
    # Find or check an open/in-progress remediation
    rem = db.query(Remediation).filter(Remediation.status.in_(["OPEN", "IN_PROGRESS", "ASSIGNED"])).first()
    db.close()
    
    if rem:
        # Attempting to close an unverified remediation returns 400 Bad Request
        res = client.post(
            f"/api/v1/remediations/{rem.id}/close",
            json={"closure_notes": "Attempting illegal premature closure"},
            cookies={"access_token": grc_token}
        )
        assert res.status_code in [400, 422]

def test_cross_tenant_scope_isolation():
    """SOC Analyst of National Central Bank cannot access or modify Apex Power Grid records."""
    soc_token = login("soc@sat-sa.local")
    
    db = SessionLocal()
    apex_alert = db.query(Alert).filter(Alert.business_id == "ALT-2026-00002").first()
    db.close()
    
    assert apex_alert is not None
    # Accessing another entity's alert returns 403 Forbidden
    res = client.get(f"/api/v1/alerts/{apex_alert.id}", cookies={"access_token": soc_token})
    assert res.status_code == 403

# ==============================================================================
# 4. CONNECTED END-TO-END DATASET TRACEABILITY (SCENARIO A)
# ==============================================================================

def test_connected_scenario_a_traceability():
    """
    Verify the primary connected demonstration chain:
    Alert ALT-2026-00001 -> CSE-2026-00001 -> Investigation INV-2026-00001 ->
    Finding FND-2026-00001 -> Risk RSK-2026-00001 -> Remediation REM-2026-00001 ->
    Supervision SUP-2026-00001 -> Decision DEC-2026-00001.
    """
    db = SessionLocal()
    try:
        # 1. Alert
        alert = db.query(Alert).filter(Alert.business_id == "ALT-2026-00001").first()
        assert alert is not None, "ALT-2026-00001 must exist in database"
        assert alert.title == "Data Exfiltration Alert: Core Banking Gateway"
        
        # 2. CSE
        cse = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
        assert cse is not None, "CSE-2026-00001 must exist in database"
        
        # 3. Investigation
        inv = db.query(Investigation).filter(Investigation.business_id == "INV-2026-00001").first()
        assert inv is not None, "INV-2026-00001 must exist in database"
        assert inv.cse_id == cse.id, "Investigation must be linked to CSE"
        
        # 4. Finding
        fnd = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
        assert fnd is not None, "FND-2026-00001 must exist in database"
        assert fnd.cse_id == cse.id, "Finding must be linked to CSE"
        
        # 5. Risk
        risk = db.query(Risk).filter(Risk.business_id == "RSK-2026-00001").first()
        assert risk is not None, "RSK-2026-00001 must exist in database"
        assert risk.finding_id == fnd.id, "Risk must be linked to Finding"
        
        # 6. Remediation
        rem = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00001").first()
        assert rem is not None, "REM-2026-00001 must exist in database"
        assert rem.finding_id == fnd.id or rem.risk_id == risk.id, "Remediation must be linked to Finding or Risk"
        
        # 7. Supervision Case
        sup = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00001").first()
        assert sup is not None, "SUP-2026-00001 must exist in database"
        assert sup.source_cse_id == cse.id or sup.source_finding_id == fnd.id, "SupervisoryCase must link to incident"
        
        # 8. Supervisory Decision
        dec = db.query(SupervisoryDecision).filter(SupervisoryDecision.business_id == "DEC-2026-00001").first()
        assert dec is not None, "DEC-2026-00001 must exist in database"
        assert dec.supervisory_case_id == sup.id, "Supervisory Decision must be linked to Case"

    finally:
        db.close()
