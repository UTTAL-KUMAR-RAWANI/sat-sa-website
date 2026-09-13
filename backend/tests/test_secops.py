import io
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.security import Alert, CSE, Investigation, Evidence, SecurityEvent
from app.models.workflow import Escalation

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.cookies.get("access_token")

# --- 1. Alert Access & Scope Tests ---

def test_soc_analyst_alert_scope_isolation():
    # SOC Analyst belongs to National Central Bank (Financial Services)
    soc_token = login_user("soc@sat-sa.local")
    
    # 1. List alerts: Should see alerts for NCB
    res = client.get("/api/v1/alerts", params={"search": "ALT-2026-00001"}, cookies={"access_token": soc_token})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    
    ncb_alert = next((a for a in data["items"] if a["business_id"] == "ALT-2026-00001"), None)
    assert ncb_alert is not None
    assert ncb_alert["organization_name"] == "National Central Bank"

    # 2. Apex Power Grid alert (ALT-2026-00002) is in another organization/sector
    db = SessionLocal()
    apex_alert = db.query(Alert).filter(Alert.business_id == "ALT-2026-00002").first()
    db.close()
    assert apex_alert is not None

    # SOC Analyst attempting to access Apex alert directly should receive 403 Forbidden
    res_forbidden = client.get(f"/api/v1/alerts/{apex_alert.id}", cookies={"access_token": soc_token})
    assert res_forbidden.status_code == 403

def test_supervision_analyst_sector_scope():
    # Supervision Analyst belongs to Financial Services sector
    sup_token = login_user("supervision.analyst@sat-sa.local")
    
    # 1. Supervision Analyst has CSE_READ and can access Financial Services CSE-2026-00001
    db = SessionLocal()
    ncb_cse = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
    ncb_alert = db.query(Alert).filter(Alert.business_id == "ALT-2026-00001").first()
    db.close()
    
    res_cse = client.get(f"/api/v1/cse/{ncb_cse.id}", cookies={"access_token": sup_token})
    assert res_cse.status_code == 200
    assert res_cse.json()["business_id"] == "CSE-2026-00001"

    # 2. Raw operational alerts require ALERTS_READ which Supervision Analyst does not hold (403 Forbidden)
    res_alert = client.get(f"/api/v1/alerts/{ncb_alert.id}", cookies={"access_token": sup_token})
    assert res_alert.status_code == 403

# --- 2. Triage & Alert-to-CSE Conversion ---

def test_alert_triage_and_cse_conversion_lifecycle():
    soc_token = login_user("soc@sat-sa.local")
    
    # 1. Create a new alert
    res_create = client.post(
        "/api/v1/alerts",
        json={
            "title": "Phishing campaign targeting wire transfer operators",
            "description": "Multiple staff reported spoofed CEO emails containing malicious macro attachments.",
            "severity": "HIGH",
            "priority": "P2",
            "source": "EMAIL_GATEWAY"
        },
        cookies={"access_token": soc_token}
    )
    assert res_create.status_code == 200
    alert_data = res_create.json()
    alert_id = alert_data["id"]
    assert alert_data["status"] == "NEW"

    # 2. Triage and convert to CSE
    res_triage = client.post(
        f"/api/v1/alerts/{alert_id}/triage",
        json={
            "decision": "CONFIRMED_SECURITY_EVENT",
            "notes": "Attachment verified as credential harvester payload. Initializing incident handling.",
            "severity": "CRITICAL",
            "priority": "P1",
            "create_cse": True
        },
        cookies={"access_token": soc_token}
    )
    assert res_triage.status_code == 200
    triaged_alert = res_triage.json()
    assert triaged_alert["status"] == "TRIAGED"
    assert triaged_alert["triage_decision"] == "CONFIRMED_SECURITY_EVENT"
    assert triaged_alert["cse_id"] is not None

    # 3. Verify created CSE exists and has traceability
    cse_id = triaged_alert["cse_id"]
    res_cse = client.get(f"/api/v1/cse/{cse_id}", cookies={"access_token": soc_token})
    assert res_cse.status_code == 200
    cse_data = res_cse.json()
    assert cse_data["originating_alert_id"] == alert_id
    assert cse_data["status"] == "TRIAGED"
    assert cse_data["severity"] == "CRITICAL"

# --- 3. Controlled State Machine Validation ---

