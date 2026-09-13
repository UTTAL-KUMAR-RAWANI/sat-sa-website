"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { negativeSpaceApi } from "@/lib/api/negative-space";
import { datasetsApi, DatasetItem } from "@/lib/api/datasets";
import {
    ArrowLeft,
    EyeOff,
    Save,
    RefreshCw,
    AlertTriangle,
    Sliders,
    Database,
    Calendar,
    Layers,
    CheckCircle2,
} from "lucide-react";

export default function NewNegativeSpaceAssessmentPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [datasets, setDatasets] = useState<DatasetItem[]>([]);
    const [loadingDatasets, setLoadingDatasets] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [assessmentType, setAssessmentType] = useState("TELEMETRY_COVERAGE");
    const [datasetId, setDatasetId] = useState<string>("");

    // Time windows
    const [baselineStart, setBaselineStart] = useState("");
    const [baselineEnd, setBaselineEnd] = useState("");
    const [comparisonStart, setComparisonStart] = useState("");
    const [comparisonEnd, setComparisonEnd] = useState("");

    // Thresholds
    const [volumeThreshold, setVolumeThreshold] = useState<number>(50.0);
    const [silenceThreshold, setSilenceThreshold] = useState<number>(90.0);
    const [authDropThreshold, setAuthDropThreshold] = useState<number>(60.0);
    const [minBaselineEvents, setMinBaselineEvents] = useState<number>(5);

    // Preset / Custom Expected Definition
    const [expectedJson, setExpectedJson] = useState<string>("");

    useEffect(() => {
        const loadDatasets = async () => {
            try {
                const res = await datasetsApi.getDatasets({ limit: 100 });
                setDatasets(res);
                if (res.length > 0) {
                    setDatasetId(res[0].id);
                }
            } catch (err: any) {
                console.error("Failed to load datasets:", err);
            } finally {
                setLoadingDatasets(false);
            }
        };
        loadDatasets();
    }, []);

    const applyPreset = (type: string) => {
        if (type === "ENTERPRISE_STANDARD") {
            setExpectedJson(
                JSON.stringify(
                    {
                        total_events: 100,
                        by_event_type: { USER_LOGIN: 40, FIREWALL_ALLOW: 40, EDR_HEARTBEAT: 20 },
                        by_source: { OKTA: 40, PALO_ALTO: 40, CROWDSTRIKE: 20 },
                        auth_events_count: 40,
                        active_sources: ["OKTA", "PALO_ALTO", "CROWDSTRIKE"],
                    },
                    null,
                    2
                )
            );
        } else if (type === "PERIMETER_DEFENSE") {
            setExpectedJson(
                JSON.stringify(
                    {
                        total_events: 80,
                        by_event_type: { FIREWALL_DROP: 50, VPN_SESSION: 30 },
                        by_source: { PALO_ALTO: 50, CISCO_VPN: 30 },
                        auth_events_count: 30,
                        active_sources: ["PALO_ALTO", "CISCO_VPN"],
                    },
                    null,
                    2
                )
            );
        } else {
            setExpectedJson("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("Assessment name is required");
            return;
        }

        let parsedExpected: Record<string, any> | undefined = undefined;
        if (expectedJson.trim()) {
            try {
                parsedExpected = JSON.parse(expectedJson);
            } catch (err) {
                setError("Expected Activity Definition must be valid JSON");
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload: any = {
                name: name.trim(),
                description: description.trim() || undefined,
                assessment_type: assessmentType,
                dataset_id: datasetId || undefined,
                baseline_window_start: baselineStart ? new Date(baselineStart).toISOString() : undefined,
                baseline_window_end: baselineEnd ? new Date(baselineEnd).toISOString() : undefined,
                comparison_window_start: comparisonStart ? new Date(comparisonStart).toISOString() : undefined,
                comparison_window_end: comparisonEnd ? new Date(comparisonEnd).toISOString() : undefined,
                configuration: {
                    volume_threshold_pct: volumeThreshold,
                    silence_threshold_pct: silenceThreshold,
                    auth_drop_threshold_pct: authDropThreshold,
                    min_baseline_events: minBaselineEvents,
                },
                expected_activity_definition: parsedExpected,
            };

            const created = await negativeSpaceApi.createAssessment(payload);
            router.push(`/negative-space/${created.id}`);
        } catch (err: any) {
            console.error("Failed to create assessment:", err);
            setError(err.message || "Failed to create assessment specification");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
                <Link
                    href="/negative-space"
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <EyeOff className="w-6 h-6 text-cyan-400" />
                        Configure Negative-Space Assessment
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Define expected telemetry baselines and threshold rules to detect missing security events
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Information */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Assessment Specification
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Assessment Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Q3 Banking Gateway Telemetry Coverage & Blind Spot Audit"
                                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Assessment Type
                            </label>
                            <select
                                value={assessmentType}
                                onChange={(e) => setAssessmentType(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                            >
                                <option value="TELEMETRY_COVERAGE">Telemetry Coverage & Blind Spot</option>
                                <option value="AUTHENTICATION_BASELINE">Authentication Baseline & IAM Drop</option>
                                <option value="SOURCE_SILENCE">Source Silence & Sensor Health</option>
                                <option value="ALERT_GAP">Alert Deficit / Silent SOC</option>
                                <option value="CUSTOM">Custom Multi-Dimensional Evaluation</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Description / Supervisory Objective
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="State the regulatory scope, control framework or hypothesis being audited for unobserved activity..."
                            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                </div>

                {/* Telemetry Dataset Association */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyan-400" />
                        Target Telemetry Dataset
                    </h3>
                    <p className="text-xs text-slate-400">
                        Link an ingested security dataset. The engine will extract normalized events and calculate expected vs observed distributions.
                    </p>

                    <div>
                        {loadingDatasets ? (
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                Loading datasets...
                            </div>
                        ) : datasets.length === 0 ? (
                            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400">
                                No datasets uploaded yet. You can still create an assessment using custom JSON expected definition.
                            </div>
                        ) : (
                            <select
                                value={datasetId}
                                onChange={(e) => setDatasetId(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                            >
                                <option value="">-- None (Pure Synthetic / Custom Baseline) --</option>
                                {datasets.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.business_id} — {d.name} ({d.file_type}, {d.record_count} records, Quality: {d.quality_score ? `${d.quality_score}%` : "Pending"})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Time Windows */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        Baseline & Comparison Time Windows (Optional)
                    </h3>
                    <p className="text-xs text-slate-400">
                        Specify time intervals for baseline calculation and evaluation. If omitted, the entire dataset will be evaluated against expected definitions.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                            <span className="text-xs font-semibold text-cyan-400">Baseline Window (Normal Expected Activity)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-1">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        value={baselineStart}
                                        onChange={(e) => setBaselineStart(e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-1">End Date</label>
                                    <input
                                        type="datetime-local"
                                        value={baselineEnd}
                                        onChange={(e) => setBaselineEnd(e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                            <span className="text-xs font-semibold text-amber-400">Comparison Window (Target Evaluation Window)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-1">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        value={comparisonStart}
                                        onChange={(e) => setComparisonStart(e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-slate-500 block mb-1">End Date</label>
                                    <input
                                        type="datetime-local"
                                        value={comparisonEnd}
                                        onChange={(e) => setComparisonEnd(e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deterministic Detection Thresholds */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        Deterministic Detection Thresholds
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-300">Volume Deficit Threshold (Rule 1)</span>
                                <span className="font-mono text-cyan-400 font-bold">{volumeThreshold}% drop</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="95"
                                step="5"
                                value={volumeThreshold}
                                onChange={(e) => setVolumeThreshold(Number(e.target.value))}
                                className="w-full accent-cyan-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-slate-500">
                                Triggers monitoring blind spot when event type volume drops below baseline expectation by this margin.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-300">Source Silence Threshold (Rule 2)</span>
                                <span className="font-mono text-cyan-400 font-bold">{silenceThreshold}% drop</span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="100"
                                step="5"
                                value={silenceThreshold}
                                onChange={(e) => setSilenceThreshold(Number(e.target.value))}
                                className="w-full accent-cyan-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-slate-500">
                                Triggers telemetry silence when an active log forwarder or sensor drops by this margin (100% = total silence).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-300">Authentication Drop Threshold (Rule 4)</span>
                                <span className="font-mono text-cyan-400 font-bold">{authDropThreshold}% drop</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="95"
                                step="5"
                                value={authDropThreshold}
                                onChange={(e) => setAuthDropThreshold(Number(e.target.value))}
                                className="w-full accent-cyan-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-slate-500">
                                Flags authentication deficit when IAM / SSO events drop sharply without scheduled maintenance.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-300">Minimum Baseline Events</span>
                                <span className="font-mono text-cyan-400 font-bold">{minBaselineEvents} events</span>
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={minBaselineEvents}
                                onChange={(e) => setMinBaselineEvents(Number(e.target.value))}
                                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                            />
                            <p className="text-[11px] text-slate-500">
                                Minimum observations required in baseline window before generating confident signals.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Expected Activity Definition / Presets */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-white">Expected Activity Definition (Optional)</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                If empty, the engine automatically derives expected distributions from the linked dataset baseline window.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => applyPreset("ENTERPRISE_STANDARD")}
                                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                            >
                                Enterprise Preset
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset("PERIMETER_DEFENSE")}
                                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                            >
                                Perimeter Preset
                            </button>
                        </div>
                    </div>

                    <textarea
                        rows={6}
                        value={expectedJson}
                        onChange={(e) => setExpectedJson(e.target.value)}
                        placeholder={`{\n  "total_events": 100,\n  "by_event_type": { "USER_LOGIN": 50, "FIREWALL_BLOCK": 50 },\n  "by_source": { "AZURE_AD": 50, "PALO_ALTO": 50 }\n}`}
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                    />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                    <Link
                        href="/negative-space"
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                        {submitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Specification & Open Dossier
                    </button>
                </div>
            </form>
        </div>
    );
}
