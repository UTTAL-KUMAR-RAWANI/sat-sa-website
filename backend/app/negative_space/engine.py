"""
Negative-Space Assessment Detection Engine.

Deterministic, explainable rule engine that compares expected baseline security
activity against observed telemetry to detect missing events, telemetry dropouts,
monitoring blind spots, silent sources, and detection coverage gaps.

Guiding Principle:
"What should have been observed, but was not observed?"
Safety Boundary:
Never declare 'Threat detected' for absent activity; classify as
'Potential Detection Gap', 'Monitoring Coverage Gap', or 'Negative-Space Signal'.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import math


class NegativeSpaceEngine:
    """
    Deterministic Negative-Space Assessment engine.
    Calculates expected vs observed distributions and triggers explainable signals.
    """

    CATEGORIES = [
        "MONITORING_BLIND_SPOT",
        "TELEMETRY_SILENCE",
        "AUTHENTICATION_DEFICIT",
        "ALERT_DEFICIT",
        "CONTROL_ABSENCE",
        "COVERAGE_DEGRADATION",
    ]

    SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    CONFIDENCES = ["LOW", "MEDIUM", "HIGH"]

    @staticmethod
    def calculate_baseline(events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extract baseline activity profiles from a collection of normalized security events.
        """
        total_count = len(events)
        if total_count == 0:
            return {
                "total_events": 0,
                "by_event_type": {},
                "by_source": {},
                "by_severity": {},
                "by_asset": {},
                "by_user": {},
                "auth_events_count": 0,
                "active_sources": [],
                "active_assets": [],
            }

        by_event_type: Dict[str, int] = {}
        by_source: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        by_asset: Dict[str, int] = {}
        by_user: Dict[str, int] = {}
        auth_count = 0

        auth_keywords = ["AUTH", "LOGIN", "SIGNIN", "AUTHENTICATION", "SESSION", "LOGON", "CREDENTIAL"]

        for ev in events:
            etype = (ev.get("event_type") or "UNKNOWN").upper()
            by_event_type[etype] = by_event_type.get(etype, 0) + 1

            src = (ev.get("source") or ev.get("source_system") or "UNKNOWN").upper()
            by_source[src] = by_source.get(src, 0) + 1

            sev = (ev.get("severity") or "MEDIUM").upper()
            by_severity[sev] = by_severity.get(sev, 0) + 1

            asset = ev.get("asset_id")
            if asset:
                asset_str = str(asset).strip()
                by_asset[asset_str] = by_asset.get(asset_str, 0) + 1

            user = ev.get("user_identifier")
            if user:
                user_str = str(user).strip()
                by_user[user_str] = by_user.get(user_str, 0) + 1

            # Auth detection
            if any(k in etype for k in auth_keywords) or any(k in str(ev.get("action", "")).upper() for k in auth_keywords):
                auth_count += 1

        return {
            "total_events": total_count,
            "by_event_type": by_event_type,
            "by_source": by_source,
            "by_severity": by_severity,
            "by_asset": by_asset,
            "by_user": by_user,
            "auth_events_count": auth_count,
            "active_sources": sorted(list(by_source.keys())),
            "active_assets": sorted(list(by_asset.keys())),
        }

    @staticmethod
    def calculate_observed(events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate observed activity distribution for the comparison window or dataset.
        """
        return NegativeSpaceEngine.calculate_baseline(events)

    @classmethod
    def analyze_negative_space(
        cls,
        expected: Dict[str, Any],
        observed: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        alerts_observed_count: int = 0,
        dataset_quality_score: Optional[float] = None,
        dataset_quality_rating: Optional[str] = None,
        time_window_start: Optional[datetime] = None,
        time_window_end: Optional[datetime] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Execute deterministic negative-space comparison rules.
        Returns:
            (signals, assessment_summary)
        """
        config = config or {}
        volume_threshold_pct = float(config.get("volume_threshold_pct", 50.0))
        silence_threshold_pct = float(config.get("silence_threshold_pct", 90.0))
        auth_drop_threshold_pct = float(config.get("auth_drop_threshold_pct", 60.0))
        min_baseline_events = int(config.get("min_baseline_events", 5))

        signals: List[Dict[str, Any]] = []

        # Data quality safety guard check
        has_data_quality_concern = False
        dq_notes: Optional[str] = None
        if dataset_quality_score is not None and dataset_quality_score < 70.0:
            has_data_quality_concern = True
            dq_notes = (
                f"Data quality concern: Dataset quality score is {dataset_quality_score:.1f}% "
                f"({dataset_quality_rating or 'FAIR/POOR'}). Telemetry deficit may stem from ingestion, "
                f"parsing, or schema mismatches rather than genuine endpoint silence."
            )
        elif dataset_quality_rating in ["POOR", "FAIR"]:
            has_data_quality_concern = True
            dq_notes = (
                f"Data quality concern: Ingestion rating is {dataset_quality_rating}. "
                f"Observed gaps require validation against raw ingestion logs to rule out ingestion loss."
            )

        exp_total = expected.get("total_events", 0)
        obs_total = observed.get("total_events", 0)

        # Baseline check
        if exp_total < min_baseline_events:
            summary = {
                "status": "INSUFFICIENT_BASELINE",
                "message": f"Expected baseline has {exp_total} events (minimum required: {min_baseline_events}).",
                "expected_total": exp_total,
                "observed_total": obs_total,
                "gap_count": 0,
                "signals_generated": 0,
                "rule_hits": {},
            }
            return signals, summary

        rule_hits: Dict[str, int] = {
            "RULE_1_VOLUME_DEFICIT": 0,
            "RULE_2_SOURCE_SILENCE": 0,
            "RULE_3_ASSET_DISAPPEARANCE": 0,
            "RULE_4_AUTH_DROP": 0,
            "RULE_5_ALERT_GAP": 0,
            "RULE_6_CONTROL_ABSENCE": 0,
            "RULE_7_COVERAGE_DEGRADATION": 0,
        }

        # -------------------------------------------------------------
        # RULE 1: Volume Deficit by Event Type
        # -------------------------------------------------------------
        exp_by_type = expected.get("by_event_type", {})
        obs_by_type = observed.get("by_event_type", {})

        for etype, exp_count in exp_by_type.items():
            if exp_count < min_baseline_events:
                continue
            obs_count = obs_by_type.get(etype, 0)
            deficit = exp_count - obs_count
            if deficit > 0:
                gap_pct = round((deficit / exp_count) * 100.0, 1)
                if gap_pct >= volume_threshold_pct:
                    # Severity & Confidence
                    sev = "HIGH" if gap_pct >= 85.0 else ("MEDIUM" if gap_pct >= 60.0 else "LOW")
                    conf = "HIGH" if exp_count >= 30 else ("MEDIUM" if exp_count >= 10 else "LOW")

                    signals.append({
                        "category": "MONITORING_BLIND_SPOT",
                        "gap_description": (
                            f"Significant event volume deficit for '{etype}': expected {exp_count} events, "
                            f"observed {obs_count} events ({gap_pct}% gap). Potential telemetry suppression or monitoring gap."
                        ),
                        "gap_percentage": gap_pct,
                        "expected_activity": {"event_type": etype, "expected_count": exp_count, "metric": "volume"},
                        "observed_activity": {"event_type": etype, "observed_count": obs_count, "metric": "volume"},
                        "severity": sev,
                        "confidence": conf,
                        "affected_asset": None,
                        "affected_user": None,
                        "source": None,
                        "time_window_start": time_window_start,
                        "time_window_end": time_window_end,
                        "data_quality_concern": has_data_quality_concern,
                        "data_quality_notes": dq_notes,
                        "supporting_event_refs": {
                            "rule": "RULE_1_VOLUME_DEFICIT",
                            "event_type": etype,
                            "expected_count": exp_count,
                            "observed_count": obs_count,
                        },
                    })
                    rule_hits["RULE_1_VOLUME_DEFICIT"] += 1

        # -------------------------------------------------------------
        # RULE 2: Source Silence (Critical Telemetry Disconnect)
        # -------------------------------------------------------------
        exp_by_src = expected.get("by_source", {})
        obs_by_src = observed.get("by_source", {})

        for src, exp_count in exp_by_src.items():
            if exp_count < min_baseline_events:
                continue
            obs_count = obs_by_src.get(src, 0)
            deficit = exp_count - obs_count
            gap_pct = round((deficit / exp_count) * 100.0, 1) if exp_count > 0 else 0.0

            if gap_pct >= silence_threshold_pct:
                sev = "CRITICAL" if obs_count == 0 else "HIGH"
                conf = "HIGH" if exp_count >= 20 else "MEDIUM"

                status_desc = "total source silence (0 events received)" if obs_count == 0 else f"severe dropout ({gap_pct}% drop)"
                signals.append({
                    "category": "TELEMETRY_SILENCE",
                    "gap_description": (
                        f"Telemetry source silence detected for '{src}': expected {exp_count} events based on baseline, "
                        f"observed {obs_count} ({status_desc}). Sensor may be offline, agent disabled, or forwarder jammed."
                    ),
                    "gap_percentage": gap_pct,
                    "expected_activity": {"source": src, "expected_count": exp_count},
                    "observed_activity": {"source": src, "observed_count": obs_count},
                    "severity": sev,
                    "confidence": conf,
                    "affected_asset": None,
                    "affected_user": None,
                    "source": src,
                    "time_window_start": time_window_start,
                    "time_window_end": time_window_end,
                    "data_quality_concern": has_data_quality_concern,
                    "data_quality_notes": dq_notes,
                    "supporting_event_refs": {
                        "rule": "RULE_2_SOURCE_SILENCE",
                        "source": src,
                        "expected": exp_count,
                        "observed": obs_count,
                    },
                })
                rule_hits["RULE_2_SOURCE_SILENCE"] += 1

        # -------------------------------------------------------------
        # RULE 3: Asset Telemetry Disappearance
        # -------------------------------------------------------------
        exp_by_asset = expected.get("by_asset", {})
        obs_by_asset = observed.get("by_asset", {})

        for asset, exp_count in exp_by_asset.items():
            if exp_count < min_baseline_events:
                continue
            obs_count = obs_by_asset.get(asset, 0)
            if obs_count == 0:
                sev = "HIGH" if exp_count >= 15 else "MEDIUM"
                conf = "HIGH" if exp_count >= 25 else "MEDIUM"

                signals.append({
                    "category": "MONITORING_BLIND_SPOT",
                    "gap_description": (
                        f"Asset '{asset}' telemetry disappearance: {exp_count} events expected in baseline window, "
                        f"0 events observed in evaluation window. Host may be offline or monitoring agent terminated."
                    ),
                    "gap_percentage": 100.0,
                    "expected_activity": {"asset_id": asset, "expected_count": exp_count},
                    "observed_activity": {"asset_id": asset, "observed_count": 0},
                    "severity": sev,
                    "confidence": conf,
                    "affected_asset": asset,
                    "affected_user": None,
                    "source": None,
                    "time_window_start": time_window_start,
                    "time_window_end": time_window_end,
                    "data_quality_concern": has_data_quality_concern,
                    "data_quality_notes": dq_notes,
                    "supporting_event_refs": {
                        "rule": "RULE_3_ASSET_DISAPPEARANCE",
                        "asset_id": asset,
                        "expected": exp_count,
                        "observed": 0,
                    },
                })
                rule_hits["RULE_3_ASSET_DISAPPEARANCE"] += 1

        # -------------------------------------------------------------
        # RULE 4: Authentication Drop
        # -------------------------------------------------------------
        exp_auth = expected.get("auth_events_count", 0)
        obs_auth = observed.get("auth_events_count", 0)

        if exp_auth >= min_baseline_events:
            auth_deficit = exp_auth - obs_auth
            if auth_deficit > 0:
                auth_gap_pct = round((auth_deficit / exp_auth) * 100.0, 1)
                if auth_gap_pct >= auth_drop_threshold_pct:
                    sev = "CRITICAL" if auth_gap_pct >= 90.0 else "HIGH"
                    conf = "HIGH" if exp_auth >= 20 else "MEDIUM"

                    signals.append({
                        "category": "AUTHENTICATION_DEFICIT",
                        "gap_description": (
                            f"Authentication telemetry deficit: expected {exp_auth} authentication events, "
                            f"observed {obs_auth} events ({auth_gap_pct}% reduction). IAM telemetry forwarding "
                            f"or identity provider logging may be interrupted."
                        ),
                        "gap_percentage": auth_gap_pct,
                        "expected_activity": {"auth_events_count": exp_auth},
                        "observed_activity": {"auth_events_count": obs_auth},
                        "severity": sev,
                        "confidence": conf,
                        "affected_asset": None,
                        "affected_user": None,
                        "source": "IAM/IdP",
                        "time_window_start": time_window_start,
                        "time_window_end": time_window_end,
                        "data_quality_concern": has_data_quality_concern,
                        "data_quality_notes": dq_notes,
                        "supporting_event_refs": {
                            "rule": "RULE_4_AUTH_DROP",
                            "expected_auth": exp_auth,
                            "observed_auth": obs_auth,
                        },
                    })
                    rule_hits["RULE_4_AUTH_DROP"] += 1

        # -------------------------------------------------------------
        # RULE 5: Alert Gap / Silent SOC
        # -------------------------------------------------------------
        # If high volume of high/critical observed events exists but 0 alerts triggered
        obs_by_sev = observed.get("by_severity", {})
        obs_high_crit = obs_by_sev.get("HIGH", 0) + obs_by_sev.get("CRITICAL", 0)

        if obs_high_crit >= 5 and alerts_observed_count == 0:
            signals.append({
                "category": "ALERT_DEFICIT",
                "gap_description": (
                    f"Alert deficit detected: {obs_high_crit} HIGH or CRITICAL security events were ingested, "
                    f"but 0 SecOps alerts were triggered in the system. Detection engineering rules or SIEM alerting "
                    f"pipelines may be misconfigured or silent."
                ),
                "gap_percentage": 100.0,
                "expected_activity": {"expected_alert_threshold": "At least 1 alert for high-severity events", "high_critical_events": obs_high_crit},
                "observed_activity": {"alerts_triggered": 0, "high_critical_events": obs_high_crit},
                "severity": "HIGH",
                "confidence": "HIGH",
                "affected_asset": None,
                "affected_user": None,
                "source": "SIEM Alert Engine",
                "time_window_start": time_window_start,
                "time_window_end": time_window_end,
                "data_quality_concern": has_data_quality_concern,
                "data_quality_notes": dq_notes,
                "supporting_event_refs": {
                    "rule": "RULE_5_ALERT_GAP",
                    "high_critical_events": obs_high_crit,
                    "alerts_triggered": alerts_observed_count,
                },
            })
            rule_hits["RULE_5_ALERT_GAP"] += 1

        # -------------------------------------------------------------
        # RULE 6: Control Inactivity / Periodic Task Silence
        # -------------------------------------------------------------
        # Check periodic control keywords (scan, backup, audit, integrity, health)
        control_keywords = ["SCAN", "AUDIT", "BACKUP", "INTEGRITY", "HEARTBEAT", "HEALTH"]
        for kw in control_keywords:
            exp_kw_count = sum(c for k, c in exp_by_type.items() if kw in k)
            obs_kw_count = sum(c for k, c in obs_by_type.items() if kw in k)

            if exp_kw_count >= 5 and obs_kw_count == 0:
                signals.append({
                    "category": "CONTROL_ABSENCE",
                    "gap_description": (
                        f"Periodic security control activity absent: '{kw}' routine control events expected ({exp_kw_count}), "
                        f"but 0 events observed. Scheduled automated security controls may have failed or stalled."
                    ),
                    "gap_percentage": 100.0,
                    "expected_activity": {"control_pattern": kw, "expected_count": exp_kw_count},
                    "observed_activity": {"control_pattern": kw, "observed_count": 0},
                    "severity": "HIGH",
                    "confidence": "HIGH" if exp_kw_count >= 10 else "MEDIUM",
                    "affected_asset": None,
                    "affected_user": None,
                    "source": "Security Control",
                    "time_window_start": time_window_start,
                    "time_window_end": time_window_end,
                    "data_quality_concern": has_data_quality_concern,
                    "data_quality_notes": dq_notes,
                    "supporting_event_refs": {
                        "rule": "RULE_6_CONTROL_ABSENCE",
                        "control_pattern": kw,
                        "expected": exp_kw_count,
                        "observed": 0,
                    },
                })
                rule_hits["RULE_6_CONTROL_ABSENCE"] += 1

        # -------------------------------------------------------------
        # RULE 7: Multi-Source Coverage Degradation
        # -------------------------------------------------------------
        silenced_sources_count = rule_hits["RULE_2_SOURCE_SILENCE"]
        total_sources = len(exp_by_src)
        if total_sources >= 3 and (silenced_sources_count / total_sources) >= 0.5:
            signals.append({
                "category": "COVERAGE_DEGRADATION",
                "gap_description": (
                    f"Widespread telemetry coverage degradation: {silenced_sources_count} of {total_sources} "
                    f"({round(silenced_sources_count/total_sources*100)}%) active telemetry sources are silent. "
                    f"Systemic collector or network boundary failure likely."
                ),
                "gap_percentage": round((silenced_sources_count / total_sources) * 100.0, 1),
                "expected_activity": {"active_sources_baseline": total_sources},
                "observed_activity": {"silenced_sources": silenced_sources_count, "remaining_active": total_sources - silenced_sources_count},
                "severity": "CRITICAL",
                "confidence": "HIGH",
                "affected_asset": None,
                "affected_user": None,
                "source": "Infrastructure Collector",
                "time_window_start": time_window_start,
                "time_window_end": time_window_end,
                "data_quality_concern": has_data_quality_concern,
                "data_quality_notes": dq_notes,
                "supporting_event_refs": {
                    "rule": "RULE_7_COVERAGE_DEGRADATION",
                    "silenced_sources": silenced_sources_count,
                    "total_sources": total_sources,
                },
            })
            rule_hits["RULE_7_COVERAGE_DEGRADATION"] += 1

        # Calculate high/crit potential missed threats
        potential_missed = sum(
            1 for s in signals if s["severity"] in ["HIGH", "CRITICAL"]
        )

        assessment_summary = {
            "status": "COMPLETED",
            "expected_events_count": exp_total,
            "observed_events_count": obs_total,
            "overall_gap_percentage": round(((exp_total - obs_total) / exp_total * 100.0), 1) if exp_total > 0 else 0.0,
            "total_signals_detected": len(signals),
            "potential_missed_threat_count": potential_missed,
            "rule_hits": rule_hits,
            "has_data_quality_concern": has_data_quality_concern,
            "data_quality_notes": dq_notes,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

        return signals, assessment_summary
