import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.identity import User
from app.models.assessment import Assessment, AssessmentControl
from app.models.control import Control
from app.models.security import Evidence

client = TestClient(app)
DEMO_PASS = "DemoPassword123!"

def login_user(email: str, password: str = DEMO_PASS) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Failed to login user {email}: {resp.text}"
    return resp.cookies.get("access_token")


def test_assessment_creation_and_scoping():
    assessor_token = login_user("assessor@sat-sa.local")
    
    # 1. Fetch available controls
    db = SessionLocal()
    ctrl = db.query(Control).filter(Control.business_id == "CTRL-2026-00001").first()
    db.close()
    assert ctrl is not None

    # 2. Create Assessment as Authorized Assessor
    payload = {
        "title": "API Gateway Zero-Trust Evaluation",
        "description": "Assessment of edge authentication and policy enforcement points.",
        "assessment_type": "SECURITY_CONTROL_ASSESSMENT",
        "priority": "HIGH",
        "scope": "Edge gateways and API proxies.",
        "due_date": "2026-10-01T00:00:00Z",
        "control_ids": [str(ctrl.id)]
    }
    create_resp = client.post("/api/v1/assessments", json=payload, cookies={"access_token": assessor_token})
    assert create_resp.status_code == 200, create_resp.text
    data = create_resp.json()
    assert data["business_id"].startswith("ASM-2026-")
    assert data["title"] == "API Gateway Zero-Trust Evaluation"
    assert len(data["controls"]) == 1
    assert data["controls"][0]["control_business_id"] == "CTRL-2026-00001"

    # 3. Test Scope Isolation: SOC analyst (NCB) cannot access Apex Power Grid assessment ASM-2026-00005
    db = SessionLocal()
    apex_asm = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00005").first()
    db.close()
    assert apex_asm is not None

    soc_token = login_user("soc@sat-sa.local")
    cross_org_resp = client.get(f"/api/v1/assessments/{apex_asm.id}", cookies={"access_token": soc_token})
    assert cross_org_resp.status_code == 403
    assert "outside your authorized" in cross_org_resp.json()["detail"]


def test_control_evaluation_and_evidence_attachment():
    assessor_token = login_user("assessor@sat-sa.local")
    auditor_token = login_user("auditor@sat-sa.local")

    # Get ASM-2026-00001
    db = SessionLocal()
    asm = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00001").first()
    assert asm is not None
    ac = db.query(AssessmentControl).filter(AssessmentControl.assessment_id == asm.id).first()
    assert ac is not None
    ac_id = ac.id
    asm_id = asm.id
    db.close()

    # Assessor updates control evaluation
    eval_payload = {
        "status": "EVALUATED",
        "effectiveness": "EFFECTIVE",
        "evaluation_notes": "All jump host interfaces require FIDO2 keys as of today."
    }
    eval_resp = client.patch(
        f"/api/v1/assessments/{asm_id}/controls/{ac_id}",
        json=eval_payload,
        cookies={"access_token": assessor_token}
    )
    assert eval_resp.status_code == 200, eval_resp.text
    eval_data = eval_resp.json()
    assert eval_data["status"] == "EVALUATED"
    assert eval_data["effectiveness"] == "EFFECTIVE"

    # Auditor verifies evidence
    db = SessionLocal()
    evd = db.query(Evidence).filter(Evidence.assessment_id == asm_id).first()
    evd_id = evd.id if evd else None
    db.close()

    if evd_id:
        verify_payload = {
            "verification_status": "VERIFIED",
            "reviewer_comments": "Configuration baseline inspected and verified."
        }
        ver_resp = client.post(
            f"/api/v1/assessments/{asm_id}/evidence/{evd_id}/verify",
            json=verify_payload,
            cookies={"access_token": auditor_token}
        )
        assert ver_resp.status_code == 200, ver_resp.text
        assert ver_resp.json()["verification_status"] == "VERIFIED"


