from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime

# ==================== SUPERVISORY CASE SCHEMAS ====================

class SupervisoryCaseBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "HIGH"
    trigger_type: str = "MANUAL_ESCALATION"
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    assigned_analyst_id: Optional[uuid.UUID] = None
    supervisory_authority_id: Optional[uuid.UUID] = None
    source_cse_id: Optional[uuid.UUID] = None
    source_finding_id: Optional[uuid.UUID] = None
    source_risk_id: Optional[uuid.UUID] = None
    source_remediation_id: Optional[uuid.UUID] = None
    source_assessment_id: Optional[uuid.UUID] = None

class SupervisoryCaseCreate(SupervisoryCaseBase):
    pass

class SupervisoryCaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_analyst_id: Optional[uuid.UUID] = None
    supervisory_authority_id: Optional[uuid.UUID] = None
    analyst_notes: Optional[str] = None

class CaseAssignRequest(BaseModel):
    assigned_analyst_id: Optional[uuid.UUID] = None
    supervisory_authority_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None

class CaseStartReviewRequest(BaseModel):
    analyst_notes: Optional[str] = None

class CaseRecommendationRequest(BaseModel):
    recommendation: str
    analyst_notes: Optional[str] = None
    target_status: str = "RECOMMENDATION_READY"

class CaseRequestReviewRequest(BaseModel):
    comments: str

class CaseDecisionRequest(BaseModel):
    decision_type: str  # CLOSE, CONTINUE_MONITORING, REQUIRE_ACTION, ESCALATE, ACCEPT_RISK, REQUEST_REVIEW
    rationale: str
    conditions: Optional[str] = None
    action_required: Optional[str] = None
    effective_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

class CaseCloseRequest(BaseModel):
    reason: Optional[str] = None

class SupervisoryCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    trigger_type: str
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    assigned_analyst_id: Optional[uuid.UUID] = None
    supervisory_authority_id: Optional[uuid.UUID] = None
    decided_by_id: Optional[uuid.UUID] = None
    
    source_cse_id: Optional[uuid.UUID] = None
    source_finding_id: Optional[uuid.UUID] = None
    source_risk_id: Optional[uuid.UUID] = None
    source_remediation_id: Optional[uuid.UUID] = None
    source_assessment_id: Optional[uuid.UUID] = None
    
    analyst_notes: Optional[str] = None
    recommendation: Optional[str] = None
    recommendation_submitted_at: Optional[datetime] = None
    
    final_decision: Optional[str] = None
    decision_reason: Optional[str] = None
    decided_at: Optional[datetime] = None
    
    due_date: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Display names
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    assigned_analyst_name: Optional[str] = None
    supervisory_authority_name: Optional[str] = None
    decided_by_name: Optional[str] = None
    created_by_name: Optional[str] = None

    # Source identifiers
    source_cse_business_id: Optional[str] = None
    source_finding_business_id: Optional[str] = None
    source_risk_business_id: Optional[str] = None
    source_remediation_business_id: Optional[str] = None

# ==================== ESCALATION SCHEMAS ====================

class EscalationCreate(BaseModel):
    resource_type: str  # CSE, FINDING, RISK, REMEDIATION, ASSESSMENT
    resource_id: uuid.UUID
    reason: str
    severity: str = "HIGH"
    priority: str = "HIGH"
    level: str = "LEVEL_1"  # LEVEL_1, LEVEL_2, LEVEL_3
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    escalated_to_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    supervisory_case_id: Optional[uuid.UUID] = None

class EscalationAssignRequest(BaseModel):
    assigned_to_id: uuid.UUID
    notes: Optional[str] = None

class EscalationResolveRequest(BaseModel):
    resolution: str

class EscalationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    resource_type: str
    resource_id: uuid.UUID
    reason: str
    severity: str
    priority: str
    status: str
    level: str
    
    escalated_by_id: uuid.UUID
    escalated_to_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    supervisory_case_id: Optional[uuid.UUID] = None
    
    due_date: Optional[datetime] = None
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    escalated_by_name: Optional[str] = None
    escalated_to_name: Optional[str] = None
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    supervisory_case_business_id: Optional[str] = None
    source_business_id: Optional[str] = None

# ==================== DECISION SCHEMAS ====================

class SupervisoryDecisionCreate(BaseModel):
    supervisory_case_id: uuid.UUID
    decision_type: str
    rationale: str
    conditions: Optional[str] = None
    action_required: Optional[str] = None
    effective_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

class SupervisoryDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    supervisory_case_id: uuid.UUID
    decision_type: str
    status: str
    decision_maker_id: uuid.UUID
    rationale: str
    conditions: Optional[str] = None
    action_required: Optional[str] = None
    effective_date: Optional[datetime] = None
    review_date: Optional[datetime] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    decision_maker_name: Optional[str] = None
    supervisory_case_business_id: Optional[str] = None
    supervisory_case_title: Optional[str] = None

# ==================== SUPERVISORY FINDING SCHEMA ====================

class SupervisoryFindingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "HIGH"
    priority: str = "HIGH"
    classification: str = "Supervisory Finding"
    remediation_required: bool = True
    due_date: Optional[datetime] = None

# ==================== SUMMARY SCHEMAS ====================

class SupervisionSummaryResponse(BaseModel):
    open_cases: int = 0
    critical_escalations: int = 0
    high_risk_findings: int = 0
    critical_risks: int = 0
    overdue_remediations: int = 0
    pending_decisions: int = 0
    cases_awaiting_authority: int = 0
    cases_under_monitoring: int = 0
    priority_distribution: Dict[str, int] = Field(default_factory=dict)
    status_distribution: Dict[str, int] = Field(default_factory=dict)
