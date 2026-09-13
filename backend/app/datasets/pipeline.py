import os
import re
import csv
import json
import uuid
import hashlib
import ipaddress
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import UploadFile, HTTPException, status
import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.security import SecurityEvent, Alert
from app.core.config import settings


# Directory for dataset file persistence
DATASET_STORAGE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "datasets")
)
os.makedirs(DATASET_STORAGE_DIR, exist_ok=True)

# Canonical field dictionary for auto-matching
CANONICAL_FIELD_ALIASES: Dict[str, List[str]] = {
    "event_id": ["event_id", "eventid", "record_id", "id", "uid", "uuid", "log_id", "alert_id"],
    "timestamp": ["timestamp", "time", "event_time", "eventtime", "datetime", "date", "occurred_at", "@timestamp", "created_at"],
    "source_ip": ["source_ip", "src_ip", "srcip", "src", "client_ip", "source_address", "src_addr", "ip_src"],
    "destination_ip": ["destination_ip", "dest_ip", "dst_ip", "dstip", "dst", "server_ip", "target_ip", "dest_addr", "ip_dst"],
    "source": ["source", "sensor", "vendor", "device_vendor", "log_source", "product", "collector", "reporter"],
    "event_type": ["event_type", "eventtype", "type", "action_type", "category", "signature", "threat_name", "rule_name", "attack_type"],
    "severity": ["severity", "level", "priority", "sev", "crit", "threat_level"],
    "status": ["status", "outcome", "result", "action_taken", "decision", "state"],
    "asset_id": ["asset_id", "asset", "host", "hostname", "device_name", "computer_name", "target_host", "endpoint"],
    "user_identifier": ["user_identifier", "user", "username", "user_id", "account", "src_user", "principal", "actor"],
    "action": ["action", "operation", "command", "activity", "method", "http_method"],
    "message": ["message", "msg", "details", "summary", "description", "payload", "raw_message"],
    "alert_id": ["alert_id", "alert_ref", "alert_business_id", "parent_alert"],
    "cse_reference": ["cse_reference", "cse_id", "cse_ref", "incident_id", "incident_ref"]
}

VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}


