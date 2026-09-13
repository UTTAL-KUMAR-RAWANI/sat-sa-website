"""
Comprehensive backend tests for CISO and Senior Management Executive Dashboards (Step 15).
Covers authorization, RBAC gating, explainable posture scoring, multi-dimensional
aggregations, trend handling, cross-organization comparison, and CSV export with audit logging.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.audit import AuditLog

client = TestClient(app)


def get_auth_token(email: str):
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
# 1. AUTHORIZATION & RBAC GATING TESTS
# =============================================================================

def test_ciso_summary_authorized_for_ciso():
    token = get_auth_token("ciso@sat-sa.local")
    res = client.get(
        "/api/v1/executive/ciso/summary",
        cookies={"access_token": token},
    )
    assert res.status_code == 200, f"CISO summary failed: {res.text}"
    data = res.json()

    # Posture validation
    posture = data["posture"]
    assert "score" in posture
    assert "risk_health" in posture
    assert "findings_health" in posture
    assert "remediation_health" in posture
    assert "assessment_health" in posture
    assert "detection_health" in posture
    assert "weights" in posture
    assert sum(posture["weights"].values()) == pytest.approx(1.0)
    assert posture["status"] in ["OPTIMAL", "STABLE", "ELEVATED_RISK", "CRITICAL_EXPOSURE", "INSUFFICIENT_DATA"]

    # KPIs validation
    kpis = data["kpis"]
    assert "critical_cses" in kpis
    assert "high_critical_findings" in kpis
    assert "critical_risks" in kpis
    assert "open_remediations" in kpis
    assert "overdue_remediations" in kpis
    assert "active_supervisory_cases" in kpis
    assert "high_critical_signals" in kpis

    # Attention required list
    assert isinstance(data["attention_required"], list)
    for item in data["attention_required"]:
        assert "id" in item
        assert "type" in item
        assert "title" in item
        assert "severity" in item
        assert "link_url" in item
        assert item["link_url"].startswith("/")


def test_management_summary_authorized_for_mgmt():
    token = get_auth_token("mgmt@sat-sa.local")
    res = client.get(
        "/api/v1/executive/management/summary",
        cookies={"access_token": token},
    )
    assert res.status_code == 200, f"Management summary failed: {res.text}"
    data = res.json()

    assert "posture" in data
    assert "kpis" in data
    assert "remediation_progress_pct" in data
    assert 0.0 <= data["remediation_progress_pct"] <= 100.0
    assert "overall_risk_exposure" in data["kpis"]
    assert isinstance(data["major_issues"], list)


def test_unauthorized_user_forbidden():
    # SOC Analyst role does NOT have executive permissions
    token = get_auth_token("soc@sat-sa.local")

    res_ciso = client.get(
        "/api/v1/executive/ciso/summary",
        cookies={"access_token": token},
    )
    assert res_ciso.status_code == 403

    res_mgmt = client.get(
        "/api/v1/executive/management/summary",
        cookies={"access_token": token},
    )
    assert res_mgmt.status_code == 403


# =============================================================================
# 2. CISO DETAILED REPORTING SECTIONS
# =============================================================================

def test_ciso_detailed_sections():
    token = get_auth_token("ciso@sat-sa.local")

    # 1. Risks
    res_risks = client.get("/api/v1/executive/ciso/risks", cookies={"access_token": token})
    assert res_risks.status_code == 200
    risk_data = res_risks.json()
    assert "by_level" in risk_data
    assert "requiring_treatment" in risk_data
    assert "accepted_risks" in risk_data
    assert "open_exceptions" in risk_data
    assert "overdue_reviews" in risk_data
    assert isinstance(risk_data["by_category"], dict)

    # 2. Findings
    res_fnd = client.get("/api/v1/executive/ciso/findings", cookies={"access_token": token})
    assert res_fnd.status_code == 200
    fnd_data = res_fnd.json()
    assert "by_severity" in fnd_data
    assert "aging_over_30d" in fnd_data
    assert "aging_over_60d" in fnd_data
    assert "requiring_remediation" in fnd_data
    assert "negative_space_findings" in fnd_data

    # 3. Remediation
    res_rem = client.get("/api/v1/executive/ciso/remediation", cookies={"access_token": token})
    assert res_rem.status_code == 200
    rem_data = res_rem.json()
    assert "by_status" in rem_data
    assert "completion_rate_pct" in rem_data
    assert "overdue_count" in rem_data
    assert "blocked_count" in rem_data

    # 4. Assessments
    res_asmt = client.get("/api/v1/executive/ciso/assessments", cookies={"access_token": token})
    assert res_asmt.status_code == 200
    asmt_data = res_asmt.json()
    assert "assessments_completed" in asmt_data
    assert "control_effectiveness" in asmt_data
    assert "EFFECTIVE" in asmt_data["control_effectiveness"]

    # 5. Negative Space
    res_ns = client.get("/api/v1/executive/ciso/negative-space", cookies={"access_token": token})
    assert res_ns.status_code == 200
    ns_data = res_ns.json()
    assert "assessments_run" in ns_data
    assert "coverage_gaps_count" in ns_data
    assert "high_critical_signals" in ns_data

    # 6. Supervision
    res_sup = client.get("/api/v1/executive/ciso/supervision", cookies={"access_token": token})
    assert res_sup.status_code == 200
    sup_data = res_sup.json()
    assert "open_cases" in sup_data
    assert "critical_escalations" in sup_data
    assert "pending_decisions" in sup_data
    assert isinstance(sup_data["recent_decisions"], list)


# =============================================================================
# 3. TRENDS & INSUFFICIENT DATA HANDLING
# =============================================================================

def test_trends_endpoint_and_insufficient_data():
    token = get_auth_token("ciso@sat-sa.local")
    res = client.get(
        "/api/v1/executive/ciso/trends?days=30",
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["period_days"] == 30
    assert "insufficient_data" in data
    assert isinstance(data["dates"], list)
    assert isinstance(data["cses"], list)
    assert isinstance(data["findings"], list)
    assert isinstance(data["risks"], list)
    assert isinstance(data["remediations_completed"], list)
    assert isinstance(data["negative_space_signals"], list)
    assert isinstance(data["supervisory_escalations"], list)

    # If insufficient data flag is set, verify a message is provided rather than fake curves
    if data["insufficient_data"]:
        assert data["message"] is not None


# =============================================================================
# 4. CROSS-ORGANIZATIONAL COMPARISON
# =============================================================================

def test_comparison_endpoint():
    token = get_auth_token("ciso@sat-sa.local")
    res = client.get(
        "/api/v1/executive/comparison",
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    data = res.json()
    assert "organizations" in data
    assert "sectors" in data
    assert isinstance(data["organizations"], list)
    assert isinstance(data["sectors"], list)


# =============================================================================
# 5. CSV EXPORT & AUDIT LOGGING
# =============================================================================

def test_export_csv_and_audit_logging():
    token = get_auth_token("ciso@sat-sa.local")
    res = client.get(
        "/api/v1/executive/export",
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    content = res.text
    assert "SAT-SA EXECUTIVE SUMMARY EXPORT" in content
    assert "OVERALL SECURITY POSTURE" in content
    assert "KEY PERFORMANCE INDICATORS" in content

    # Verify AuditLog recorded
    db = SessionLocal()
    try:
        log = (
            db.query(AuditLog)
            .filter(AuditLog.action == "EXECUTIVE_REPORT_EXPORTED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert log is not None
        assert log.resource_type == "executive_summary"
        assert log.new_value.get("format") == "csv"
    finally:
        db.close()
