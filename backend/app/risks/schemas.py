from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# ----------------------------------------------------
# Risk Treatments
# ----------------------------------------------------
class RiskTreatmentBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str
    strategy: str = Field(..., description="MITIGATE, ACCEPT, TRANSFER, AVOID")
    mitigation_actions: Optional[str] = None
    transfer_details: Optional[str] = None
    avoidance_details: Optional[str] = None
    justification: Optional[str] = None
    target_date: Optional[datetime] = None
    owner_id: Optional[uuid.UUID] = None


class RiskTreatmentCreate(RiskTreatmentBase):
    pass


class RiskTreatmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    strategy: Optional[str] = None
    status: Optional[str] = None
    mitigation_actions: Optional[str] = None
    transfer_details: Optional[str] = None
    avoidance_details: Optional[str] = None
    justification: Optional[str] = None
    target_date: Optional[datetime] = None
    owner_id: Optional[uuid.UUID] = None


class RiskTreatmentUpdate(BaseModel):
    status: Optional[str] = None
    mitigation_actions: Optional[str] = None
    transfer_details: Optional[str] = None
    avoidance_details: Optional[str] = None
    target_date: Optional[datetime] = None
    owner_id: Optional[uuid.UUID] = None


class RiskTreatmentResponse(RiskTreatmentBase):
    id: uuid.UUID
    business_id: str
    risk_id: uuid.UUID
    status: str
    owner_name: Optional[str] = None
    created_by_id: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Risk Exceptions
# ----------------------------------------------------
class RiskExceptionBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    justification: str = Field(..., min_length=5)
    owner_id: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class RiskExceptionCreate(RiskExceptionBase):
    pass


class RiskExceptionDecision(BaseModel):
    decision: str = Field(..., description="APPROVED or REJECTED")
    reviewer_comments: Optional[str] = None


class RiskExceptionResponse(RiskExceptionBase):
    id: uuid.UUID
    business_id: str
    risk_id: uuid.UUID
    status: str
    requested_by_id: uuid.UUID
    requested_by_name: Optional[str] = None
    owner_name: Optional[str] = None
    approved_by_id: Optional[uuid.UUID] = None
    approved_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Risk Scoring & Assessment Payloads
# ----------------------------------------------------
class InherentAssessmentPayload(BaseModel):
    likelihood: int = Field(..., ge=1, le=5, description="1=Rare to 5=Almost Certain")
    impact: int = Field(..., ge=1, le=5, description="1=Insignificant to 5=Severe")


class ResidualAssessmentPayload(BaseModel):
    residual_likelihood: int = Field(..., ge=1, le=5, description="1=Rare to 5=Almost Certain")
    residual_impact: int = Field(..., ge=1, le=5, description="1=Insignificant to 5=Severe")
    existing_controls_description: Optional[str] = None


class RiskTreatmentDecisionPayload(BaseModel):
    strategy: str = Field(..., description="MITIGATE, ACCEPT, TRANSFER, AVOID")
    target_date: Optional[datetime] = None
    treatment_owner_id: Optional[uuid.UUID] = None
    treatment_description: Optional[str] = None
    mitigation_actions: Optional[str] = None
    transfer_details: Optional[str] = None
    avoidance_details: Optional[str] = None


class RiskAcceptancePayload(BaseModel):
    acceptance_justification: str = Field(..., min_length=5)
    review_date: Optional[datetime] = None


class RiskTransitionPayload(BaseModel):
    target_state: str
    reason: Optional[str] = None


# ----------------------------------------------------
# Risk CRUD Payloads & Responses
# ----------------------------------------------------
class RiskCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    category: str = Field("Cybersecurity", description="Controlled category")
    source: str = Field("MANUAL", description="FINDING, ASSESSMENT, CONTROL, CSE, MANUAL")
    source_reference: Optional[str] = None
    source_id: Optional[uuid.UUID] = None

    finding_id: Optional[uuid.UUID] = None
    assessment_id: Optional[uuid.UUID] = None
    control_id: Optional[uuid.UUID] = None
    cse_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    asset_or_system: Optional[str] = None

    likelihood: int = Field(3, ge=1, le=5)
    impact: int = Field(3, ge=1, le=5)
    existing_controls_description: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    target_date: Optional[datetime] = None


class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    asset_or_system: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    existing_controls_description: Optional[str] = None
    target_date: Optional[datetime] = None
    review_date: Optional[datetime] = None


class RiskResponse(BaseModel):
    id: uuid.UUID
    business_id: str
    title: str
    description: Optional[str] = None
    category: str
    source: str
    source_reference: Optional[str] = None
    source_id: Optional[uuid.UUID] = None
    status: str

    finding_id: Optional[uuid.UUID] = None
    finding_business_id: Optional[str] = None
    finding_title: Optional[str] = None

    assessment_id: Optional[uuid.UUID] = None
    assessment_business_id: Optional[str] = None
    assessment_title: Optional[str] = None

    control_id: Optional[uuid.UUID] = None
    control_business_id: Optional[str] = None
    control_name: Optional[str] = None

    cse_id: Optional[uuid.UUID] = None
    cse_business_id: Optional[str] = None
    cse_title: Optional[str] = None

    organization_id: Optional[uuid.UUID] = None
    organization_name: Optional[str] = None
    sector_id: Optional[uuid.UUID] = None
    sector_name: Optional[str] = None
    asset_or_system: Optional[str] = None

    owner_id: Optional[uuid.UUID] = None
    owner_name: Optional[str] = None
    identified_by_id: Optional[uuid.UUID] = None
    identified_by_name: Optional[str] = None
    accepted_by_id: Optional[uuid.UUID] = None
    accepted_by_name: Optional[str] = None

    likelihood: int
    impact: int
    inherent_score: int
    inherent_risk_level: str

    existing_controls_description: Optional[str] = None

    residual_likelihood: Optional[int] = None
    residual_impact: Optional[int] = None
    residual_score: Optional[int] = None
    residual_risk_level: Optional[str] = None

    treatment_strategy: Optional[str] = None
    treatment_owner_id: Optional[uuid.UUID] = None
    treatment_owner_name: Optional[str] = None
    treatment_target_date: Optional[datetime] = None
    treatment_description: Optional[str] = None

    acceptance_justification: Optional[str] = None
    accepted_at: Optional[datetime] = None
    review_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    is_overdue: bool = False

    treatments_count: int = 0
    exceptions_count: int = 0

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskDetailResponse(RiskResponse):
    treatments: List[RiskTreatmentResponse] = []
    exceptions: List[RiskExceptionResponse] = []


class RiskStatsResponse(BaseModel):
    total_risks: int
    critical: int
    high: int
    medium: int
    low: int
    treatment_required: int
    accepted: int
    overdue: int
    open_exceptions: int
    matrix_distribution: Dict[str, int] # e.g. "4,5": 2


class RiskTimelineEvent(BaseModel):
    id: str
    risk_id: uuid.UUID
    event_type: str
    title: str
    description: str
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
