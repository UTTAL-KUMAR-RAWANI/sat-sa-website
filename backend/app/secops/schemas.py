from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any, Generic, TypeVar
import uuid
from datetime import datetime

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int

# --- Security Event Schemas ---

class SecurityEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "GENERIC"
    source: str = "SIEM"
    source_system: Optional[str] = None
    severity: str = "MEDIUM"
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    raw_metadata: Optional[Dict[str, Any]] = None

class SecurityEventCreate(SecurityEventBase):
    pass

class SecurityEventRead(SecurityEventBase):
    id: uuid.UUID
    business_id: str
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Alert Schemas ---

class AlertBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "MEDIUM"
    priority: str = "P3"
    source: str = "SIEM"
    security_event_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    assigned_to_id: Optional[uuid.UUID] = None

class AlertCreate(AlertBase):
    pass

class AlertTriageRequest(BaseModel):
    decision: str  # "FALSE_POSITIVE", "BENIGN", "SUSPICIOUS", "CONFIRMED_SECURITY_EVENT", "ESCALATE"
    notes: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    create_cse: bool = False

class AlertTransitionRequest(BaseModel):
    to_status: str
    reason: Optional[str] = None

class AlertRead(AlertBase):
    id: uuid.UUID
    business_id: str
    status: str
    cse_id: Optional[uuid.UUID] = None
    cse_business_id: Optional[str] = None
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    triage_notes: Optional[str] = None
    triage_decision: Optional[str] = None
    triaged_by_id: Optional[uuid.UUID] = None
    triaged_by_name: Optional[str] = None
    triaged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- CSE Schemas ---

class CSEBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "MEDIUM"
    priority: str = "P3"
    source: str = "ALERT"
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    assigned_to_id: Optional[uuid.UUID] = None

class CSECreate(CSEBase):
    originating_alert_id: Optional[uuid.UUID] = None

class CSEUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None

class CSEAssignRequest(BaseModel):
    assigned_to_id: uuid.UUID
    assignment_type: Optional[str] = "ANALYST"
    notes: Optional[str] = None
    due_at: Optional[datetime] = None

class CSETransitionRequest(BaseModel):
    to_status: str
    reason: Optional[str] = None

class CSEEscalateRequest(BaseModel):
    reason: str
    severity: str = "HIGH"
    escalated_to_role: Optional[str] = None
    escalated_to_user_id: Optional[uuid.UUID] = None

class CSERead(CSEBase):
    id: uuid.UUID
    business_id: str
    status: str
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    created_by_id: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    originating_alert_id: Optional[uuid.UUID] = None
    originating_alert_business_id: Optional[str] = None
    investigation_count: int = 0
    evidence_count: int = 0
    escalation_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Investigation Schemas ---

class InvestigationCreate(BaseModel):
    cse_id: uuid.UUID
    title: str
    description: Optional[str] = None
    lead_analyst_id: Optional[uuid.UUID] = None

class InvestigationUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    lead_analyst_id: Optional[uuid.UUID] = None
    findings_summary: Optional[str] = None

class InvestigationTransitionRequest(BaseModel):
    to_status: str
    reason: Optional[str] = None

class InvestigationRead(BaseModel):
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    status: str
    cse_id: uuid.UUID
    cse_business_id: Optional[str] = None
    cse_title: Optional[str] = None
    lead_analyst_id: Optional[uuid.UUID] = None
    lead_analyst_name: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    findings_summary: Optional[str] = None
    evidence_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Evidence Schemas ---

class EvidenceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    evidence_type: str = "LOG"
    source: Optional[str] = None
    cse_id: Optional[uuid.UUID] = None
    investigation_id: Optional[uuid.UUID] = None

class EvidenceRead(BaseModel):
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    evidence_type: str
    source: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None
    uploaded_by_id: Optional[uuid.UUID] = None
    uploaded_by_name: Optional[str] = None
    cse_id: Optional[uuid.UUID] = None
    investigation_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Escalation Schemas ---

class EscalationCreate(BaseModel):
    resource_type: str  # "ALERT", "CSE", "INVESTIGATION"
    resource_id: uuid.UUID
    reason: str
    severity: str = "HIGH"
    escalated_to_role_id: Optional[uuid.UUID] = None
    escalated_to_id: Optional[uuid.UUID] = None

class EscalationResolveRequest(BaseModel):
    status: str = "RESOLVED"  # "RESOLVED" or "CLOSED"
    resolution: str

class EscalationRead(BaseModel):
    id: uuid.UUID
    business_id: str
    resource_type: str
    resource_id: uuid.UUID
    reason: str
    severity: str
    status: str
    escalated_by_id: uuid.UUID
    escalated_by_name: Optional[str] = None
    escalated_to_id: Optional[uuid.UUID] = None
    escalated_to_name: Optional[str] = None
    escalated_to_role_id: Optional[uuid.UUID] = None
    escalated_to_role_name: Optional[str] = None
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Assignment Schemas ---

class AssignmentCreate(BaseModel):
    resource_type: str
    resource_id: uuid.UUID
    assigned_to_id: uuid.UUID
    assignment_type: Optional[str] = "ANALYST"
    notes: Optional[str] = None
    due_at: Optional[datetime] = None

class AssignmentRead(BaseModel):
    id: uuid.UUID
    resource_type: str
    resource_id: uuid.UUID
    assigned_to_id: uuid.UUID
    assigned_to_name: Optional[str] = None
    assigned_by_id: uuid.UUID
    assigned_by_name: Optional[str] = None
    assignment_type: Optional[str] = None
    status: str
    notes: Optional[str] = None
    due_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Timeline Schema ---

class TimelineEventRead(BaseModel):
    id: str
    event_type: str  # "TRANSITION", "ASSIGNMENT", "ESCALATION", "EVIDENCE", "AUDIT"
    title: str
    description: Optional[str] = None
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
