from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.identity import User
from app.rbac.deps import get_current_user, get_effective_scope
from app.my_work.service import MyWorkService
from app.my_work.schemas import (
    MyWorkResponse,
    MyWorkSummaryResponse,
)

my_work_router = APIRouter(prefix="/my-work", tags=["My Work & Attention Center"])


@my_work_router.get(
    "",
    response_model=MyWorkResponse,
    summary="Get user-specific assigned work, reviews, and overdue items across all workflows",
)
def get_my_work(
    bucket: str = Query("all", pattern="^(all|assigned|needs_review|overdue|critical)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    effective_scope: str = Depends(get_effective_scope),
):
    return MyWorkService.get_my_work(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
        bucket=bucket,
    )


@my_work_router.get(
    "/summary",
    response_model=MyWorkSummaryResponse,
    summary="Get summary counts for attention buckets (needs review, overdue, critical, assigned)",
)
def get_my_work_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    effective_scope: str = Depends(get_effective_scope),
):
    return MyWorkService.get_summary(
        db=db,
        user=current_user,
        effective_scope=effective_scope,
    )