def test_assessment_lifecycle_and_separation_of_duties():
    assessor_token = login_user("assessor@sat-sa.local")
    auditor_token = login_user("auditor@sat-sa.local")

    # Create a fresh assessment to test the full lifecycle
    payload = {
        "title": "Separation of Duties Validation Assessment",
        "assessment_type": "SECURITY_CONTROL_ASSESSMENT",
        "priority": "HIGH"
    }
    res = client.post("/api/v1/assessments", json=payload, cookies={"access_token": assessor_token})
    assert res.status_code == 200
    asm_id = res.json()["id"]

    # Assign assessor and auditor
    db = SessionLocal()
    assessor_u = db.query(User).filter(User.email == "assessor@sat-sa.local").first()
    auditor_u = db.query(User).filter(User.email == "auditor@sat-sa.local").first()
    db.close()

    assign_payload = {
        "assessor_id": str(assessor_u.id),
        "reviewer_id": str(auditor_u.id)
    }
    client.post(
        f"/api/v1/assessments/{asm_id}/assign",
        json=assign_payload,
        cookies={"access_token": assessor_token}
    )

    # Start assessment
    start_res = client.post(f"/api/v1/assessments/{asm_id}/start", cookies={"access_token": assessor_token})
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "IN_PROGRESS"

    # Invalid jump: IN_PROGRESS -> APPROVED directly must fail with 400
    bad_jump = client.post(
        f"/api/v1/assessments/{asm_id}/transition",
        json={"target_state": "APPROVED"},
        cookies={"access_token": auditor_token}
    )
    assert bad_jump.status_code == 400

    # Submit assessment
    submit_res = client.post(f"/api/v1/assessments/{asm_id}/submit", cookies={"access_token": assessor_token})
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "SUBMITTED"

    # Auditor transitions to UNDER_REVIEW
    review_res = client.post(
        f"/api/v1/assessments/{asm_id}/transition",
        json={"target_state": "UNDER_REVIEW"},
        cookies={"access_token": auditor_token}
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "UNDER_REVIEW"

    # SEPARATION OF DUTIES TEST:
    # 1. Assessor (Alice) attempts to approve -> Rejected with 403 Forbidden
    self_approve = client.post(
        f"/api/v1/assessments/{asm_id}/approve",
        json={"comments": "Self approving my work"},
        cookies={"access_token": assessor_token}
    )
    assert self_approve.status_code == 403
    assert "forbidden" in self_approve.json()["detail"].lower() or "permission denied" in self_approve.json()["detail"].lower()

    # 2. Test SoD Engine Check: A user with 'assessment.approve' permission (Auditor Arthur)
    # who is also the designated assessor on an assessment attempts to self-approve:
    db = SessionLocal()
    auditor_user = db.query(User).filter(User.email == "auditor@sat-sa.local").first()
    db.close()

    # Create assessment where Auditor Arthur is designated as the assessor
    sod_asm_res = client.post(
        "/api/v1/assessments",
        json={
            "title": "SoD Conflict Verification Assessment",
            "assessment_type": "SECURITY_CONTROL_ASSESSMENT",
            "assessor_id": str(auditor_user.id)
        },
        cookies={"access_token": assessor_token}
    )
    assert sod_asm_res.status_code == 200
    sod_asm_id = sod_asm_res.json()["id"]

    # Transition to UNDER_REVIEW
    client.post(f"/api/v1/assessments/{sod_asm_id}/start", cookies={"access_token": assessor_token})
    client.post(f"/api/v1/assessments/{sod_asm_id}/submit", cookies={"access_token": assessor_token})
    client.post(
        f"/api/v1/assessments/{sod_asm_id}/transition",
        json={"target_state": "UNDER_REVIEW"},
        cookies={"access_token": auditor_token}
    )

    # Now Auditor Arthur tries to approve their own assessment
    sod_rejection = client.post(
        f"/api/v1/assessments/{sod_asm_id}/approve",
        json={"comments": "Auditor self approving an assessment they assessed"},
        cookies={"access_token": auditor_token}
    )
    assert sod_rejection.status_code == 403
    assert "Separation of Duties violation" in sod_rejection.json()["detail"]

    # 3. Independent Auditor Reviewer approves the original assessment
    approved_res = client.post(
        f"/api/v1/assessments/{asm_id}/approve",
        json={"comments": "Formally verified by independent reviewer"},
        cookies={"access_token": auditor_token}
    )
    assert approved_res.status_code == 200
    assert approved_res.json()["status"] == "APPROVED"
    assert approved_res.json()["approved_date"] is not None


def test_changes_requested_and_resubmission_flow():
    assessor_token = login_user("assessor@sat-sa.local")
    auditor_token = login_user("auditor@sat-sa.local")

    # Create assessment
    res = client.post(
        "/api/v1/assessments",
        json={"title": "Change Request Flow Test", "assessment_type": "COMPLIANCE_ASSESSMENT"},
        cookies={"access_token": assessor_token}
    )
    asm_id = res.json()["id"]

    # Start -> Submit -> Under Review
    client.post(f"/api/v1/assessments/{asm_id}/start", cookies={"access_token": assessor_token})
    client.post(f"/api/v1/assessments/{asm_id}/submit", cookies={"access_token": assessor_token})
    client.post(
        f"/api/v1/assessments/{asm_id}/transition",
        json={"target_state": "UNDER_REVIEW"},
        cookies={"access_token": auditor_token}
    )

    # Auditor requests changes WITHOUT justification -> must fail 400
    fail_cr = client.post(
        f"/api/v1/assessments/{asm_id}/request-changes",
        json={"comments": ""},
        cookies={"access_token": auditor_token}
    )
    assert fail_cr.status_code == 400
    assert "mandatory" in fail_cr.json()["detail"]

    # Auditor requests changes WITH justification
    cr_res = client.post(
        f"/api/v1/assessments/{asm_id}/request-changes",
        json={"comments": "Please attach the cryptographic key management policy."},
        cookies={"access_token": auditor_token}
    )
    assert cr_res.status_code == 200
    assert cr_res.json()["status"] == "CHANGES_REQUESTED"

    # Assessor resubmits
    resubmit_res = client.post(
        f"/api/v1/assessments/{asm_id}/resubmit",
        json={"comments": "Uploaded KMS policy evidence."},
        cookies={"access_token": assessor_token}
    )
    assert resubmit_res.status_code == 200
    # Auto-routes to UNDER_REVIEW
    assert resubmit_res.json()["status"] == "UNDER_REVIEW"


def test_review_queue_and_stats():
    auditor_token = login_user("auditor@sat-sa.local")

    # Fetch review queue
    rq_res = client.get("/api/v1/assessments/review-queue", cookies={"access_token": auditor_token})
    assert rq_res.status_code == 200
    items = rq_res.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    # Check that returned items have review statuses
    for item in items:
        assert item["status"] in ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "RESUBMITTED"]

    # Fetch stats
    stats_res = client.get("/api/v1/assessments/stats", cookies={"access_token": auditor_token})
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total" in stats
    assert "under_review" in stats
    assert "approved" in stats
    assert stats["total"] >= 1
