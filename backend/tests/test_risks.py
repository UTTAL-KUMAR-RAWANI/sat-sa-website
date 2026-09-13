import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.risk import Risk, RiskTreatment, RiskException
from app.models.finding import Finding
from app.models.assessment import Assessment

client = TestClient(app)

DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Failed to login user {email}: {resp.text}"
    return resp.cookies.get("access_token")


def test_risk_creation_and_authoritative_scoring():
    grc_token = login_user("grc@sat-sa.local")

    # 1. Authoritative score test: Frontend payload without score must have score calculated server-side
    payload = {
        "title": "API Authentication Rate Limiting Deficiency Risk",
        "description": "Potential denial of service or credential stuffing on unthrottled authentication endpoints.",
        "category": "Cybersecurity",
        "source": "MANUAL",
        "likelihood": 4, # Likely
        "impact": 3,     # Moderate
        "asset_or_system": "Public Identity Gateway"
    }

    res = client.post("/api/v1/risks", json=payload, cookies={"access_token": grc_token})
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"].startswith("RSK-")
    assert data["likelihood"] == 4
    assert data["impact"] == 3
    # Server-side authoritative calculation: 4 * 3 = 12 -> HIGH
    assert data["inherent_score"] == 12
    assert data["inherent_risk_level"] == "HIGH"
    assert data["status"] == "ASSESSED"

    # 2. Score bounds validation: 1 <= rating <= 5
    invalid_payload = {
        "title": "Out of bounds risk",
        "likelihood": 6,
        "impact": 3
    }
    bad_res = client.post("/api/v1/risks", json=invalid_payload, cookies={"access_token": grc_token})
    assert bad_res.status_code == 422 # Pydantic le=5 validation


def test_risk_inherent_and_residual_assessment():
    grc_token = login_user("grc@sat-sa.local")

    # Create base risk
    res = client.post(
        "/api/v1/risks",
        json={
            "title": "Cloud S3 Storage Bucket Public Exfiltration Risk",
            "category": "Data Security",
            "likelihood": 5, # Almost Certain
            "impact": 5      # Severe -> 25 (CRITICAL)
        },
        cookies={"access_token": grc_token}
    )
    assert res.status_code == 200
    risk_id = res.json()["id"]
    assert res.json()["inherent_score"] == 25
    assert res.json()["inherent_risk_level"] == "CRITICAL"

    # Assess Inherent Risk update
    inh_res = client.post(
        f"/api/v1/risks/{risk_id}/assess-inherent",
        json={"likelihood": 4, "impact": 4},
        cookies={"access_token": grc_token}
    )
    assert inh_res.status_code == 200
    assert inh_res.json()["inherent_score"] == 16
    assert inh_res.json()["inherent_risk_level"] == "HIGH"

    # Assess Residual Risk after deploying bucket encryption and block public access
    res_res = client.post(
        f"/api/v1/risks/{risk_id}/assess-residual",
        json={
            "residual_likelihood": 1, # Rare
            "residual_impact": 3,     # Moderate -> 3 (LOW)
            "existing_controls_description": "Enforced SCPs and AWS Config auto-remediation for public access."
        },
        cookies={"access_token": grc_token}
    )
    assert res_res.status_code == 200
    res_data = res_res.json()
    assert res_data["residual_likelihood"] == 1
    assert res_data["residual_impact"] == 3
    assert res_data["residual_score"] == 3
    assert res_data["residual_risk_level"] == "LOW"


def test_finding_and_assessment_to_risk_linkage():
    grc_token = login_user("grc@sat-sa.local")

    db = SessionLocal()
    fnd = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
    asm = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00001").first()
    db.close()

    assert fnd is not None
    assert asm is not None

    payload = {
        "title": f"Risk Derived from Finding {fnd.business_id}",
        "description": "Exploitation of cleartext gateway keys.",
        "category": "Cybersecurity",
        "source": "FINDING",
        "finding_id": str(fnd.id),
        "assessment_id": str(asm.id),
        "likelihood": 4,
        "impact": 5
    }

    res = client.post("/api/v1/risks", json=payload, cookies={"access_token": grc_token})
    assert res.status_code == 200
    data = res.json()
    assert data["finding_id"] == str(fnd.id)
    assert data["finding_business_id"] == fnd.business_id
    assert data["assessment_id"] == str(asm.id)
    assert data["assessment_business_id"] == asm.business_id


