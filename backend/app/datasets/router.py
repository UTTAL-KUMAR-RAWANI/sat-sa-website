from fastapi import APIRouter, Depends, Query, Path, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.identity import User
from app.rbac.deps import require_permission, require_any_permission, get_effective_scope
from app.rbac import permissions as p
from app.datasets.schemas import (
    DatasetRead,
    DatasetUpdate,
    SchemaDetectionResponse,
    ColumnMappingRequest,
    ValidationResponse,
    DatasetImportRead,
    AnalyticsRunCreate,
    AnalyticsRunRead,
    SecurityEventItem,
)
from app.datasets.service import DatasetService


datasets_router = APIRouter(prefix="/datasets", tags=["Datasets"])
analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])


# 1. List datasets
@datasets_router.get("", response_model=List[DatasetRead])
def list_datasets(
    status: Optional[str] = Query(None, description="Filter by status (UPLOADED, MAPPING_REQUIRED, READY_TO_IMPORT, IMPORTED, FAILED)"),
    file_type: Optional[str] = Query(None, description="Filter by file type (CSV, JSON)"),
    search: Optional[str] = Query(None, description="Search term for name or ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.get_datasets(
        user=current_user,
        effective_scope=effective_scope,
        db=db,
        status_filter=status,
        file_type=file_type,
        search=search,
        skip=skip,
        limit=limit,
    )


# 2. Upload dataset file
@datasets_router.post("/upload", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    source_type: str = Form("SIEM"),
    related_cse_id: Optional[uuid.UUID] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_UPLOAD)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.upload_dataset(
        user=current_user,
        effective_scope=effective_scope,
        file=file,
        name=name,
        description=description,
        source_type=source_type,
        related_cse_id=related_cse_id,
        db=db,
    )


# 3. Get single dataset detail
@datasets_router.get("/{id}", response_model=DatasetRead)
def get_dataset(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.get_dataset(
        user=current_user,
        effective_scope=effective_scope,
        dataset_id=id,
        db=db,
    )


# 4. Update dataset metadata
@datasets_router.patch("/{id}", response_model=DatasetRead)
def update_dataset(
    payload: DatasetUpdate,
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_UPDATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    dataset = DatasetService.get_dataset(current_user, effective_scope, id, db)
    if payload.name is not None:
        dataset.name = payload.name
    if payload.description is not None:
        dataset.description = payload.description
    if payload.related_cse_id is not None:
        dataset.related_cse_id = payload.related_cse_id
    db.commit()
    db.refresh(dataset)
    DatasetService._enrich_dataset_metadata(dataset, db)
    return dataset


# 5. Delete dataset
@datasets_router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_DELETE)),
    effective_scope: str = Depends(get_effective_scope),
):
    DatasetService.delete_dataset(current_user, effective_scope, id, db)
    return None


