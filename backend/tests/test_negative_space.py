"""
Comprehensive tests for Negative-Space Assessment & Detection Engine (Step 14).
Covers deterministic rules, explainability, safety bounds, data quality guards,
CRUD lifecycle, human review workspace, dismissal justification, finding conversion,
and KPIs.
"""

import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.negative_space.engine import NegativeSpaceEngine

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


# =============================================================================
# 1. ENGINE UNIT TESTS
# =============================================================================

def test_engine_baseline_calculation():
    events = [
        {"event_type": "USER_LOGIN", "source": "AZURE_AD", "severity": "LOW", "asset_id": "SRV-01", "user_identifier": "alice"},
        {"event_type": "USER_LOGIN", "source": "AZURE_AD", "severity": "LOW", "asset_id": "SRV-01", "user_identifier": "bob"},
        {"event_type": "MALWARE_DETECTED", "source": "CROWDSTRIKE", "severity": "HIGH", "asset_id": "WKS-10", "user_identifier": "carol"},
        {"event_type": "FIREWALL_BLOCK", "source": "PALO_ALTO", "severity": "MEDIUM", "asset_id": "FW-CORE", "user_identifier": None},
        {"event_type": "BACKUP_COMPLETED", "source": "VEEAM", "severity": "LOW", "asset_id": "SRV-BACKUP", "user_identifier": "sysadmin"},
    ]

    baseline = NegativeSpaceEngine.calculate_baseline(events)
    assert baseline["total_events"] == 5
    assert baseline["by_event_type"]["USER_LOGIN"] == 2
    assert baseline["by_source"]["AZURE_AD"] == 2
    assert baseline["by_source"]["CROWDSTRIKE"] == 1
    assert baseline["auth_events_count"] == 2
    assert "SRV-01" in baseline["active_assets"]
    assert "PALO_ALTO" in baseline["active_sources"]


