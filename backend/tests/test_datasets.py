import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

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

def test_dataset_upload_csv():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.csv")
    assert os.path.exists(fixture_path), "Demo CSV fixture must exist"

    with open(fixture_path, "rb") as f:
        response = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.csv", f, "text/csv")},
            data={"name": "SOC Test Security Log Ingestion", "description": "Automated test CSV dataset"},
            cookies={"access_token": token}
        )

    assert response.status_code == 201, f"Upload failed: {response.text}"
    data = response.json()
    assert data["business_id"].startswith("DS-")
    assert data["name"] == "SOC Test Security Log Ingestion"
    assert data["file_type"] == "CSV"
    assert data["status"] in ["UPLOADED", "MAPPING_REQUIRED"]
    assert data["file_hash"] is not None
    assert len(data["file_hash"]) == 64
    assert data["record_count"] >= 20

def test_dataset_upload_json():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.json")
    assert os.path.exists(fixture_path), "Demo JSON fixture must exist"

    with open(fixture_path, "rb") as f:
        response = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.json", f, "application/json")},
            data={"name": "SOC Test JSON Ingestion", "description": "Automated test JSON dataset"},
            cookies={"access_token": token}
        )

    assert response.status_code == 201, f"Upload failed: {response.text}"
    data = response.json()
    assert data["business_id"].startswith("DS-")
    assert data["file_type"] == "JSON"
    assert data["record_count"] == 5

def test_dataset_upload_invalid_type():
    token = get_auth_token("soc@sat-sa.local")
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("malicious.exe", b"MZexecutablecontent", "application/octet-stream")},
        data={"name": "Invalid File Test"},
        cookies={"access_token": token}
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.text

def test_dataset_schema_detection_and_mapping():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.csv")

    with open(fixture_path, "rb") as f:
        upload_resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.csv", f, "text/csv")},
            data={"name": "Schema Detection Test Dataset"},
            cookies={"access_token": token}
        )
    assert upload_resp.status_code == 201
    dataset_id = upload_resp.json()["id"]

    # Detect Schema
    schema_resp = client.post(
        f"/api/v1/datasets/{dataset_id}/detect-schema",
        cookies={"access_token": token}
    )
    assert schema_resp.status_code == 200, f"Schema detection failed: {schema_resp.text}"
    schema_data = schema_resp.json()
    assert len(schema_data["columns"]) > 5
    assert schema_data["sample_row_count"] > 0

    # Verify column mappings suggested
    col_names = [c["column_name"] for c in schema_data["columns"]]
    assert "timestamp" in col_names
    assert "event_type" in col_names

    # Save Column Mapping
    mapping_payload = {
        "column_mapping": {
            "event_id": "external_event_id",
            "timestamp": "occurred_at",
            "event_type": "event_type",
            "severity": "severity",
            "source_ip": "source_ip",
            "destination_ip": "destination_ip",
            "asset_id": "asset_id",
            "user_id": "user_identifier",
            "action": "action",
            "status": "status",
            "description": "description"
        }
    }
    map_resp = client.post(
        f"/api/v1/datasets/{dataset_id}/map-columns",
        json=mapping_payload,
        cookies={"access_token": token}
    )
    assert map_resp.status_code == 200
    assert map_resp.json()["status"] == "MAPPED"

def test_dataset_validation_quality_score():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.csv")

    with open(fixture_path, "rb") as f:
        upload_resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.csv", f, "text/csv")},
            data={"name": "Validation Quality Score Test"},
            cookies={"access_token": token}
        )
    dataset_id = upload_resp.json()["id"]

    # Auto detect schema
    client.post(f"/api/v1/datasets/{dataset_id}/detect-schema", cookies={"access_token": token})

    # Validate
    val_resp = client.post(
        f"/api/v1/datasets/{dataset_id}/validate",
        cookies={"access_token": token}
    )
    assert val_resp.status_code == 200, f"Validation failed: {val_resp.text}"
    val_data = val_resp.json()
    assert val_data["status"] in ["VALIDATED", "READY_TO_IMPORT"]
    assert val_data["quality_score"] is not None
    assert 0 <= val_data["quality_score"] <= 100
    assert val_data["quality_rating"] in ["EXCELLENT", "GOOD", "FAIR", "POOR"]
    assert val_data["validation_summary"] is not None
    assert val_data["validation_summary"]["valid_records"] > 0
    assert "validity_pct" in val_data["validation_summary"]

