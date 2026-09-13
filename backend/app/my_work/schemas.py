import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class WorkItem(BaseModel):
    id: str
    item_type: str  # CSE, INVESTIGATION, ASSESSMENT, FINDING, RISK, REMEDIATION, SUPERVISORY_CASE, DECISION
    business_id: str
    title: str
    severity: str   # CRITICAL, HIGH, MEDIUM, LOW, INFO
    status: str
    role_relationship: str  # ASSIGNED, REVIEWER, VALIDATOR, OWNER, SCOPE_CRITICAL
    due_date: Optional[datetime] = None
    is_overdue: bool = False
    needs_review: bool = False
    is_critical: bool = False
    action_url: str
    organization_name: Optional[str] = None
    created_at: datetime


class MyWorkSummaryResponse(BaseModel):
    total_assigned: int
    needs_review_count: int
    overdue_count: int
    critical_count: int
    by_category: dict[str, int]


class MyWorkResponse(BaseModel):
    items: List[WorkItem]
    summary: MyWorkSummaryResponse
    effective_scope: str
