from sqlalchemy import String, ForeignKey, Text, Uuid, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
import uuid
from datetime import datetime

class WorkflowTransition(BaseModel):
    __tablename__ = "workflow_transitions"
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    from_state: Mapped[str] = mapped_column(String)
    to_state: Mapped[str] = mapped_column(String)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    
    actor = relationship("User", foreign_keys=[actor_id])

class Assignment(BaseModel):
    __tablename__ = "assignments"
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assignment_type: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

class Escalation(BaseModel):
    __tablename__ = "escalations"
    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    reason: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String, default="HIGH")
    priority: Mapped[str] = mapped_column(String, default="HIGH")  # LOW, MEDIUM, HIGH, CRITICAL
    status: Mapped[str] = mapped_column(String, default="OPEN")  # OPEN, ACKNOWLEDGED, IN_REVIEW, ACTION_REQUIRED, RESOLVED, CLOSED
    level: Mapped[str] = mapped_column(String, default="LEVEL_1")  # LEVEL_1, LEVEL_2, LEVEL_3
    
    escalated_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    escalated_to_role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=True)
    escalated_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    supervisory_case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("supervisory_cases.id"), nullable=True)
    
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution: Mapped[str] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    escalated_by = relationship("User", foreign_keys=[escalated_by_id])
    escalated_to = relationship("User", foreign_keys=[escalated_to_id])
    escalated_to_role = relationship("Role", foreign_keys=[escalated_to_role_id])
    organization = relationship("Organization")
    sector = relationship("Sector")
    supervisory_case = relationship("SupervisoryCase", back_populates="escalations")

class Approval(BaseModel):
    __tablename__ = "approvals"
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    approver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="PENDING")
    comments: Mapped[str] = mapped_column(Text, nullable=True)
    
    approver = relationship("User", foreign_keys=[approver_id])
