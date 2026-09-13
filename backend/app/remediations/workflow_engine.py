from typing import Dict, List, Optional
from fastapi import HTTPException, status
import uuid

from app.models.identity import User
from app.models.remediation import Remediation


class RemediationStatus:
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
    VALIDATION = "VALIDATION"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"


class RemediationWorkflowEngine:
    VALID_TRANSITIONS: Dict[str, List[str]] = {
        RemediationStatus.OPEN: [
            RemediationStatus.ASSIGNED,
            RemediationStatus.IN_PROGRESS
        ],
        RemediationStatus.ASSIGNED: [
            RemediationStatus.IN_PROGRESS,
            RemediationStatus.BLOCKED
        ],
        RemediationStatus.IN_PROGRESS: [
            RemediationStatus.BLOCKED,
            RemediationStatus.EVIDENCE_SUBMITTED,
            RemediationStatus.ASSIGNED
        ],
        RemediationStatus.BLOCKED: [
            RemediationStatus.IN_PROGRESS
        ],
        RemediationStatus.EVIDENCE_SUBMITTED: [
            RemediationStatus.VALIDATION,
            RemediationStatus.VERIFIED,
            RemediationStatus.IN_PROGRESS
        ],
        RemediationStatus.VALIDATION: [
            RemediationStatus.VERIFIED,
            RemediationStatus.IN_PROGRESS # Return for correction
        ],
        RemediationStatus.VERIFIED: [
            RemediationStatus.CLOSED
        ],
        RemediationStatus.CLOSED: []
    }

    @classmethod
    def validate_transition(cls, current_status: str, target_status: str) -> None:
        curr = current_status.upper()
        target = target_status.upper()

        if curr == target:
            return

        allowed = cls.VALID_TRANSITIONS.get(curr, [])
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Illegal remediation state transition from '{curr}' to '{target}'. Allowed targets: {allowed}"
            )

    @classmethod
    def validate_block(cls, blocked_reason: Optional[str]) -> None:
        if not blocked_reason or not blocked_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A detailed blocking reason is mandatory when transitioning remediation to BLOCKED state."
            )

    @classmethod
    def validate_return_for_correction(cls, reviewer_comments: Optional[str]) -> None:
        if not reviewer_comments or not reviewer_comments.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Validator review comments stating deficiencies are mandatory when returning remediation for correction."
            )

    @classmethod
    def validate_verification_sod(cls, remediation: Remediation, actor: User) -> None:
        """
        Enforce Separation of Duties (SoD):
        The remediation owner or implementation assignee cannot verify their own remediation.
        Final validation must be executed by an independent authorized validator.
        """
        if remediation.owner_id and actor.id == remediation.owner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Separation of Duties violation: Remediation owner cannot verify their own remediation. An independent validator is required."
            )
