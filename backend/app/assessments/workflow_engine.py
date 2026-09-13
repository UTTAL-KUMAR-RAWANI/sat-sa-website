from typing import List, Optional, Any
from fastapi import HTTPException
from app.assessments.schemas import AssessmentStatus

# Exact Assessment State Transition Map
ASSESSMENT_TRANSITIONS = {
    AssessmentStatus.DRAFT: [
        AssessmentStatus.ASSIGNED,
        AssessmentStatus.IN_PROGRESS
    ],
    AssessmentStatus.ASSIGNED: [
        AssessmentStatus.IN_PROGRESS
    ],
    AssessmentStatus.IN_PROGRESS: [
        AssessmentStatus.EVIDENCE_REQUIRED,
        AssessmentStatus.SUBMITTED
    ],
    AssessmentStatus.EVIDENCE_REQUIRED: [
        AssessmentStatus.IN_PROGRESS,
        AssessmentStatus.SUBMITTED
    ],
    AssessmentStatus.SUBMITTED: [
        AssessmentStatus.UNDER_REVIEW
    ],
    AssessmentStatus.UNDER_REVIEW: [
        AssessmentStatus.CHANGES_REQUESTED,
        AssessmentStatus.APPROVED
    ],
    AssessmentStatus.CHANGES_REQUESTED: [
        AssessmentStatus.RESUBMITTED,
        AssessmentStatus.IN_PROGRESS
    ],
    AssessmentStatus.RESUBMITTED: [
        AssessmentStatus.UNDER_REVIEW
    ],
    AssessmentStatus.APPROVED: [
        AssessmentStatus.CLOSED
    ],
    AssessmentStatus.CLOSED: []
}

def validate_assessment_transition(
    current_state: str,
    target_state: str,
    user: Any,
    assessment: Any,
    reason: Optional[str] = None,
    comments: Optional[str] = None
) -> None:
    """
    Validates state transitions and enforces Separation of Duties:
    1. Validates that target_state is allowed from current_state.
    2. Enforces Separation of Duties: Assessor/Creator CANNOT approve their own assessment.
    3. Mandates review feedback when requesting changes.
    """
    curr = current_state.upper()
    target = target_state.upper()

    allowed = ASSESSMENT_TRANSITIONS.get(curr, [])
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid assessment state transition from '{curr}' to '{target}'. Allowed transitions: {allowed}"
        )

    actor_id = getattr(user, "id", None)
    assessor_id = getattr(assessment, "assessor_id", None)
    created_by_id = getattr(assessment, "created_by_id", None)

    # Separation of Duties (SoD) Enforcement on Approval
    if target == AssessmentStatus.APPROVED:
        if actor_id:
            if assessor_id and actor_id == assessor_id:
                raise HTTPException(
                    status_code=403,
                    detail="Separation of Duties violation: An Authorized Assessor cannot approve their own assessment."
                )
            if created_by_id and actor_id == created_by_id:
                raise HTTPException(
                    status_code=403,
                    detail="Separation of Duties violation: The assessment creator cannot serve as the final approval authority."
                )

    # Mandatory justification when requesting changes
    if target == AssessmentStatus.CHANGES_REQUESTED:
        note = comments or reason
        if not note or not note.strip():
            raise HTTPException(
                status_code=400,
                detail="Reviewer comments and justification are strictly mandatory when requesting changes on an assessment."
            )
