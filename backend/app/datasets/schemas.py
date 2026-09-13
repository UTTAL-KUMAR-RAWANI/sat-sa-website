from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class DatasetBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    source_type: Optional[str] = "SIEM"
    related_cse_id: Optional[uuid.UUID] = None


class DatasetCreate(DatasetBase):
    pass


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    related_cse_id: Optional[uuid.UUID] = None


class ColumnInfo(BaseModel):
    column_name: str
    inferred_type: str
    null_count: int
    sample_values: List[str]


class SchemaDetectionResponse(BaseModel):
    columns: List[ColumnInfo]
    sample_row_count: int
    estimated_total_rows: int
    suggested_mapping: Dict[str, str]


class ColumnMappingRequest(BaseModel):
    column_mapping: Dict[str, str]


class ValidationSummary(BaseModel):
    total_records: int
    valid_records: int
    invalid_records: int
    warning_records: int
    duplicate_records: int
    severity_distribution: Dict[str, int]
    earliest_timestamp: Optional[str] = None
    latest_timestamp: Optional[str] = None
    validity_pct: float
    completeness_pct: float
    conformity_pct: float
    uniqueness_pct: float


class ValidationErrorItem(BaseModel):
    row: int
    status: str
    issues: List[str]
    raw: Dict[str, str]


class ValidationResponse(BaseModel):
    dataset_id: uuid.UUID
    business_id: str
    status: str
    quality_score: Optional[float]
    quality_rating: Optional[str]
    validation_summary: Optional[Dict[str, Any]]
    error_log: List[Dict[str, Any]] = []


class DatasetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    name: str
    description: Optional[str] = None
    source_type: str
    file_name: str
    file_type: str
    file_size: int
    file_hash: str
    uploaded_by_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    sector_id: Optional[uuid.UUID] = None
    related_cse_id: Optional[uuid.UUID] = None
    
    status: str
    record_count: int
    valid_record_count: int
    invalid_record_count: int
    warning_count: int
    duplicate_count: int
    
    detected_schema: Optional[Dict[str, Any]] = None
    column_mapping: Optional[Dict[str, str]] = None
    validation_summary: Optional[Dict[str, Any]] = None
    quality_score: Optional[float] = None
    quality_rating: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Display enrichments
    uploaded_by_name: Optional[str] = None
    organization_name: Optional[str] = None
    sector_name: Optional[str] = None
    related_cse_business_id: Optional[str] = None


class DatasetImportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    dataset_id: uuid.UUID
    started_by_id: uuid.UUID
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    records_processed: int
    records_imported: int
    records_rejected: int
    error_count: int
    validation_summary: Optional[Dict[str, Any]] = None
    import_summary: Optional[Dict[str, Any]] = None
    error_log: Optional[List[Dict[str, Any]]] = None
    started_by_name: Optional[str] = None
class AnalyticsRunCreate(BaseModel):
    dataset_id: uuid.UUID
    analysis_type: Optional[str] = "BASIC"


class AnalyticsRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    dataset_id: uuid.UUID
    initiated_by_id: uuid.UUID
    analysis_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_analyzed: int
    results_summary: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    initiated_by_name: Optional[str] = None


class SecurityEventItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: str
    external_event_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    source: str
    source_system: Optional[str] = None
    event_type: str
    severity: str
    occurred_at: Optional[datetime] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    asset_id: Optional[str] = None
    user_identifier: Optional[str] = None
    action: Optional[str] = None
    status: str
    created_at: datetime
    raw_metadata: Optional[Dict[str, Any]] = None