# 6. Detect schema
@datasets_router.post("/{id}/detect-schema", response_model=SchemaDetectionResponse)
def detect_schema(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.detect_schema_for_dataset(current_user, effective_scope, id, db)


# 7. Preview raw data
@datasets_router.get("/{id}/preview")
def preview_dataset(
    id: uuid.UUID = Path(...),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    dataset = DatasetService.get_dataset(current_user, effective_scope, id, db)
    schema_info = dataset.detected_schema or DatasetService.detect_schema_for_dataset(current_user, effective_scope, id, db)
    return {
        "columns": [c["column_name"] for c in schema_info.get("columns", [])],
        "schema": schema_info.get("columns", []),
        "sample_rows": schema_info.get("sample_row_count", 0),
        "total_estimated_rows": schema_info.get("estimated_total_rows", 0),
        "mapping": dataset.column_mapping or {},
    }


# 8. Set column mapping
@datasets_router.post("/{id}/map-columns", response_model=DatasetRead)
def map_columns(
    payload: ColumnMappingRequest,
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(p.DATASET_UPDATE, p.DATASET_UPLOAD, p.DATASET_CREATE, p.DATASET_VALIDATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.update_column_mapping(
        user=current_user,
        effective_scope=effective_scope,
        dataset_id=id,
        column_mapping=payload.column_mapping,
        db=db,
    )


# 9. Validate dataset
@datasets_router.post("/{id}/validate", response_model=ValidationResponse)
def validate_dataset(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_VALIDATE)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.validate_dataset(
        user=current_user,
        effective_scope=effective_scope,
        dataset_id=id,
        db=db,
    )


# 10. Get validation summary
@datasets_router.get("/{id}/validation", response_model=ValidationResponse)
def get_validation_summary(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    dataset = DatasetService.get_dataset(current_user, effective_scope, id, db)
    return {
        "dataset_id": dataset.id,
        "business_id": dataset.business_id,
        "status": dataset.status,
        "quality_score": dataset.quality_score,
        "quality_rating": dataset.quality_rating,
        "validation_summary": dataset.validation_summary,
        "error_log": [],
    }


# 11. Import dataset records into SecurityEvent
@datasets_router.post("/{id}/import", response_model=DatasetImportRead)
def import_dataset(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_IMPORT)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.import_dataset(
        user=current_user,
        effective_scope=effective_scope,
        dataset_id=id,
        db=db,
    )


# 12. Get import history
@datasets_router.get("/{id}/imports", response_model=List[DatasetImportRead])
def get_dataset_imports(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.get_dataset_imports(current_user, effective_scope, id, db)


# 13. Get imported security events
@datasets_router.get("/{id}/events", response_model=List[SecurityEventItem])
def get_dataset_events(
    id: uuid.UUID = Path(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.DATASET_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.get_dataset_events(current_user, effective_scope, id, db, skip=skip, limit=limit)


# 14. Get or execute dataset analytics
@datasets_router.get("/{id}/analytics")
def get_dataset_analytics(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ANALYTICS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    dataset = DatasetService.get_dataset(current_user, effective_scope, id, db)
    # Check if there is an existing AnalyticsRun
    runs = DatasetService.get_analytics_runs(current_user, effective_scope, id, db)
    if runs and runs[0].results_summary:
        return runs[0].results_summary

    # If no run exists, compute analytics on the fly
    run = DatasetService.run_analytics(current_user, effective_scope, id, "BASIC", db)
    return run.results_summary


# ==========================================
# Analytics Router Endpoints (/api/v1/analytics)
# ==========================================

@analytics_router.get("/runs", response_model=List[AnalyticsRunRead])
def list_analytics_runs(
    dataset_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ANALYTICS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    return DatasetService.get_analytics_runs(current_user, effective_scope, dataset_id, db)


@analytics_router.post("/runs", response_model=AnalyticsRunRead, status_code=status.HTTP_201_CREATED)
@analytics_router.post("/run", response_model=AnalyticsRunRead, status_code=status.HTTP_201_CREATED)
def trigger_analytics_run(
    payload: Optional[AnalyticsRunCreate] = None,
    dataset_id: Optional[uuid.UUID] = Query(None),
    analysis_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ANALYTICS_RUN)),
    effective_scope: str = Depends(get_effective_scope),
):
    target_id = payload.dataset_id if payload else dataset_id
    if not target_id:
        raise HTTPException(status_code=400, detail="dataset_id is required either in request body or query parameter.")
    target_analysis_type = (payload.analysis_type if payload and payload.analysis_type else analysis_type) or "BASIC"
    return DatasetService.run_analytics(current_user, effective_scope, target_id, target_analysis_type, db)


@analytics_router.get("/runs/{id}", response_model=AnalyticsRunRead)
def get_analytics_run(
    id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ANALYTICS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    from app.models.dataset import AnalyticsRun
    run = db.query(AnalyticsRun).filter(AnalyticsRun.id == id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analytics run not found.")
    
    # Check dataset scope
    DatasetService.get_dataset(current_user, effective_scope, run.dataset_id, db)
    if run.initiated_by_id:
        u = db.query(User).filter(User.id == run.initiated_by_id).first()
        if u:
            parts = [p for p in [u.first_name, u.last_name] if p]
            run.initiated_by_name = " ".join(parts) if parts else u.username
        else:
            run.initiated_by_name = None
    return run


@analytics_router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(p.ANALYTICS_READ)),
    effective_scope: str = Depends(get_effective_scope),
):
    from app.models.dataset import Dataset, AnalyticsRun
    from app.models.security import SecurityEvent

    dataset_query = db.query(Dataset)
    events_query = db.query(SecurityEvent)
    runs_query = db.query(AnalyticsRun)

    if effective_scope == "organization" and current_user.organization_id:
        dataset_query = dataset_query.filter(Dataset.organization_id == current_user.organization_id)
        events_query = events_query.filter(SecurityEvent.organization_id == current_user.organization_id)
    elif effective_scope == "sector" and current_user.sector_id:
        dataset_query = dataset_query.filter(Dataset.sector_id == current_user.sector_id)
        events_query = events_query.filter(SecurityEvent.sector_id == current_user.sector_id)

    total_datasets = dataset_query.count()
    imported_datasets = dataset_query.filter(Dataset.status == "IMPORTED").count()
    total_events = events_query.count()
    total_runs = runs_query.count()

    return {
        "total_datasets": total_datasets,
        "imported_datasets": imported_datasets,
        "total_events": total_events,
        "total_analytics_runs": total_runs,
    }