def test_cse_controlled_transitions_and_rejections():
    soc_token = login_user("soc@sat-sa.local")
    
    # Create fresh CSE in NEW status
    res_cse = client.post(
        "/api/v1/cse",
        json={
            "title": f"Test Transition CSE {uuid.uuid4().hex[:6]}",
            "description": "Test case for state machine validation",
            "severity": "MEDIUM",
            "priority": "P3"
        },
        cookies={"access_token": soc_token}
    )
    assert res_cse.status_code == 200
    cse_id = res_cse.json()["id"]
    assert res_cse.json()["status"] == "NEW"

    # Invalid transition: NEW -> RESOLVED (not allowed directly)
    res_invalid = client.post(
        f"/api/v1/cse/{cse_id}/transition",
        json={"to_status": "RESOLVED", "reason": "Attempting invalid direct transition"},
        cookies={"access_token": soc_token}
    )
    assert res_invalid.status_code == 400
    assert "Invalid CSE state transition" in res_invalid.json()["detail"]

    # Valid transition: NEW -> TRIAGED
    res_valid1 = client.post(
        f"/api/v1/cse/{cse_id}/transition",
        json={"to_status": "TRIAGED", "reason": "Triage complete"},
        cookies={"access_token": soc_token}
    )
    assert res_valid1.status_code == 200
    assert res_valid1.json()["status"] == "TRIAGED"

    # Valid transition: TRIAGED -> INVESTIGATING
    res_valid2 = client.post(
        f"/api/v1/cse/{cse_id}/transition",
        json={"to_status": "INVESTIGATING", "reason": "Investigation initiated"},
        cookies={"access_token": soc_token}
    )
    assert res_valid2.status_code == 200
    assert res_valid2.json()["status"] == "INVESTIGATING"

# --- 4. Investigation & Evidence Workspace ---

def test_investigation_creation_and_evidence_upload():
    soc_token = login_user("soc@sat-sa.local")
    
    # Get seeded CSE-2026-00001
    db = SessionLocal()
    cse_1 = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
    db.close()
    assert cse_1 is not None

    # 1. Create a secondary investigation
    res_inv = client.post(
        "/api/v1/investigations",
        json={
            "cse_id": str(cse_1.id),
            "title": f"Network Lateral Movement Probe {uuid.uuid4().hex[:6]}",
            "description": "Checking for Kerberos ticket abuse across domain controllers."
        },
        cookies={"access_token": soc_token}
    )
    assert res_inv.status_code == 200
    inv_id = res_inv.json()["id"]

    # 2. Upload Evidence
    file_content = b"TEST FORENSIC LOG DUMP: 2026-09-13T11:00:00Z Connection established to 10.0.4.12:445"
    files = {"file": ("test_dump.log", io.BytesIO(file_content), "text/plain")}
    data = {
        "title": "Domain Controller SMB Traffic Log",
        "description": "Forensic log capture of anomalous lateral SMB traffic.",
        "evidence_type": "LOG",
        "source": "ACTIVE_DIRECTORY",
        "cse_id": str(cse_1.id),
        "investigation_id": inv_id
    }
    res_evd = client.post("/api/v1/evidence/upload", data=data, files=files, cookies={"access_token": soc_token})
    assert res_evd.status_code == 200
    evd_data = res_evd.json()
    assert evd_data["checksum"] is not None
    assert evd_data["file_size"] == len(file_content)
    evd_id = evd_data["id"]

    # 3. Download Evidence
    res_dl = client.get(f"/api/v1/evidence/{evd_id}/download", cookies={"access_token": soc_token})
    assert res_dl.status_code == 200
    assert res_dl.content == file_content

# --- 5. Escalation & Activity Timeline ---

def test_escalation_and_unified_timeline():
    soc_token = login_user("soc@sat-sa.local")
    sup_auth_token = login_user("supervision.auth@sat-sa.local")
    
    # 1. Create a CSE to escalate
    res_cse = client.post(
        "/api/v1/cse",
        json={
            "title": f"Systemic Risk CSE {uuid.uuid4().hex[:6]}",
            "description": "High value interbank clearing disruption risk.",
            "severity": "CRITICAL",
            "priority": "P1"
        },
        cookies={"access_token": soc_token}
    )
    assert res_cse.status_code == 200
    cse_id = res_cse.json()["id"]

    # 2. Escalate CSE
    res_esc = client.post(
        f"/api/v1/cse/{cse_id}/escalate",
        json={
            "reason": "Escalating to central bank supervision due to potential systemic liquidity failure.",
            "severity": "CRITICAL"
        },
        cookies={"access_token": soc_token}
    )
    assert res_esc.status_code == 200
    esc_data = res_esc.json()
    assert esc_data["status"] == "OPEN"
    assert esc_data["business_id"].startswith("ESC-")
    esc_id = esc_data["id"]

    # 3. Supervision Authority resolves the escalation
    res_resolve = client.post(
        f"/api/v1/escalations/{esc_id}/resolve",
        json={"status": "RESOLVED", "resolution": "Supervisory order issued: isolate payment node and initiate failover."},
        cookies={"access_token": sup_auth_token}
    )
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "RESOLVED"

    # 4. Verify Unified Timeline returns the complete chronological event stream
    res_timeline = client.get(f"/api/v1/cse/{cse_id}/timeline", cookies={"access_token": soc_token})
    assert res_timeline.status_code == 200
    timeline = res_timeline.json()
    assert len(timeline) >= 2
    
    event_types = [e["event_type"] for e in timeline]
    assert "ESCALATION" in event_types
    assert "TRANSITION" in event_types
