import os
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, select

from app.models.dataset import Dataset, DatasetImport, AnalyticsRun
from app.models.security import SecurityEvent, CSE
from app.models.identity import User
from app.models.organization import Organization, Sector
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.rbac.scopes import ScopeType, check_resource_scope
from app.datasets.pipeline import DatasetPipeline, DATASET_STORAGE_DIR
from app.core.config import settings

def _format_user_name(u: Optional[User]) -> Optional[str]:
    if not u:
        return None
    name_parts = [p for p in [u.first_name, u.last_name] if p]
    return " ".join(name_parts) if name_parts else u.username


class DatasetService:

    @staticmethod
    def _generate_business_id(prefix: str, model_cls: Any, db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        year_prefix = f"{prefix}-{current_year}-"
        
        last_obj = (
            db.query(model_cls)
            .filter(model_cls.business_id.like(f"{year_prefix}%"))
            .order_by(desc(model_cls.business_id))
            .first()
        )
        
        if last_obj and last_obj.business_id:
            try:
                seq = int(last_obj.business_id.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
            
        return f"{year_prefix}{seq:05d}"

    @staticmethod
    def _audit(
        action: str,
        resource_type: str,
        resource_id: Any,
        old_val: Optional[Dict],
        new_val: Optional[Dict],
        actor_id: uuid.UUID,
        db: Session
    ):
        try:
            parsed_id = None
            if isinstance(resource_id, uuid.UUID):
                parsed_id = resource_id
            elif isinstance(resource_id, str):
                try:
                    parsed_id = uuid.UUID(resource_id)
                except (ValueError, TypeError):
                    parsed_id = None

            audit = AuditLog(
                actor_user_id=actor_id,
                action=action,
                resource_type=resource_type,
                resource_id=parsed_id,
                old_value=json.dumps(old_val) if old_val else None,
                new_value=json.dumps(new_val) if new_val else None,
            )
            db.add(audit)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[AuditLog Error] Failed to write audit: {e}")

    @staticmethod
    def _notify(
        recipient_id: uuid.UUID,
        title: str,
        message: str,
        notif_type: str,
        db: Session
    ):
        try:
            notif = Notification(
                recipient_id=recipient_id,
                title=title,
                message=message,
                type=notif_type,
                is_read=False,
            )
            db.add(notif)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[Notification Error] Failed to write notification: {e}")

    @classmethod
    def get_datasets(
        cls,
        user: User,
        effective_scope: str,
        db: Session,
        status_filter: Optional[str] = None,
        file_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dataset]:
        query = db.query(Dataset)

        # Scope filtering
        if effective_scope == ScopeType.SECTOR:
            if user.sector_id:
                query = query.filter(Dataset.sector_id == user.sector_id)
            else:
                return []
        elif effective_scope == ScopeType.ORGANIZATION:
            if user.organization_id:
                query = query.filter(Dataset.organization_id == user.organization_id)
            else:
                return []
        elif effective_scope == ScopeType.OWN:
            query = query.filter(Dataset.uploaded_by_id == user.id)

        if status_filter and status_filter.upper() != "ALL":
            query = query.filter(Dataset.status == status_filter.upper())

        if file_type and file_type.upper() != "ALL":
            query = query.filter(Dataset.file_type == file_type.upper())

        if search:
            q_str = f"%{search}%"
            query = query.filter(
                (Dataset.name.ilike(q_str)) |
                (Dataset.business_id.ilike(q_str)) |
                (Dataset.description.ilike(q_str)) |
                (Dataset.file_name.ilike(q_str))
            )

        datasets = query.order_by(desc(Dataset.created_at)).offset(skip).limit(limit).all()

        for d in datasets:
            cls._enrich_dataset_metadata(d, db)

        return datasets

    @classmethod
    def get_dataset(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> Dataset:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found.")

        if not check_resource_scope(user, effective_scope, dataset):
            raise HTTPException(status_code=403, detail="Scope access denied for this dataset.")

        cls._enrich_dataset_metadata(dataset, db)
        return dataset

    @classmethod
    def upload_dataset(
        cls,
        user: User,
        effective_scope: str,
        file: UploadFile,
        name: str,
        description: Optional[str],
        source_type: str,
        related_cse_id: Optional[uuid.UUID],
        db: Session,
    ) -> Dataset:
        # Validate and persist file
        max_size = getattr(settings, "MAX_UPLOAD_SIZE_BYTES", 52428800)
        safe_filename, file_type, file_size, file_hash = DatasetPipeline.validate_and_save_upload(file, max_size)

        # Check for potential duplicate upload
        existing_dup = db.query(Dataset).filter(
            Dataset.file_hash == file_hash,
            Dataset.organization_id == user.organization_id,
        ).first()

        biz_id = cls._generate_business_id("DS", Dataset, db)

        dataset = Dataset(
            business_id=biz_id,
            name=name,
            description=description,
            source_type=source_type or "SIEM",
            file_name=file.filename or safe_filename,
            file_type=file_type,
            file_size=file_size,
            file_hash=file_hash,
            storage_path=safe_filename,
            uploaded_by_id=user.id,
            organization_id=user.organization_id,
            sector_id=user.sector_id,
            related_cse_id=related_cse_id,
            status="UPLOADED",
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        # Automatic schema detection step
        try:
            schema_info = DatasetPipeline.detect_schema(safe_filename, file_type)
            dataset.detected_schema = schema_info
            dataset.column_mapping = schema_info.get("suggested_mapping", {})
            dataset.record_count = schema_info.get("estimated_total_rows", 0)
            dataset.status = "MAPPING_REQUIRED"
            db.commit()
            db.refresh(dataset)
        except Exception as e:
            dataset.status = "FAILED"
            dataset.error_message = f"Schema detection failed: {str(e)}"
            db.commit()

        # Audit & Notification
        cls._audit(
            action="DATASET_UPLOADED",
            resource_type="DATASET",
            resource_id=dataset.business_id,
            old_val=None,
            new_val={"name": name, "file_name": file.filename, "size": file_size, "hash": file_hash},
            actor_id=user.id,
            db=db,
        )

        cls._notify(
            recipient_id=user.id,
            title="Dataset Upload Complete",
            message=f"Dataset '{name}' ({biz_id}) was successfully uploaded and schema analyzed.",
            notif_type="DATASET_UPLOAD",
            db=db,
        )

        cls._enrich_dataset_metadata(dataset, db)
        return dataset

    @classmethod
    def detect_schema_for_dataset(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> Dict[str, Any]:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        schema_info = DatasetPipeline.detect_schema(dataset.storage_path, dataset.file_type)
        
        dataset.detected_schema = schema_info
        if not dataset.column_mapping:
            dataset.column_mapping = schema_info.get("suggested_mapping", {})
        dataset.status = "MAPPING_REQUIRED"
        db.commit()

        cls._audit(
            action="DATASET_SCHEMA_DETECTED",
            resource_type="DATASET",
            resource_id=dataset.business_id,
            old_val=None,
            new_val={"columns_detected": len(schema_info.get("columns", []))},
            actor_id=user.id,
            db=db,
        )
        return schema_info

    @classmethod
    def update_column_mapping(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        column_mapping: Dict[str, str],
        db: Session,
    ) -> Dataset:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        old_mapping = dataset.column_mapping

        dataset.column_mapping = column_mapping
        dataset.status = "MAPPED"
        db.commit()
        db.refresh(dataset)

        cls._audit(
            action="DATASET_COLUMN_MAPPING_UPDATED",
            resource_type="DATASET",
            resource_id=dataset.id,
            old_val={"mapping": old_mapping},
            new_val={"mapping": column_mapping},
            actor_id=user.id,
            db=db,
        )

        cls._enrich_dataset_metadata(dataset, db)
        return dataset

    @classmethod
    def validate_dataset(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> Dict[str, Any]:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        if not dataset.column_mapping:
            raise HTTPException(
                status_code=400,
                detail="Column mapping must be configured before running validation."
            )

        dataset.status = "VALIDATING"
        db.commit()

        try:
            res = DatasetPipeline.validate_dataset_data(
                dataset.storage_path,
                dataset.file_type,
                dataset.column_mapping,
            )

            dataset.record_count = res["total_records"]
            dataset.valid_record_count = res["valid_records"]
            dataset.invalid_record_count = res["invalid_records"]
            dataset.warning_count = res["warning_records"]
            dataset.duplicate_count = res["duplicate_records"]
            dataset.validation_summary = res["validation_summary"]
            dataset.quality_score = res["quality_score"]
            dataset.quality_rating = res["quality_rating"]
            dataset.status = "READY_TO_IMPORT" if res["valid_records"] > 0 else "FAILED"
            db.commit()
            db.refresh(dataset)

            cls._audit(
                action="DATASET_VALIDATED",
                resource_type="DATASET",
                resource_id=dataset.business_id,
                old_val=None,
                new_val={
                    "total": res["total_records"],
                    "valid": res["valid_records"],
                    "score": res["quality_score"],
                    "rating": res["quality_rating"]
                },
                actor_id=user.id,
                db=db,
            )

            cls._notify(
                recipient_id=user.id,
                title="Dataset Validation Complete",
                message=f"Dataset {dataset.business_id} validated with quality score {res['quality_score']}% ({res['quality_rating']}).",
                notif_type="DATASET_VALIDATION",
                db=db,
            )

            return {
                "dataset_id": dataset.id,
                "business_id": dataset.business_id,
                "status": dataset.status,
                "quality_score": res["quality_score"],
                "quality_rating": res["quality_rating"],
                "validation_summary": res["validation_summary"],
                "error_log": res["error_log"],
            }

        except Exception as e:
            dataset.status = "FAILED"
            dataset.error_message = f"Validation failed: {str(e)}"
            db.commit()
            raise HTTPException(status_code=400, detail=f"Dataset validation failed: {str(e)}")

    @classmethod
    def import_dataset(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> DatasetImport:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        if dataset.status not in ["READY_TO_IMPORT", "IMPORTED", "MAPPING_REQUIRED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset cannot be imported in status '{dataset.status}'. Must be validated first."
            )

        if not dataset.column_mapping:
            raise HTTPException(status_code=400, detail="Column mapping is required for import.")

        # Create import record
        imp_biz_id = cls._generate_business_id("IMP", DatasetImport, db)
        dataset_import = DatasetImport(
            business_id=imp_biz_id,
            dataset_id=dataset.id,
            started_by_id=user.id,
            uploaded_by_id=user.id,
            file_uri=dataset.storage_path,
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
        )
        db.add(dataset_import)
        dataset.status = "IMPORTING"
        db.commit()
        db.refresh(dataset_import)

        try:
            res = DatasetPipeline.import_records(
                storage_filename=dataset.storage_path,
                file_type=dataset.file_type,
                column_mapping=dataset.column_mapping,
                dataset_id=dataset.id,
                dataset_import_id=dataset_import.id,
                organization_id=dataset.organization_id,
                sector_id=dataset.sector_id,
                related_cse_id=dataset.related_cse_id,
                db=db,
            )

            dataset_import.records_processed = res["records_processed"]
            dataset_import.records_imported = res["records_imported"]
            dataset_import.records_rejected = res["records_rejected"]
            dataset_import.error_count = res["records_rejected"]
            dataset_import.import_summary = res["import_summary"]
            dataset_import.error_log = res["error_log"]
            dataset_import.completed_at = datetime.now(timezone.utc)
            dataset_import.status = "COMPLETED"

            dataset.status = "IMPORTED"
            db.commit()
            db.refresh(dataset_import)

            # Automatically calculate and cache initial deterministic analytics
            try:
                cls.run_analytics(user, effective_scope, dataset.id, "BASIC", db)
            except Exception as e:
                print(f"[Analytics Run Warning] Automatic analytics run failed: {e}")

            cls._audit(
                action="DATASET_IMPORTED",
                resource_type="DATASET_IMPORT",
                resource_id=dataset_import.business_id,
                old_val=None,
                new_val={
                    "dataset_id": dataset.business_id,
                    "imported": res["records_imported"],
                    "rejected": res["records_rejected"]
                },
                actor_id=user.id,
                db=db,
            )

            cls._notify(
                recipient_id=user.id,
                title="Dataset Import Complete",
                message=f"{res['records_imported']} security events ingested from {dataset.business_id}.",
                notif_type="DATASET_IMPORT",
                db=db,
            )

            return dataset_import

        except Exception as e:
            dataset_import.status = "FAILED"
            dataset_import.completed_at = datetime.now(timezone.utc)
            dataset.status = "FAILED"
            dataset.error_message = f"Import failed: {str(e)}"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Import execution error: {str(e)}")

    @classmethod
    def get_dataset_imports(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> List[DatasetImport]:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        imports = (
            db.query(DatasetImport)
            .filter(DatasetImport.dataset_id == dataset.id)
            .order_by(desc(DatasetImport.started_at))
            .all()
        )
        for imp in imports:
            if imp.started_by_id:
                u = db.query(User).filter(User.id == imp.started_by_id).first()
                imp.started_by_name = _format_user_name(u)
        return imports

    @classmethod
    def get_dataset_events(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
        skip: int = 0,
        limit: int = 100,
    ) -> List[SecurityEvent]:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        events = (
            db.query(SecurityEvent)
            .filter(SecurityEvent.dataset_id == dataset.id)
            .order_by(desc(SecurityEvent.occurred_at))
            .offset(skip)
            .limit(limit)
            .all()
        )
        return events

    @classmethod
    def run_analytics(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        analysis_type: str,
        db: Session,
    ) -> AnalyticsRun:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        
        biz_id = cls._generate_business_id("ANL", AnalyticsRun, db)
        run = AnalyticsRun(
            business_id=biz_id,
            dataset_id=dataset.id,
            initiated_by_id=user.id,
            analysis_type=analysis_type or "BASIC",
            status="RUNNING",
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        try:
            results = DatasetPipeline.calculate_analytics(dataset.id, db)
            run.results_summary = results
            run.records_analyzed = results.get("total_events", 0)
            run.completed_at = datetime.now(timezone.utc)
            run.status = "COMPLETED"
            db.commit()
            db.refresh(run)

            cls._audit(
                action="ANALYTICS_RUN_COMPLETED",
                resource_type="ANALYTICS_RUN",
                resource_id=run.business_id,
                old_val=None,
                new_val={"total_events": run.records_analyzed, "dataset_id": dataset.business_id},
                actor_id=user.id,
                db=db,
            )

            run.initiated_by_name = _format_user_name(user)
            return run

        except Exception as e:
            run.status = "FAILED"
            run.error_message = str(e)
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Analytics execution failed: {str(e)}")

    @classmethod
    def get_analytics_runs(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: Optional[uuid.UUID],
        db: Session,
    ) -> List[AnalyticsRun]:
        query = db.query(AnalyticsRun)
        if dataset_id:
            dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
            query = query.filter(AnalyticsRun.dataset_id == dataset.id)

        runs = query.order_by(desc(AnalyticsRun.started_at)).limit(50).all()
        for r in runs:
            if r.initiated_by_id:
                u = db.query(User).filter(User.id == r.initiated_by_id).first()
                r.initiated_by_name = _format_user_name(u)
        return runs

    @classmethod
    def delete_dataset(
        cls,
        user: User,
        effective_scope: str,
        dataset_id: uuid.UUID,
        db: Session,
    ) -> bool:
        dataset = cls.get_dataset(user, effective_scope, dataset_id, db)
        biz_id = dataset.business_id

        # Delete associated SecurityEvents
        db.query(SecurityEvent).filter(SecurityEvent.dataset_id == dataset.id).delete()

        # Delete file from storage if present
        file_path = os.path.join(DATASET_STORAGE_DIR, dataset.storage_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"[File Remove Error] {e}")

        db.delete(dataset)
        db.commit()

        cls._audit(
            action="DATASET_DELETED",
            resource_type="DATASET",
            resource_id=biz_id,
            old_val={"name": dataset.name},
            new_val=None,
            actor_id=user.id,
            db=db,
        )
        return True

    @staticmethod
    def _enrich_dataset_metadata(dataset: Dataset, db: Session):
        if dataset.uploaded_by_id:
            u = db.query(User).filter(User.id == dataset.uploaded_by_id).first()
            dataset.uploaded_by_name = _format_user_name(u)
        if dataset.organization_id:
            org = db.query(Organization).filter(Organization.id == dataset.organization_id).first()
            dataset.organization_name = org.name if org else None
        if dataset.sector_id:
            sec = db.query(Sector).filter(Sector.id == dataset.sector_id).first()
            dataset.sector_name = sec.name if sec else None
        if dataset.related_cse_id:
            cse = db.query(CSE).filter(CSE.id == dataset.related_cse_id).first()
            dataset.related_cse_business_id = cse.business_id if cse else None
