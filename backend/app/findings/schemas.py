import uuid
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field

FindingSeverity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]
FindingPriority = Literal["URGENT", "HIGH", "MEDIUM", "LOW"]
FindingStatus = Literal[
    "IDENTIFIED",
    "DRAFT",
    "SUBMITTED",
    "REVIEW",
    "CONFIRMED",
    "REMEDIATION_REQUIRED",
    "REMEDIATION",
    "VALIDATION",
    "CLOSED",
    "REJECTED"
]
FindingSourceType = Literal[
    "CSE",
    "INVESTIGATION",
    "ASSESSMENT",
    "AUDIT",
    "RISK_ANALYSIS",
    "NEGATIVE_SPACE",
    "SUPERVISORY_REVIEW"
]
FindingCommentType = Literal["REVIEW_NOTE", "CHANGE_REQUEST", "DECISION_NOTE", "GENERAL_COMMENT"]

class FindingCommentCreate(BaseModel):
    comment: str = Field(..., min_length=1)
    comment_type: FindingCommentType = "GENERAL_COMMENT"

class FindingCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    finding_id: uuid.UUID
    author_id: uuid.UUID
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    comment: str
    comment_type: str
    created_at: datetime

class FindingCreate(BaseModel):
    title: str = Field(..., min_length=3)
    description: Optional[str] = None
    severity: FindingSeverity = "MEDIUM"
    priority: FindingPriority = "MEDIUM"
    classification: str = "Security"
    source_type: FindingSourceType = "INVESTIGATION"
    source_id: Optional[uuid.UUID] = None
    cse_id: Optional[uuid.UUID] = None
    investigation_id: Optional[uuid.UUID] = None
    control_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    assigned_to_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None

class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[FindingSeverity] = None
    priority: Optional[FindingPriority] = None
    classification: Optional[str] = None
    due_date: Optional[datetime] = None
    control_id: Optional[uuid.UUID] = None

class FindingTransitionRequest(BaseModel):
    target_state: FindingStatus
    reason: Optional[str] = None
    review_notes: Optional[str] = None
    remediation_required: Optional[bool] = None

class FindingAssignRequest(BaseModel):
    assigned_to_id: uuid.UUID
    due_date: Optional[datetime] = None
    notes: Optional[str] = None

class FindingEvidenceItem(BaseModel):
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    evidence_type: str
    file_uri: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None
    created_at: datetime
    uploaded_by_name: Optional[str] = None

class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    severity: str
    priority: str
    status: str
    classification: str
    source_type: str
    source_id: Optional[uuid.UUID] = None
    
    # Linked entities
    cse_id: Optional[uuid.UUID] = None
    cse_business_id: Optional[str] = None
    cse_title: Optional[str] = None
    
    investigation_id: Optional[uuid.UUID] = None
    investigation_business_id: Optional[str] = None
    investigation_title: Optional[str] = None
    
    control_id: Optional[uuid.UUID] = None
    control_business_id: Optional[str] = None
    control_name: Optional[str] = None
    
    organization_id: Optional[uuid.UUID] = None
    organization_name: Optional[str] = None
    sector_id: Optional[uuid.UUID] = None
    sector_name: Optional[str] = None
    
    created_by_id: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    
    assigned_to_id: Optional[uuid.UUID] = None
    assigned_to_name: Optional[str] = None
    assigned_by_id: Optional[uuid.UUID] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    due_date: Optional[datetime] = None
    is_overdue: bool = False
    remediation_required: bool = False
    
    created_at: datetime
    updated_at: datetime
    
    evidence: List[FindingEvidenceItem] = []
    comments: List[FindingCommentRead] = []
    
    # Related foundations
    has_related_remediation: bool = False
    related_remediation_id: Optional[uuid.UUID] = None
    has_related_risk: bool = False
    related_risk_id: Optional[uuid.UUID] = None

class FindingListResponse(BaseModel):
    items: List[FindingRead]
    total: int
    page: int
    page_size: int

class FindingStatsResponse(BaseModel):
    total: int
    critical: int
    high: int
    medium: int
    low: int
    informational: int
    under_review: int
    confirmed: int
    remediation_required: int
    overdue: int
    closed: int

class FindingTimelineEvent(BaseModel):
    event_type: str
    timestamp: datetime
    actor_name: str
    summary: str
    details: Optional[str] = None
