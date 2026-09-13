from sqlalchemy import String, ForeignKey, Integer, BigInteger, Float, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import BaseModel
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any


class Dataset(BaseModel):
    __tablename__ = "datasets"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String, default="SIEM")  # SIEM, FIREWALL, EDR, IDENTITY, AUDIT_LOGS, CUSTOM
    
    file_name: Mapped[str] = mapped_column(String)
    file_type: Mapped[str] = mapped_column(String, default="CSV")  # CSV, JSON
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    file_hash: Mapped[str] = mapped_column(String, index=True)  # SHA-256
    storage_path: Mapped[str] = mapped_column(String)
    
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    sector_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sectors.id"), nullable=True)
    related_cse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("cses.id"), nullable=True)
    
    status: Mapped[str] = mapped_column(String, default="UPLOADED")  # UPLOADED, VALIDATING, MAPPING_REQUIRED, READY_TO_IMPORT, IMPORTING, IMPORTED, FAILED
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_record_count: Mapped[int] = mapped_column(Integer, default=0)
    invalid_record_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    
    detected_schema = mapped_column(JSONB, nullable=True)
    column_mapping = mapped_column(JSONB, nullable=True)
    validation_summary = mapped_column(JSONB, nullable=True)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quality_rating: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # EXCELLENT, GOOD, FAIR, POOR
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    organization = relationship("Organization")
    sector = relationship("Sector")
    related_cse = relationship("CSE")
    imports = relationship("DatasetImport", back_populates="dataset", cascade="all, delete-orphan")
    analytics_runs = relationship("AnalyticsRun", back_populates="dataset", cascade="all, delete-orphan")
    security_events = relationship("SecurityEvent", back_populates="dataset")


class DatasetImport(BaseModel):
    __tablename__ = "dataset_imports"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    dataset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("datasets.id"))
    started_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_uri: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String, default="QUEUED")  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    
    records_processed: Mapped[int] = mapped_column(Integer, default=0)
    records_imported: Mapped[int] = mapped_column(Integer, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    
    validation_summary = mapped_column(JSONB, nullable=True)
    import_summary = mapped_column(JSONB, nullable=True)
    error_log = mapped_column(JSONB, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="imports")
    started_by = relationship("User", foreign_keys=[started_by_id])
    security_events = relationship("SecurityEvent", back_populates="dataset_import")


class AnalyticsRun(BaseModel):
    __tablename__ = "analytics_runs"

    business_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    dataset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("datasets.id"))
    initiated_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    analysis_type: Mapped[str] = mapped_column(String, default="BASIC")  # BASIC, TIME_SERIES, DATA_QUALITY, SECURITY_SUMMARY
    status: Mapped[str] = mapped_column(String, default="QUEUED")  # QUEUED, RUNNING, COMPLETED, FAILED
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    records_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    
    results_summary = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="analytics_runs")
    initiated_by = relationship("User", foreign_keys=[initiated_by_id])
