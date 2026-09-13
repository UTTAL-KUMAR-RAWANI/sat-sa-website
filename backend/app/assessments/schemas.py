from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# Assessment Enums / Controlled types
class AssessmentType:
    CSE_ASSESSMENT = "CSE_ASSESSMENT"
    SECURITY_CONTROL_ASSESSMENT = "SECURITY_CONTROL_ASSESSMENT"
    COMPLIANCE_ASSESSMENT = "COMPLIANCE_ASSESSMENT"
    FINDING_VALIDATION = "FINDING_VALIDATION"
    FOLLOW_UP_ASSESSMENT = "FOLLOW_UP_ASSESSMENT"

class AssessmentStatus:
    DRAFT = "DRAFT"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    EVIDENCE_REQUIRED = "EVIDENCE_REQUIRED"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    RESUBMITTED = "RESUBMITTED"
    APPROVED = "APPROVED"
    CLOSED = "CLOSED"

class ControlEvaluationStatus:
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    EVIDENCE_REQUIRED = "EVIDENCE_REQUIRED"
    EVALUATED = "EVALUATED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"

class ControlEffectiveness:
    EFFECTIVE = "EFFECTIVE"
    PARTIALLY_EFFECTIVE = "PARTIALLY_EFFECTIVE"
    INEFFECTIVE = "INEFFECTIVE"
    NOT_ASSESSED = "NOT_ASSESSED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


# ----------------------------------------------------
# Assessment Control Schemas
# ----------------------------------------------------
class AssessmentControlCreate(BaseModel):
    control_id: UUID
    evidence_required: Optional[bool] = False
    evaluation_notes: Optional[str] = None

class AssessmentControlUpdate(BaseModel):
    status: Optional[str] = None
    effectiveness: Optional[str] = None
    evaluation_notes: Optional[str] = None
    reviewer_comments: Optional[str] = None
    evidence_required: Optional[bool] = None
    evidence_submitted: Optional[bool] = None
    finding_id: Optional[UUID] = None

class AssessmentControlResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    control_id: UUID
    control_business_id: Optional[str] = None
    control_name: Optional[str] = None
    control_category: Optional[str] = None
    evaluator_id: Optional[UUID] = None
    evaluator_name: Optional[str] = None
    finding_id: Optional[UUID] = None
    finding_business_id: Optional[str] = None
    finding_title: Optional[str] = None
    
    status: str
    effectiveness: str
    evaluation_notes: Optional[str] = None
    reviewer_comments: Optional[str] = None
    evidence: Optional[str] = None
    
    evidence_required: bool
    evidence_submitted: bool
    evidence_verified: bool
    
    evaluated_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Assessment Evidence Schemas
# ----------------------------------------------------
class AssessmentEvidenceItem(BaseModel):
    id: UUID
    business_id: str
    title: str
    description: Optional[str] = None
    evidence_type: str
    file_uri: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None
    control_id: Optional[UUID] = None
    control_business_id: Optional[str] = None
    verification_status: str
    verified_by_id: Optional[UUID] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    reviewer_comments: Optional[str] = None
    uploaded_by_id: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class EvidenceVerifyPayload(BaseModel):
    verification_status: str  # VERIFIED, REJECTED, CHANGES_REQUIRED
    reviewer_comments: Optional[str] = None


# ----------------------------------------------------
# Assessment Finding Schema
# ----------------------------------------------------
class AssessmentFindingItem(BaseModel):
    id: UUID
    business_id: str
    title: str
    severity: str
    priority: str
    status: str
    source_type: str
    control_id: Optional[UUID] = None
    control_business_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AssessmentFindingLinkPayload(BaseModel):
    finding_id: UUID


# ----------------------------------------------------
# Assessment CRUD & Actions
# ----------------------------------------------------
class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assessment_type: str = AssessmentType.SECURITY_CONTROL_ASSESSMENT
    priority: str = "MEDIUM"
    scope: Optional[str] = None
    organization_id: Optional[UUID] = None
    sector_id: Optional[UUID] = None
    cse_id: Optional[UUID] = None
    investigation_id: Optional[UUID] = None
    assessor_id: Optional[UUID] = None
    reviewer_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    control_ids: Optional[List[UUID]] = []

class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assessment_type: Optional[str] = None
    priority: Optional[str] = None
    scope: Optional[str] = None
    due_date: Optional[datetime] = None
    assessor_id: Optional[UUID] = None
    reviewer_id: Optional[UUID] = None

class AssessmentTransitionPayload(BaseModel):
    target_state: Optional[str] = None
    reason: Optional[str] = None
    comments: Optional[str] = None

class AssessmentAssignPayload(BaseModel):
    assessor_id: Optional[UUID] = None
    reviewer_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None

class AssessmentReviewDecisionPayload(BaseModel):
    decision: str  # APPROVE, REQUEST_CHANGES
    comments: str
    control_reviews: Optional[Dict[str, Dict[str, str]]] = None  # control_id -> {status, reviewer_comments}


# ----------------------------------------------------
# Assessment Detailed Response
# ----------------------------------------------------
class AssessmentResponse(BaseModel):
    id: UUID
    business_id: str
    title: str
    description: Optional[str] = None
    assessment_type: str
    status: str
    priority: str
    scope: Optional[str] = None
    
    organization_id: Optional[UUID] = None
    organization_name: Optional[str] = None
    sector_id: Optional[UUID] = None
    sector_name: Optional[str] = None
    
    cse_id: Optional[UUID] = None
    cse_business_id: Optional[str] = None
    cse_title: Optional[str] = None
    
    investigation_id: Optional[UUID] = None
    investigation_business_id: Optional[str] = None
    investigation_title: Optional[str] = None
    
    assessor_id: Optional[UUID] = None
    assessor_name: Optional[str] = None
    reviewer_id: Optional[UUID] = None
    reviewer_name: Optional[str] = None
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    submitted_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    closed_date: Optional[datetime] = None
    
    is_overdue: bool = False
    
    controls_count: int = 0
    evaluated_controls_count: int = 0
    evidence_count: int = 0
    findings_count: int = 0
    
    controls: List[AssessmentControlResponse] = []
    evidence: List[AssessmentEvidenceItem] = []
    findings: List[AssessmentFindingItem] = []
    
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssessmentListResponse(BaseModel):
    items: List[AssessmentResponse]
    total: int
    page: int
    page_size: int


class AssessmentStatsResponse(BaseModel):
    total: int
    draft: int
    assigned: int
    in_progress: int
    evidence_required: int
    submitted: int
    under_review: int
    changes_requested: int
    resubmitted: int
    approved: int
    closed: int
    overdue: int


class AssessmentTimelineEvent(BaseModel):
    event_type: str
    timestamp: datetime
    actor_name: str
    summary: str
    details: Optional[str] = None