def test_risk_treatment_decision_and_lifecycle():
    grc_token = login_user("grc@sat-sa.local")

    res = client.post(
        "/api/v1/risks",
        json={
            "title": "Legacy VPN Concentrator Remote Code Execution Risk",
            "category": "Technology",
            "likelihood": 4,
            "impact": 4
        },
        cookies={"access_token": grc_token}
    )
    risk_id = res.json()["id"]

    # Formulate Treatment Strategy: MITIGATE
    trt_payload = {
        "strategy": "MITIGATE",
        "treatment_description": "Upgrade VPN firmware to latest hotfix and isolate concentrator behind Zero Trust Network Access proxy.",
        "mitigation_actions": "1. Test firmware in lab\n2. Schedule maintenance window\n3. Deploy ZTNA"
    }
    trt_res = client.post(f"/api/v1/risks/{risk_id}/treatment", json=trt_payload, cookies={"access_token": grc_token})
    assert trt_res.status_code == 200
    assert trt_res.json()["treatment_strategy"] == "MITIGATE"
    assert trt_res.json()["status"] == "TREATMENT_PLANNED"

    # Query treatments endpoint
    list_trt = client.get(f"/api/v1/risk-treatments?risk_id={risk_id}", cookies={"access_token": grc_token})
    assert list_trt.status_code == 200
    assert len(list_trt.json()) >= 1
    assert list_trt.json()[0]["strategy"] == "MITIGATE"


def test_risk_acceptance_and_separation_of_duties():
    grc_token = login_user("grc@sat-sa.local")
    ciso_token = login_user("ciso@sat-sa.local")

    # Grace (GRC Officer) creates a risk
    res = client.post(
        "/api/v1/risks",
        json={
            "title": "Third-Party Cloud Vendor Sub-Processor Certification Lapse",
            "category": "Third Party",
            "likelihood": 2,
            "impact": 3
        },
        cookies={"access_token": grc_token}
    )
    assert res.status_code == 200
    risk_id = res.json()["id"]

    # SEPARATION OF DUTIES TEST:
    # Grace (the identifier of the risk) attempts to self-approve risk acceptance -> Must fail with 403
    self_accept = client.post(
        f"/api/v1/risks/{risk_id}/accept",
        json={"acceptance_justification": "I am accepting my own risk."},
        cookies={"access_token": grc_token}
    )
    assert self_accept.status_code == 403
    assert "Separation of Duties violation" in self_accept.json()["detail"]

    # Independent Authority (Claire, CISO) approves risk acceptance -> Must succeed
    auth_accept = client.post(
        f"/api/v1/risks/{risk_id}/accept",
        json={
            "acceptance_justification": "Vendor has provided ISO 27001 bridge letter; acceptable low residual exposure.",
            "review_date": "2026-12-31T00:00:00Z"
        },
        cookies={"access_token": ciso_token}
    )
    assert auth_accept.status_code == 200
    assert auth_accept.json()["status"] == "ACCEPTED"
    assert auth_accept.json()["acceptance_justification"] is not None
    assert auth_accept.json()["accepted_at"] is not None


def test_risk_exception_lifecycle_and_separation_of_duties():
    grc_token = login_user("grc@sat-sa.local")
    ciso_token = login_user("ciso@sat-sa.local")

    # Create risk
    res = client.post(
        "/api/v1/risks",
        json={
            "title": "Cleartext Password Transmission over Legacy Telnet Console",
            "category": "Access Control",
            "likelihood": 3,
            "impact": 3
        },
        cookies={"access_token": grc_token}
    )
    risk_id = res.json()["id"]

    # Grace requests a Risk Exception
    exc_payload = {
        "title": "Telnet Console Waiver for Decommissioning Hardware",
        "justification": "Hardware appliance slated for complete replacement within 45 days. Network port isolated to physical serial switch.",
        "expiry_date": "2026-10-30T00:00:00Z"
    }
    exc_res = client.post(f"/api/v1/risk-exceptions/risk/{risk_id}", json=exc_payload, cookies={"access_token": grc_token})
    assert exc_res.status_code == 200
    exc_id = exc_res.json()["id"]
    assert exc_res.json()["status"] == "REQUESTED"

    # SEPARATION OF DUTIES TEST:
    # Grace (requester) attempts to approve her own exception -> Must fail with 403
    self_approve = client.post(
        f"/api/v1/risk-exceptions/{exc_id}/decision",
        json={"decision": "APPROVED", "reviewer_comments": "Self approval attempt"},
        cookies={"access_token": grc_token}
    )
    assert self_approve.status_code == 403
    assert "Separation of Duties violation" in self_approve.json()["detail"]

    # Independent Reviewer (Claire, CISO) approves exception -> Must succeed
    auth_approve = client.post(
        f"/api/v1/risk-exceptions/{exc_id}/decision",
        json={"decision": "APPROVED", "reviewer_comments": "Approved with physical serial port isolation."},
        cookies={"access_token": ciso_token}
    )
    assert auth_approve.status_code == 200
    assert auth_approve.json()["status"] == "APPROVED"
    assert auth_approve.json()["reviewed_at"] is not None


def test_risk_stats_and_matrix_distribution():
    grc_token = login_user("grc@sat-sa.local")

    res = client.get("/api/v1/risks/stats", cookies={"access_token": grc_token})
    assert res.status_code == 200
    stats = res.json()
    assert "total_risks" in stats
    assert stats["total_risks"] >= 4
    assert "critical" in stats
    assert "high" in stats
    assert "matrix_distribution" in stats
    assert isinstance(stats["matrix_distribution"], dict)
