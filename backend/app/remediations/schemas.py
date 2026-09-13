from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class RemediationEvidenceCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    evidence_type: str = Field("LOG", description="LOG, CONFIGURATION, SCAN_REPORT, POLICY, SCREENSHOT, CHANGE_RECORD")
    file_uri: Optional[str] = None
    file_url: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_file_url(cls, data: Any):
        if isinstance(data, dict):
            if "file_url" in data and "file_uri" not in data:
                data["file_uri"] = data["file_url"]
        return data


class RemediationEvidenceReview(BaseModel):
    verification_status: Optional[str] = None
    status: Optional[str] = None
    reviewer_comments: Optional[str] = None
    comments: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_review_fields(cls, data: Any):
        if isinstance(data, dict):
            if "status" in data and "verification_status" not in data:
                data["verification_status"] = data["status"]
            if "comments" in data and "reviewer_comments" not in data:
                data["reviewer_comments"] = data["comments"]
        return data



class EvidenceItemResponse(BaseModel):
    id: uuid.UUID
    business_id: str
    remediation_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    evidence_type: str
    file_uri: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None
    verification_status: str
    reviewer_comments: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by_id: Optional[uuid.UUID] = None
    verified_by_name: Optional[str] = None
    uploaded_by_id: Optional[uuid.UUID] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RemediationCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    priority: str = Field("MEDIUM", description="CRITICAL, HIGH, MEDIUM, LOW")
    corrective_action: Optional[str] = None
    root_cause: Optional[str] = None
    implementation_steps: Optional[str] = None
    expected_outcome: Optional[str] = None
    completion_criteria: Optional[str] = None
    dependencies: Optional[str] = None
    required_evidence_types: Optional[str] = None

    source: str = Field("FINDING", description="FINDING, RISK, ASSESSMENT, MANUAL")
    source_id: Optional[uuid.UUID] = None
    finding_id: Optional[uuid.UUID] = None
    risk_id: Optional[uuid.UUID] = None
    risk_treatment_id: Optional[uuid.UUID] = None
    control_id: Optional[uuid.UUID] = None

    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None

    owner_id: Optional[uuid.UUID] = None
    assigned_team: Optional[str] = None
    target_date: Optional[datetime] = None
    due_date: Optional[datetime] = None


class RemediationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    corrective_action: Optional[str] = None
    root_cause: Optional[str] = None
    implementation_steps: Optional[str] = None
    expected_outcome: Optional[str] = None
    completion_criteria: Optional[str] = None
    dependencies: Optional[str] = None
    required_evidence_types: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    assigned_team: Optional[str] = None
    target_date: Optional[datetime] = None


class RemediationAssignPayload(BaseModel):
    owner_id: Optional[uuid.UUID] = None
    assigned_team: Optional[str] = None
    target_date: Optional[datetime] = None
    notes: Optional[str] = None


class RemediationBlockPayload(BaseModel):
    blocked_reason: Optional[str] = None
    reason: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_reason(cls, data: Any):
        if isinstance(data, dict):
            if "reason" in data and "blocked_reason" not in data:
                data["blocked_reason"] = data["reason"]
        return data


class RemediationUnblockPayload(BaseModel):
    unblock_notes: Optional[str] = None


class RemediationEvidenceSubmitPayload(BaseModel):
    submission_notes: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_notes(cls, data: Any):
        if isinstance(data, dict):
            if "notes" in data and "submission_notes" not in data:
                data["submission_notes"] = data["notes"]
        return data


class RemediationValidationDecision(BaseModel):
    decision: str = Field(..., description="VERIFIED or RETURNED_FOR_CORRECTION")
    reviewer_comments: Optional[str] = None
    comments: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_comments(cls, data: Any):
        if isinstance(data, dict):
            if "comments" in data and "reviewer_comments" not in data:
                data["reviewer_comments"] = data["comments"]
        return data



class RemediationClosePayload(BaseModel):
    closure_notes: Optional[str] = None


class RemediationResponse(BaseModel):
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str

    source: str
    source_id: Optional[uuid.UUID] = None

    finding_id: Optional[uuid.UUID] = None
    finding_business_id: Optional[str] = None
    finding_title: Optional[str] = None

    risk_id: Optional[uuid.UUID] = None
    risk_business_id: Optional[str] = None
    risk_title: Optional[str] = None

    risk_treatment_id: Optional[uuid.UUID] = None
    risk_treatment_business_id: Optional[str] = None

    control_id: Optional[uuid.UUID] = None
    control_business_id: Optional[str] = None
    control_name: Optional[str] = None

    organization_id: Optional[uuid.UUID] = None
    organization_name: Optional[str] = None
    sector_id: Optional[uuid.UUID] = None
    sector_name: Optional[str] = None

    owner_id: Optional[uuid.UUID] = None
    owner_name: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_by_id: Optional[uuid.UUID] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None

    due_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    blocked_reason: Optional[str] = None
    blocked_by_id: Optional[uuid.UUID] = None
    blocked_by_name: Optional[str] = None
    blocked_at: Optional[datetime] = None

    verified_at: Optional[datetime] = None
    verified_by_id: Optional[uuid.UUID] = None
    verified_by_name: Optional[str] = None
    validator_comments: Optional[str] = None
    validation_decision: Optional[str] = None

    closed_at: Optional[datetime] = None
    closed_by_id: Optional[uuid.UUID] = None
    closed_by_name: Optional[str] = None

    required_evidence_types: Optional[str] = None
    evidence_count: int = 0
    is_overdue: bool = False

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RemediationDetailResponse(RemediationResponse):
    corrective_action: Optional[str] = None
    root_cause: Optional[str] = None
    implementation_steps: Optional[str] = None
    expected_outcome: Optional[str] = None
    completion_criteria: Optional[str] = None
    dependencies: Optional[str] = None

    evidence_items: List[EvidenceItemResponse] = []
    missing_evidence_types: List[str] = []


class RemediationStatsResponse(BaseModel):
    total_remediations: int
    open: int
    assigned: int
    in_progress: int
    blocked: int
    evidence_submitted: int
    validation: int
    verified: int
    closed: int
    overdue: int
    high_critical_count: int
    status_distribution: Dict[str, int]
    priority_distribution: Dict[str, int]


class RemediationTimelineEvent(BaseModel):
    id: str
    remediation_id: uuid.UUID
    event_type: str
    title: str
    description: str
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