def test_engine_rule_detection_and_safety_guard():
    # Construct expected baseline with substantial events
    expected = {
        "total_events": 100,
        "by_event_type": {
            "USER_LOGIN": 40,
            "FIREWALL_DROP": 30,
            "EDR_HEARTBEAT": 20,
            "PERIODIC_BACKUP": 10,
        },
        "by_source": {
            "AZURE_AD": 40,
            "PALO_ALTO": 30,
            "CROWDSTRIKE": 20,
            "VEEAM": 10,
        },
        "by_severity": {
            "LOW": 60,
            "MEDIUM": 25,
            "HIGH": 15,
        },
        "by_asset": {
            "DC-01": 25,
            "FW-01": 30,
            "HOST-A": 20,
        },
        "auth_events_count": 40,
        "active_sources": ["AZURE_AD", "PALO_ALTO", "CROWDSTRIKE", "VEEAM"],
        "active_assets": ["DC-01", "FW-01", "HOST-A"],
    }

    # Observed scenario:
    # 1. CROWDSTRIKE has 0 events -> Rule 2 (Source Silence)
    # 2. DC-01 has 0 events -> Rule 3 (Asset Disappearance)
    # 3. USER_LOGIN dropped from 40 to 5 (87.5% drop) -> Rule 1 & Rule 4 (Auth drop)
    # 4. PERIODIC_BACKUP dropped from 10 to 0 -> Rule 6 (Control Inactivity)
    # 5. 15 HIGH events observed but 0 alerts -> Rule 5 (Alert Gap)
    observed = {
        "total_events": 35,
        "by_event_type": {
            "USER_LOGIN": 5,
            "FIREWALL_DROP": 30,
            "EDR_HEARTBEAT": 0,
            "PERIODIC_BACKUP": 0,
        },
        "by_source": {
            "AZURE_AD": 5,
            "PALO_ALTO": 30,
            "CROWDSTRIKE": 0,
            "VEEAM": 0,
        },
        "by_severity": {
            "HIGH": 15,
            "LOW": 20,
        },
        "by_asset": {
            "DC-01": 0,
            "FW-01": 30,
            "HOST-A": 5,
        },
        "auth_events_count": 5,
        "active_sources": ["AZURE_AD", "PALO_ALTO"],
        "active_assets": ["FW-01", "HOST-A"],
    }

    signals, summary = NegativeSpaceEngine.analyze_negative_space(
        expected=expected,
        observed=observed,
        alerts_observed_count=0,
        dataset_quality_score=65.0,  # Below 70 -> Triggers data quality guard
        dataset_quality_rating="FAIR",
    )

    assert len(signals) > 0
    assert summary["total_signals_detected"] == len(signals)
    assert summary["has_data_quality_concern"] is True
    assert "Data quality concern" in summary["data_quality_notes"]

    # Verify signals have data quality guard flagged
    for s in signals:
        assert s["data_quality_concern"] is True
        assert "Data quality concern" in s["data_quality_notes"]
        assert s["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert s["confidence"] in ["LOW", "MEDIUM", "HIGH"]
        # Safety bound check: Verify explainable wording
        assert "Threat detected" not in s["gap_description"]

    # Verify specific rules triggered
    categories = [s["category"] for s in signals]
    assert "TELEMETRY_SILENCE" in categories
    assert "MONITORING_BLIND_SPOT" in categories
    assert "AUTHENTICATION_DEFICIT" in categories
    assert "CONTROL_ABSENCE" in categories
    assert "ALERT_DEFICIT" in categories


# =============================================================================
# 2. API INTEGRATION TESTS: LIFECYCLE & HUMAN REVIEW WORKSPACE
# =============================================================================

def test_negative_space_assessment_crud_and_run():
    token = get_auth_token("assessor@sat-sa.local")

    # Step 1: Create Assessment
    create_payload = {
        "name": "Q3 Telemetry Coverage & Blind Spot Assessment",
        "description": "Comprehensive supervisory review for undetected silent gaps.",
        "assessment_type": "TELEMETRY_COVERAGE",
        "configuration": {
            "volume_threshold_pct": 50.0,
            "silence_threshold_pct": 85.0,
            "auth_drop_threshold_pct": 60.0,
            "min_baseline_events": 5,
        },
        "expected_activity_definition": {
            "total_events": 50,
            "by_event_type": {"FIREWALL_ALLOW": 30, "EDR_TELEMETRY": 20},
            "by_source": {"PALO_ALTO": 30, "CROWDSTRIKE": 20},
            "by_severity": {"LOW": 50},
            "by_asset": {"SRV-PRIMARY": 30, "HOST-SEC": 20},
            "auth_events_count": 15,
            "active_sources": ["PALO_ALTO", "CROWDSTRIKE"],
            "active_assets": ["SRV-PRIMARY", "HOST-SEC"],
        },
    }

    res_create = client.post(
        "/api/v1/negative-space/assessments",
        json=create_payload,
        cookies={"access_token": token},
    )
    assert res_create.status_code == 201, f"Create failed: {res_create.text}"
    asmt = res_create.json()
    asmt_id = asmt["id"]
    assert asmt["business_id"].startswith("NSA-")
    assert asmt["name"] == "Q3 Telemetry Coverage & Blind Spot Assessment"
    assert asmt["status"] in ["DRAFT", "CONFIGURED"]

    # Step 2: List Assessments
    res_list = client.get(
        "/api/v1/negative-space/assessments",
        cookies={"access_token": token},
    )
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] >= 1
    assert any(a["id"] == asmt_id for a in list_data["items"])

    # Step 3: Get Assessment Detail
    res_get = client.get(
        f"/api/v1/negative-space/assessments/{asmt_id}",
        cookies={"access_token": token},
    )
    assert res_get.status_code == 200
    detail = res_get.json()
    assert detail["id"] == asmt_id

    # Step 4: Update Assessment Metadata
    res_patch = client.patch(
        f"/api/v1/negative-space/assessments/{asmt_id}",
        json={"description": "Updated assessment description for testing."},
        cookies={"access_token": token},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["description"] == "Updated assessment description for testing."

    # Step 5: Run Assessment Execution
    res_run = client.post(
        f"/api/v1/negative-space/assessments/{asmt_id}/run",
        json={"recalculate_baseline": False},
        cookies={"access_token": token},
    )
    assert res_run.status_code == 200, f"Run failed: {res_run.text}"
    run_res = res_run.json()
    assert run_res["status"] in ["COMPLETED", "REVIEW_REQUIRED"]
    assert run_res["signal_count"] > 0
    assert run_res["assessment_summary"] is not None

    # Step 6: List Signals generated for this Assessment
    res_signals = client.get(
        f"/api/v1/negative-space/signals?assessment_id={asmt_id}",
        cookies={"access_token": token},
    )
    assert res_signals.status_code == 200
    signals_data = res_signals.json()
    assert signals_data["total"] > 0
    test_signal = signals_data["items"][0]
    sig_id = test_signal["id"]
    assert test_signal["business_id"].startswith("NSS-")
    assert test_signal["status"] == "DETECTED"

    # Step 7: Signal Human Review Workspace - Start Review
    res_review = client.post(
        f"/api/v1/negative-space/signals/{sig_id}/review",
        json={"review_comments": "Assessor initiating investigation into telemetry dropout."},
        cookies={"access_token": token},
    )
    assert res_review.status_code == 200
    rev_data = res_review.json()
    assert rev_data["status"] == "REVIEWING"
    assert "initiating investigation" in rev_data["review_comments"]

    # Step 8: Validate Signal
    res_val = client.post(
        f"/api/v1/negative-space/signals/{sig_id}/validate",
        json={"notes": "Confirmed endpoint offline during operational hours.", "severity": "HIGH"},
        cookies={"access_token": token},
    )
    assert res_val.status_code == 200
    val_data = res_val.json()
    assert val_data["status"] == "VALIDATED"
    assert val_data["severity"] == "HIGH"

    # Step 9: Convert Validated Signal to Finding
    res_convert = client.post(
        f"/api/v1/negative-space/signals/{sig_id}/convert-finding",
        json={
            "title": "Critical Telemetry Blind Spot on Primary Controller",
            "priority": "P2",
            "remediation_required": True,
        },
        cookies={"access_token": token},
    )
    assert res_convert.status_code == 200, f"Convert failed: {res_convert.text}"
    conv_data = res_convert.json()
    assert conv_data["finding_id"] is not None
    assert conv_data["finding_business_id"].startswith("FND-")
    assert conv_data["signal"]["status"] == "CONVERTED_TO_FINDING"

    # Verify Finding in Findings API
    res_fnd = client.get(
        f"/api/v1/findings/{conv_data['finding_id']}",
        cookies={"access_token": token},
    )
    assert res_fnd.status_code == 200
    fnd_data = res_fnd.json()
    assert fnd_data["source_type"] == "NEGATIVE_SPACE"
    assert fnd_data["source_id"] == sig_id


def test_negative_space_signal_dismissal_requires_justification():
    token = get_auth_token("assessor@sat-sa.local")

    # Create assessment with expected events
    res_create = client.post(
        "/api/v1/negative-space/assessments",
        json={
            "name": "Dismissal Validation Assessment",
            "assessment_type": "SOURCE_SILENCE",
            "expected_activity_definition": {
                "total_events": 20,
                "by_event_type": {"VPN_LOGIN": 20},
                "by_source": {"CISCO_ANYCONNECT": 20},
                "by_severity": {"LOW": 20},
                "active_sources": ["CISCO_ANYCONNECT"],
            },
        },
        cookies={"access_token": token},
    )
    asmt_id = res_create.json()["id"]

    # Run
    client.post(
        f"/api/v1/negative-space/assessments/{asmt_id}/run",
        json={},
        cookies={"access_token": token},
    )

    # Get signal
    res_signals = client.get(
        f"/api/v1/negative-space/signals?assessment_id={asmt_id}",
        cookies={"access_token": token},
    )
    sig_id = res_signals.json()["items"][0]["id"]

    # Dismissal without sufficient reason (< 10 chars) should fail validation
    res_short = client.post(
        f"/api/v1/negative-space/signals/{sig_id}/dismiss",
        json={"dismissal_reason": "False pos"},
        cookies={"access_token": token},
    )
    assert res_short.status_code == 422  # Pydantic validation error

    # Valid dismissal with full justification
    res_valid_dismiss = client.post(
        f"/api/v1/negative-space/signals/{sig_id}/dismiss",
        json={"dismissal_reason": "Expected maintenance window: VPN gateway decommissioned per change ticket CHG-2026-99."},
        cookies={"access_token": token},
    )
    assert res_valid_dismiss.status_code == 200
    assert res_valid_dismiss.json()["status"] == "DISMISSED"
    assert "Expected maintenance window" in res_valid_dismiss.json()["dismissal_reason"]


def test_negative_space_kpis():
    token = get_auth_token("assessor@sat-sa.local")
    res = client.get(
        "/api/v1/negative-space/kpis",
        cookies={"access_token": token},
    )
    assert res.status_code == 200
    kpis = res.json()
    assert "total_assessments" in kpis
    assert "total_signals" in kpis
    assert "validated_signals" in kpis
    assert "dismissed_signals" in kpis
    assert "converted_to_findings" in kpis
    assert "high_critical_signals" in kpis
    assert "data_quality_concerns" in kpis
    assert isinstance(kpis["by_category"], dict)
    assert isinstance(kpis["by_severity"], dict)