def test_dataset_import_to_security_events():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.csv")

    with open(fixture_path, "rb") as f:
        upload_resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.csv", f, "text/csv")},
            data={"name": "Import Security Events Test"},
            cookies={"access_token": token}
        )
    dataset_id = upload_resp.json()["id"]

    client.post(f"/api/v1/datasets/{dataset_id}/detect-schema", cookies={"access_token": token})
    client.post(f"/api/v1/datasets/{dataset_id}/validate", cookies={"access_token": token})

    # Import
    import_resp = client.post(
        f"/api/v1/datasets/{dataset_id}/import",
        json={"mode": "BATCH"},
        cookies={"access_token": token}
    )
    assert import_resp.status_code == 200, f"Import failed: {import_resp.text}"
    import_data = import_resp.json()
    assert import_data["business_id"].startswith("IMP-")
    assert import_data["status"] == "COMPLETED"
    assert import_data["records_imported"] > 0

    # Verify Security Events Query
    events_resp = client.get(
        f"/api/v1/datasets/{dataset_id}/events",
        cookies={"access_token": token}
    )
    assert events_resp.status_code == 200
    events_data = events_resp.json()
    assert len(events_data) > 0
    first_evt = events_data[0]
    assert first_evt["event_type"] is not None

def test_analytics_run_execution():
    token = get_auth_token("soc@sat-sa.local")
    fixture_path = os.path.join(os.path.dirname(__file__), "..", "app", "datasets", "fixtures", "demo_security_events.csv")

    with open(fixture_path, "rb") as f:
        upload_resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("demo_security_events.csv", f, "text/csv")},
            data={"name": "Analytics Pipeline Test"},
            cookies={"access_token": token}
        )
    dataset_id = upload_resp.json()["id"]

    client.post(f"/api/v1/datasets/{dataset_id}/detect-schema", cookies={"access_token": token})
    client.post(f"/api/v1/datasets/{dataset_id}/validate", cookies={"access_token": token})
    client.post(f"/api/v1/datasets/{dataset_id}/import", json={"mode": "BATCH"}, cookies={"access_token": token})

    # Run Analytics
    analytics_resp = client.post(
        "/api/v1/analytics/run",
        json={"dataset_id": dataset_id, "analysis_type": "SECURITY_SUMMARY"},
        cookies={"access_token": token}
    )
    assert analytics_resp.status_code == 201, f"Analytics run failed: {analytics_resp.text}"
    run_data = analytics_resp.json()
    assert run_data["business_id"].startswith("ANL-")
    assert run_data["status"] == "COMPLETED"
    assert run_data["results_summary"] is not None
    assert "severity_distribution" in run_data["results_summary"]
    assert "event_type_distribution" in run_data["results_summary"]
    assert "top_source_ips" in run_data["results_summary"]
    assert "time_distribution" in run_data["results_summary"]

    # Verify Summary
    summary_resp = client.get(
        "/api/v1/analytics/summary",
        cookies={"access_token": token}
    )
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()
    assert summary_data["total_datasets"] >= 1
    assert summary_data["total_events"] >= 1

def test_dataset_list_and_search():
    token = get_auth_token("soc@sat-sa.local")
    response = client.get(
        "/api/v1/datasets?search=Security&limit=10",
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_dataset_unauthenticated_rejected():
    fresh_client = TestClient(app)
    response = fresh_client.get("/api/v1/datasets")
    assert response.status_code in [401, 403]