class DatasetPipeline:

    @staticmethod
    def validate_and_save_upload(file: UploadFile, max_size_bytes: int = 52428800) -> Tuple[str, str, int, str]:
        """
        Validates file extension, MIME type, size limit, saves file safely to disk.
        Returns: (safe_filename, file_type, file_size, file_hash)
        """
        filename = os.path.basename(file.filename or "dataset.csv")
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".csv", ".json"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Only CSV and JSON dataset files are supported."
            )

        file_type = "CSV" if ext == ".csv" else "JSON"

        # Read content safely with size check
        content = file.file.read()
        file_size = len(content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty."
            )
        if file_size > max_size_bytes:
            max_mb = max_size_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Dataset file size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed size of {max_mb} MB."
            )

        # Compute SHA-256
        sha = hashlib.sha256()
        sha.update(content)
        file_hash = sha.hexdigest()

        # Generate safe filename with UUID prefix to prevent collisions and path traversal
        clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
        safe_filename = f"{uuid.uuid4().hex}_{clean_name}"
        storage_path = os.path.join(DATASET_STORAGE_DIR, safe_filename)

        with open(storage_path, "wb") as f:
            f.write(content)

        return safe_filename, file_type, file_size, file_hash

    @staticmethod
    def detect_schema(storage_filename: str, file_type: str) -> Dict[str, Any]:
        """
        Reads file samples, infers column data types, computes null counts and sample values,
        and auto-detects canonical column mappings.
        """
        file_path = os.path.join(DATASET_STORAGE_DIR, storage_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Dataset file not found on disk.")

        rows: List[Dict[str, Any]] = []
        total_rows_estimated = 0

        if file_type == "CSV":
            try:
                with open(file_path, mode="r", encoding="utf-8-sig", errors="replace") as f:
                    reader = csv.DictReader(f)
                    fieldnames = [c.strip() for c in (reader.fieldnames or []) if c]
                    for idx, row in enumerate(reader):
                        total_rows_estimated += 1
                        if idx < 500:  # Sample first 500 rows for schema detection
                            rows.append({k.strip(): v.strip() if isinstance(v, str) else v for k, v in row.items() if k})
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse CSV dataset: {str(e)}")
        else:  # JSON
            try:
                with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
                    content = f.read().strip()
                    if content.startswith("["):
                        parsed = json.loads(content)
                        if isinstance(parsed, list):
                            total_rows_estimated = len(parsed)
                            rows = [r for r in parsed[:500] if isinstance(r, dict)]
                    else:
                        # Try JSONLines
                        lines = content.splitlines()
                        total_rows_estimated = len(lines)
                        for line in lines[:500]:
                            if line.strip():
                                rows.append(json.loads(line))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse JSON dataset: {str(e)}")

        if not rows:
            raise HTTPException(status_code=400, detail="Dataset contains no valid records.")

        # Determine all available columns
        all_columns: List[str] = []
        for r in rows:
            for k in r.keys():
                if k not in all_columns:
                    all_columns.append(k)

        column_stats: List[Dict[str, Any]] = []
        suggested_mapping: Dict[str, str] = {}

        for col in all_columns:
            values = [r.get(col) for r in rows if col in r and r.get(col) is not None and str(r.get(col)).strip() != ""]
            non_null_count = len(values)
            null_count = len(rows) - non_null_count

            # Type inference
            inferred_type = DatasetPipeline._infer_type(values)

            # Unique sample values (up to 3)
            sample_values = []
            for v in values:
                s_str = str(v)
                if s_str not in sample_values:
                    sample_values.append(s_str)
                if len(sample_values) >= 3:
                    break

            column_stats.append({
                "column_name": col,
                "inferred_type": inferred_type,
                "null_count": null_count,
                "sample_values": sample_values,
            })

            # Auto-detect canonical mapping
            matched_canonical = DatasetPipeline._match_canonical_field(col)
            if matched_canonical and matched_canonical not in suggested_mapping.values():
                suggested_mapping[col] = matched_canonical

        return {
            "columns": column_stats,
            "sample_row_count": len(rows),
            "estimated_total_rows": total_rows_estimated,
            "suggested_mapping": suggested_mapping,
        }

    @staticmethod
    def _infer_type(values: List[Any]) -> str:
        if not values:
            return "string"

        is_int = True
        is_float = True
        is_bool = True
        is_ip = True
        is_date = True

        for v in values[:100]:
            s = str(v).strip()
            # Int check
            if is_int:
                try:
                    int(s)
                except ValueError:
                    is_int = False
            # Float check
            if is_float:
                try:
                    float(s)
                except ValueError:
                    is_float = False
            # Bool check
            if is_bool and s.lower() not in {"true", "false", "1", "0", "yes", "no"}:
                is_bool = False
            # IP check
            if is_ip:
                try:
                    ipaddress.ip_address(s)
                except ValueError:
                    is_ip = False
            # Date check
            if is_date and not DatasetPipeline._parse_timestamp(s):
                is_date = False

        if is_bool:
            return "boolean"
        if is_int:
            return "integer"
        if is_float:
            return "float"
        if is_ip:
            return "ip_address"
        if is_date:
            return "datetime"
        return "string"

    @staticmethod
    def _match_canonical_field(column_name: str) -> Optional[str]:
        norm = re.sub(r'[^a-z0-9]', '', column_name.lower())
        for canonical, aliases in CANONICAL_FIELD_ALIASES.items():
            for alias in aliases:
                alias_norm = re.sub(r'[^a-z0-9]', '', alias.lower())
                if norm == alias_norm or norm.startswith(alias_norm) or norm.endswith(alias_norm):
                    return canonical
        return None

    @staticmethod
    def _parse_timestamp(val: Any) -> Optional[datetime]:
        if not val:
            return None
        if isinstance(val, (int, float)):
            try:
                # Epoch timestamp (seconds or ms)
                if val > 1e11:
                    val = val / 1000.0
                return datetime.fromtimestamp(val, tz=timezone.utc)
            except Exception:
                return None

        s = str(val).strip()
        # ISO / common date formats
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%d-%b-%Y %H:%M:%S",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(s, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue

        # Syslog format fallback with explicit year to avoid Python 3.15 deprecation
        try:
            cur_year = datetime.now(timezone.utc).year
            dt = datetime.strptime(f"{s} {cur_year}", "%b %d %H:%M:%S %Y")
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

        # Try ISO fallback
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None

    @staticmethod
    def _normalize_severity(val: Any) -> str:
        if not val:
            return "MEDIUM"
        s = str(val).strip().upper()
        if s in VALID_SEVERITIES:
            return s
        if s in {"1", "LOW", "INFORMATIONAL", "DEBUG"}:
            return "LOW"
        if s in {"2", "MEDIUM", "WARN", "WARNING"}:
            return "MEDIUM"
        if s in {"3", "HIGH", "ERROR"}:
            return "HIGH"
        if s in {"4", "5", "CRITICAL", "FATAL", "EMERGENCY"}:
            return "CRITICAL"
        return "MEDIUM"

    @staticmethod
    def validate_dataset_data(storage_filename: str, file_type: str, column_mapping: Dict[str, str]) -> Dict[str, Any]:
        """
        Validates the dataset records row-by-row using column_mapping.
        Categorizes into valid, invalid, warning, and duplicates.
        Calculates deterministic Data Quality Score.
        """
        file_path = os.path.join(DATASET_STORAGE_DIR, storage_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Dataset file not found.")

        # Invert mapping to canonical -> source_col
        inv_map = {v: k for k, v in column_mapping.items()}

        total_records = 0
        valid_records = 0
        invalid_records = 0
        warning_records = 0
        duplicate_records = 0

        seen_event_ids = set()
        seen_row_hashes = set()
        error_log: List[Dict[str, Any]] = []
        severity_dist: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}

        earliest_dt: Optional[datetime] = None
        latest_dt: Optional[datetime] = None

        total_mapped_fields_checked = 0
        total_non_null_fields = 0

        def process_row(row_dict: Dict[str, Any], row_num: int):
            nonlocal total_records, valid_records, invalid_records, warning_records, duplicate_records
            nonlocal earliest_dt, latest_dt, total_mapped_fields_checked, total_non_null_fields

            total_records += 1
            row_warnings = []
            row_errors = []

            # Check duplicate row content
            row_repr = json.dumps(row_dict, sort_keys=True)
            row_hash = hashlib.md5(row_repr.encode()).hexdigest()
            if row_hash in seen_row_hashes:
                duplicate_records += 1
                row_warnings.append("Duplicate identical row detected")
            else:
                seen_row_hashes.add(row_hash)

            # Check canonical fields
            event_id = None
            if "event_id" in inv_map:
                col = inv_map["event_id"]
                val = row_dict.get(col)
                if val:
                    event_id = str(val).strip()
                    if event_id in seen_event_ids:
                        duplicate_records += 1
                        row_warnings.append(f"Duplicate event_id '{event_id}' detected")
                    else:
                        seen_event_ids.add(event_id)

            # Timestamp check
            timestamp_dt = None
            if "timestamp" in inv_map:
                col = inv_map["timestamp"]
                val = row_dict.get(col)
                if val:
                    timestamp_dt = DatasetPipeline._parse_timestamp(val)
                    if not timestamp_dt:
                        row_errors.append(f"Invalid timestamp format: '{val}'")
                    else:
                        if earliest_dt is None or timestamp_dt < earliest_dt:
                            earliest_dt = timestamp_dt
                        if latest_dt is None or timestamp_dt > latest_dt:
                            latest_dt = timestamp_dt
                else:
                    row_errors.append("Timestamp field is mapped but record has null/empty timestamp")

            # Severity check
            if "severity" in inv_map:
                col = inv_map["severity"]
                val = row_dict.get(col)
                norm_sev = DatasetPipeline._normalize_severity(val)
                severity_dist[norm_sev] = severity_dist.get(norm_sev, 0) + 1
            else:
                severity_dist["MEDIUM"] += 1

            # Source IP check
            if "source_ip" in inv_map:
                col = inv_map["source_ip"]
                val = row_dict.get(col)
                if val:
                    try:
                        ipaddress.ip_address(str(val).strip())
                    except ValueError:
                        row_warnings.append(f"Invalid source_ip syntax: '{val}'")

            # Destination IP check
            if "destination_ip" in inv_map:
                col = inv_map["destination_ip"]
                val = row_dict.get(col)
                if val:
                    try:
                        ipaddress.ip_address(str(val).strip())
                    except ValueError:
                        row_warnings.append(f"Invalid destination_ip syntax: '{val}'")

            # Completeness tracking across mapped fields
            for canonical_field, source_col in inv_map.items():
                total_mapped_fields_checked += 1
                v = row_dict.get(source_col)
                if v is not None and str(v).strip() != "":
                    total_non_null_fields += 1

            # Determine classification
            if row_errors:
                invalid_records += 1
                if len(error_log) < 100:
                    error_log.append({
                        "row": row_num,
                        "status": "INVALID",
                        "issues": row_errors,
                        "raw": {k: str(v)[:100] for k, v in row_dict.items() if v is not None}
                    })
            elif row_warnings:
                warning_records += 1
                valid_records += 1  # Row is valid with warnings
                if len(error_log) < 100:
                    error_log.append({
                        "row": row_num,
                        "status": "WARNING",
                        "issues": row_warnings,
                        "raw": {k: str(v)[:100] for k, v in row_dict.items() if v is not None}
                    })
            else:
                valid_records += 1

        # Execute row iteration
        if file_type == "CSV":
            with open(file_path, mode="r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.DictReader(f)
                for idx, r in enumerate(reader):
                    process_row({k.strip(): v for k, v in r.items() if k}, idx + 1)
        else:
            with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
                content = f.read().strip()
                if content.startswith("["):
                    parsed = json.loads(content)
                    for idx, r in enumerate(parsed):
                        if isinstance(r, dict):
                            process_row(r, idx + 1)
                else:
                    for idx, line in enumerate(content.splitlines()):
                        if line.strip():
                            process_row(json.loads(line), idx + 1)

        if total_records == 0:
            raise HTTPException(status_code=400, detail="No records were processed from dataset.")

        # Compute Quality Score components
        validity_pct = (valid_records / total_records) * 100
        completeness_pct = (total_non_null_fields / max(1, total_mapped_fields_checked)) * 100
        conformity_pct = min(100.0, (len(inv_map) / 6.0) * 100)  # Expecting at least 6 canonical fields
        uniqueness_pct = max(0.0, 100.0 - (duplicate_records / total_records * 100))

        # Weighted quality score formula
        quality_score = round(
            (0.35 * validity_pct) +
            (0.30 * completeness_pct) +
            (0.20 * conformity_pct) +
            (0.15 * uniqueness_pct),
            1
        )
        quality_score = max(0.0, min(100.0, quality_score))

        if quality_score >= 85:
            quality_rating = "EXCELLENT"
        elif quality_score >= 70:
            quality_rating = "GOOD"
        elif quality_score >= 50:
            quality_rating = "FAIR"
        else:
            quality_rating = "POOR"

        validation_summary = {
            "total_records": total_records,
            "valid_records": valid_records,
            "invalid_records": invalid_records,
            "warning_records": warning_records,
            "duplicate_records": duplicate_records,
            "severity_distribution": severity_dist,
            "earliest_timestamp": earliest_dt.isoformat() if earliest_dt else None,
            "latest_timestamp": latest_dt.isoformat() if latest_dt else None,
            "validity_pct": round(validity_pct, 1),
            "completeness_pct": round(completeness_pct, 1),
            "conformity_pct": round(conformity_pct, 1),
            "uniqueness_pct": round(uniqueness_pct, 1),
        }

        return {
            "validation_summary": validation_summary,
            "quality_score": quality_score,
            "quality_rating": quality_rating,
            "error_log": error_log,
            "total_records": total_records,
            "valid_records": valid_records,
            "invalid_records": invalid_records,
            "warning_records": warning_records,
            "duplicate_records": duplicate_records,
        }

    @staticmethod
    def import_records(
        storage_filename: str,
        file_type: str,
        column_mapping: Dict[str, str],
        dataset_id: uuid.UUID,
        dataset_import_id: uuid.UUID,
        organization_id: Optional[uuid.UUID],
        sector_id: Optional[uuid.UUID],
        related_cse_id: Optional[uuid.UUID],
        db: Session
    ) -> Dict[str, Any]:
        """
        Ingests valid records into SecurityEvent table in PostgreSQL.
        Preserves original raw record in raw_metadata.
        Links to dataset_id, dataset_import_id, and optionally existing Alert or CSE.
        """
        file_path = os.path.join(DATASET_STORAGE_DIR, storage_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Dataset file not found for import.")

        inv_map = {v: k for k, v in column_mapping.items()}
        current_year = datetime.now(timezone.utc).year

        records_processed = 0
        records_imported = 0
        records_rejected = 0
        error_log = []

        batch_events: List[SecurityEvent] = []
        batch_size = 500

        def handle_row(row_dict: Dict[str, Any], row_num: int):
            nonlocal records_processed, records_imported, records_rejected

            records_processed += 1

            # Extract fields
            event_id = str(row_dict.get(inv_map.get("event_id", ""))) if "event_id" in inv_map else None
            timestamp_raw = row_dict.get(inv_map.get("timestamp", "")) if "timestamp" in inv_map else None
            occurred_at = DatasetPipeline._parse_timestamp(timestamp_raw) if timestamp_raw else None

            # If timestamp is mapped but fails to parse, reject row
            if "timestamp" in inv_map and not occurred_at:
                records_rejected += 1
                if len(error_log) < 100:
                    error_log.append({"row": row_num, "error": f"Invalid timestamp: {timestamp_raw}"})
                return

            event_type = str(row_dict.get(inv_map.get("event_type", ""), "SECURITY_EVENT") or "SECURITY_EVENT").strip()
            source = str(row_dict.get(inv_map.get("source", ""), "DATASET_IMPORT") or "DATASET_IMPORT").strip()
            severity_raw = row_dict.get(inv_map.get("severity", "")) if "severity" in inv_map else None
            severity = DatasetPipeline._normalize_severity(severity_raw)

            source_ip = str(row_dict.get(inv_map.get("source_ip", ""))) if "source_ip" in inv_map and row_dict.get(inv_map["source_ip"]) else None
            dest_ip = str(row_dict.get(inv_map.get("destination_ip", ""))) if "destination_ip" in inv_map and row_dict.get(inv_map["destination_ip"]) else None
            asset_id = str(row_dict.get(inv_map.get("asset_id", ""))) if "asset_id" in inv_map and row_dict.get(inv_map["asset_id"]) else None
            user_id = str(row_dict.get(inv_map.get("user_identifier", ""))) if "user_identifier" in inv_map and row_dict.get(inv_map["user_identifier"]) else None
            action = str(row_dict.get(inv_map.get("action", ""))) if "action" in inv_map and row_dict.get(inv_map["action"]) else None
            status_val = str(row_dict.get(inv_map.get("status", ""), "OBSERVED") or "OBSERVED").strip()

            message = str(row_dict.get(inv_map.get("message", "")) or f"{event_type} on {asset_id or 'host'}")
            title = message[:120] if len(message) > 120 else message

            # Generate business ID
            event_biz_id = f"EVT-{current_year}-{uuid.uuid4().hex[:8].upper()}"

            sec_event = SecurityEvent(
                business_id=event_biz_id,
                title=title,
                description=message,
                source=source,
                source_system="DATASET_PIPELINE",
                event_type=event_type,
                severity=severity,
                dataset_id=dataset_id,
                dataset_import_id=dataset_import_id,
                external_event_id=event_id,
                occurred_at=occurred_at or datetime.now(timezone.utc),
                source_ip=source_ip,
                destination_ip=dest_ip,
                asset_id=asset_id,
                user_identifier=user_id,
                action=action,
                status=status_val,
                organization_id=organization_id,
                sector_id=sector_id,
                raw_metadata=row_dict,
            )

            # Check if alert_id is mapped and matches an existing Alert
            if "alert_id" in inv_map:
                alert_ref = str(row_dict.get(inv_map["alert_id", ""])).strip()
                if alert_ref:
                    existing_alert = db.query(Alert).filter(
                        (Alert.business_id == alert_ref) | (Alert.id.cast(sa.String) == alert_ref)
                    ).first()
                    if existing_alert:
                        existing_alert.security_event_id = sec_event.id

            batch_events.append(sec_event)
            records_imported += 1

            if len(batch_events) >= batch_size:
                db.bulk_save_objects(batch_events)
                db.commit()
                batch_events.clear()

        # Iterate file
        if file_type == "CSV":
            with open(file_path, mode="r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.DictReader(f)
                for idx, r in enumerate(reader):
                    handle_row({k.strip(): v for k, v in r.items() if k}, idx + 1)
        else:
            with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
                content = f.read().strip()
                if content.startswith("["):
                    parsed = json.loads(content)
                    for idx, r in enumerate(parsed):
                        if isinstance(r, dict):
                            handle_row(r, idx + 1)
                else:
                    for idx, line in enumerate(content.splitlines()):
                        if line.strip():
                            handle_row(json.loads(line), idx + 1)

        if batch_events:
            db.bulk_save_objects(batch_events)
            db.commit()
            batch_events.clear()

        import_summary = {
            "records_processed": records_processed,
            "records_imported": records_imported,
            "records_rejected": records_rejected,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }

        return {
            "records_processed": records_processed,
            "records_imported": records_imported,
            "records_rejected": records_rejected,
            "import_summary": import_summary,
            "error_log": error_log,
        }

    @staticmethod
    def calculate_analytics(dataset_id: uuid.UUID, db: Session) -> Dict[str, Any]:
        """
        Runs deterministic analytics on imported SecurityEvents for a dataset.
        Computes distributions, top entities, and time-series buckets.
        """
        events = db.query(SecurityEvent).filter(SecurityEvent.dataset_id == dataset_id).all()
        total_events = len(events)
        if total_events == 0:
            return {
                "total_events": 0,
                "severity_distribution": {},
                "event_type_distribution": {},
                "source_distribution": {},
                "status_distribution": {},
                "unique_assets": 0,
                "unique_users": 0,
                "unique_source_ips": 0,
                "unique_destination_ips": 0,
                "top_assets": [],
                "top_source_ips": [],
                "top_event_types": [],
                "time_series": [],
            }

        sev_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        source_counts: Dict[str, int] = {}
        status_counts: Dict[str, int] = {}

        assets_set = set()
        users_set = set()
        src_ips_set = set()
        dst_ips_set = set()

        asset_counts: Dict[str, int] = {}
        src_ip_counts: Dict[str, int] = {}

        timestamps: List[datetime] = []

        for ev in events:
            # Severity
            sev = ev.severity or "MEDIUM"
            sev_counts[sev] = sev_counts.get(sev, 0) + 1

            # Event type
            et = ev.event_type or "UNKNOWN"
            type_counts[et] = type_counts.get(et, 0) + 1

            # Source
            src = ev.source or "UNKNOWN"
            source_counts[src] = source_counts.get(src, 0) + 1

            # Status
            st = ev.status or "OBSERVED"
            status_counts[st] = status_counts.get(st, 0) + 1

            # Entities
            if ev.asset_id:
                assets_set.add(ev.asset_id)
                asset_counts[ev.asset_id] = asset_counts.get(ev.asset_id, 0) + 1
            if ev.user_identifier:
                users_set.add(ev.user_identifier)
            if ev.source_ip:
                src_ips_set.add(ev.source_ip)
                src_ip_counts[ev.source_ip] = src_ip_counts.get(ev.source_ip, 0) + 1
            if ev.destination_ip:
                dst_ips_set.add(ev.destination_ip)

            if ev.occurred_at:
                timestamps.append(ev.occurred_at)

        # Top lists
        top_assets = [{"asset": k, "count": v} for k, v in sorted(asset_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
        top_src_ips = [{"ip": k, "count": v} for k, v in sorted(src_ip_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
        top_types = [{"type": k, "count": v} for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:10]]
        top_sources = [{"source": k, "count": v} for k, v in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:10]]

        # Time series calculation
        time_series = []
        if timestamps:
            timestamps.sort()
            min_ts = timestamps[0]
            max_ts = timestamps[-1]
            time_delta = max_ts - min_ts

            bucket_fmt = "%Y-%m-%d %H:00"
            if time_delta > timedelta(days=60):
                bucket_fmt = "%Y-W%W"
            elif time_delta > timedelta(days=3):
                bucket_fmt = "%Y-%m-%d"

            buckets: Dict[str, Dict[str, Any]] = {}
            for ev in events:
                if ev.occurred_at:
                    b_key = ev.occurred_at.strftime(bucket_fmt)
                    if b_key not in buckets:
                        buckets[b_key] = {"period": b_key, "total": 0, "critical": 0, "high": 0}
                    buckets[b_key]["total"] += 1
                    if ev.severity == "CRITICAL":
                        buckets[b_key]["critical"] += 1
                    elif ev.severity == "HIGH":
                        buckets[b_key]["high"] += 1

            time_series = [v for k, v in sorted(buckets.items(), key=lambda x: x[0])]

        return {
            "total_events": total_events,
            "severity_distribution": sev_counts,
            "event_type_distribution": type_counts,
            "source_distribution": source_counts,
            "status_distribution": status_counts,
            "unique_assets": len(assets_set),
            "unique_users": len(users_set),
            "unique_source_ips": len(src_ips_set),
            "unique_destination_ips": len(dst_ips_set),
            "top_assets": top_assets,
            "top_source_ips": top_src_ips,
            "top_event_types": top_types,
            "top_sources": top_sources,
            "time_series": time_series,
            "time_distribution": time_series,
            "earliest_event": timestamps[0].isoformat() if timestamps else None,
            "latest_event": timestamps[-1].isoformat() if timestamps else None,
        }
