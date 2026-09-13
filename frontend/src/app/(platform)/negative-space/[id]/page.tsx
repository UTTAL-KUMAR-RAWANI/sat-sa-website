"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    negativeSpaceApi,
    NegativeSpaceAssessmentDetail,
    NegativeSpaceSignal,
} from "@/lib/api/negative-space";
import {
    ArrowLeft,
    EyeOff,
    Play,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Layers,
    Database,
    ShieldAlert,
    TrendingDown,
    Activity,
    ArrowUpRight,
    Sliders,
    Info,
} from "lucide-react";

export default function NegativeSpaceAssessmentDossierPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const assessmentId = resolvedParams.id;
    const router = useRouter();
    const { user } = useAuth();

    const [assessment, setAssessment] = useState<NegativeSpaceAssessmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canRun = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_RUN) : false;

    const loadAssessment = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await negativeSpaceApi.getAssessment(assessmentId);
            setAssessment(data);
        } catch (err: any) {
            console.error("Failed to fetch assessment dossier:", err);
            setError(err.message || "Failed to load assessment dossier");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssessment();
    }, [assessmentId]);

    const handleRun = async () => {
        setRunning(true);
        try {
            await negativeSpaceApi.runAssessment(assessmentId);
            await loadAssessment();
        } catch (err: any) {
            alert(err.message || "Failed to run assessment");
        } finally {
            setRunning(false);
        }
    };

    if (loading && !assessment) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                    <p className="text-sm text-slate-400">Loading negative-space assessment dossier...</p>
                </div>
            </div>
        );
    }

    if (error && !assessment) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
                <div className="max-w-2xl mx-auto p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 text-rose-400">
                        <AlertTriangle className="w-6 h-6" />
                        <h2 className="text-lg font-bold">Failed to Load Assessment</h2>
                    </div>
                    <p className="text-sm text-slate-300">{error}</p>
                    <Link
                        href="/negative-space"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-sm rounded-lg hover:bg-slate-800 transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Registry
                    </Link>
                </div>
            </div>
        );
    }

    if (!assessment) return null;

    const summary = assessment.assessment_summary;
    const expectedDef = assessment.expected_activity_definition || {};
    const observedDef = assessment.observed_activity_definition || {};

    const expByEvent = expectedDef.by_event_type || {};
    const obsByEvent = observedDef.by_event_type || {};
    const allEventTypes = Array.from(new Set([...Object.keys(expByEvent), ...Object.keys(obsByEvent)]));

    const expBySource = expectedDef.by_source || {};
    const obsBySource = observedDef.by_source || {};
    const allSources = Array.from(new Set([...Object.keys(expBySource), ...Object.keys(obsBySource)]));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-start gap-4">
                    <Link
                        href="/negative-space"
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition mt-1"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-cyan-400 font-bold text-lg">{assessment.business_id}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                {assessment.assessment_type.replace(/_/g, " ")}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {assessment.status}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">{assessment.name}</h1>
                        {assessment.description && (
                            <p className="text-sm text-slate-400 mt-1 max-w-3xl">{assessment.description}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {canRun && (
                        <button
                            onClick={handleRun}
                            disabled={running}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                        >
                            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            {assessment.status === "COMPLETED" || assessment.status === "REVIEW_REQUIRED"
                                ? "Re-Run Assessment"
                                : "Execute Engine"}
                        </button>
                    )}
                    <Link
                        href={`/negative-space/${assessment.id}/signals`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-800 transition"
                    >
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        View All Signals ({assessment.signal_count})
                    </Link>
                </div>
            </div>

            {/* Data Quality Warning Alert (Safety Guard) */}
            {summary?.has_data_quality_concern && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-200">Data Quality Safety Guard Triggered</h4>
                        <p className="text-xs text-amber-300/80 mt-1">
                            {summary.data_quality_notes || "Dataset quality issues detected. Telemetry deficit may stem from ingestion, parsing or schema errors. Verify ingestion logs before confirming gaps."}
                        </p>
                    </div>
                </div>
            )}

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Total Telemetry Gap</span>
                    <p className="text-2xl font-bold text-white mt-1 font-mono">
                        {summary?.overall_gap_percentage !== undefined ? `${summary.overall_gap_percentage}%` : "--"}
                    </p>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                        Expected: {summary?.expected_events_count ?? 0} | Observed: {summary?.observed_events_count ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Negative-Space Signals</span>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{assessment.signal_count}</p>
                    <span className="text-[11px] text-cyan-500/80 mt-1 block">Unobserved activity flags</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                    <span className="text-xs font-medium text-rose-300">Potential Missed Threats</span>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{assessment.potential_missed_threat_count}</p>
                    <span className="text-[11px] text-rose-400/70 mt-1 block">High / Critical severity gaps</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Execution Status</span>
                    <p className="text-base font-bold text-white mt-2 flex items-center gap-2">
                        {assessment.status === "COMPLETED" || assessment.status === "REVIEW_REQUIRED" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <Clock className="w-5 h-5 text-amber-400" />
                        )}
                        {assessment.status}
                    </p>
                    <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                        {assessment.completed_at ? new Date(assessment.completed_at).toLocaleString() : "Not executed yet"}
                    </span>
                </div>
            </div>

            {/* Visual Telemetry Comparison: Expected vs Observed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Event Types Comparison */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            Event Type Telemetry Distribution
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">Expected vs Observed</span>
                    </div>

                    {allEventTypes.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center">
                            No event type distribution available. Run the assessment to evaluate.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {allEventTypes.slice(0, 8).map((etype) => {
                                const exp = expByEvent[etype] || 0;
                                const obs = obsByEvent[etype] || 0;
                                const maxVal = Math.max(exp, obs, 1);
                                const gapPct = exp > 0 ? Math.round(((exp - obs) / exp) * 100) : 0;

                                return (
                                    <div key={etype} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="font-mono text-slate-300 font-semibold">{etype}</span>
                                            <span className="text-slate-400 font-mono text-[11px]">
                                                Exp: <strong className="text-cyan-400">{exp}</strong> | Obs:{" "}
                                                <strong className={obs === 0 ? "text-rose-400" : "text-slate-200"}>{obs}</strong>
                                                {gapPct > 0 && (
                                                    <span className="ml-1.5 text-rose-400 font-bold">({gapPct}% gap)</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 h-2 bg-slate-950 rounded-full overflow-hidden p-0.5">
                                            <div
                                                className="bg-cyan-500 rounded-l-full h-full"
                                                style={{ width: `${(exp / maxVal) * 100}%` }}
                                                title={`Expected: ${exp}`}
                                            />
                                            <div
                                                className={`rounded-r-full h-full ${obs === 0 ? "bg-transparent" : "bg-emerald-400"}`}
                                                style={{ width: `${(obs / maxVal) * 100}%` }}
                                                title={`Observed: ${obs}`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Log Sources / Sensor Silence Matrix */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Database className="w-4 h-4 text-cyan-400" />
                            Log Source Forwarder & Sensor Status
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">Active / Silent</span>
                    </div>

                    {allSources.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center">
                            No telemetry sources recorded yet. Run the assessment to inspect.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-800/60">
                            {allSources.map((src) => {
                                const exp = expBySource[src] || 0;
                                const obs = obsBySource[src] || 0;
                                const isSilent = exp > 0 && obs === 0;

                                return (
                                    <div key={src} className="py-2.5 flex items-center justify-between">
                                        <div>
                                            <span className="font-mono text-xs font-semibold text-slate-200">{src}</span>
                                            <span className="text-[11px] text-slate-400 block">
                                                Expected: {exp} events
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono text-slate-300">
                                                {obs} observed
                                            </span>
                                            {isSilent ? (
                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                    SOURCE SILENT
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    HEALTHY
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Rule Hits Breakdown */}
            {summary?.rule_hits && (
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        7 Deterministic Rules Execution Breakdown
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {Object.entries(summary.rule_hits).map(([rule, hits]) => (
                            <div
                                key={rule}
                                className={`p-3 rounded-lg border ${
                                    (hits as number) > 0
                                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                                        : "bg-slate-950 border-slate-800 text-slate-400"
                                }`}
                            >
                                <span className="text-[10px] font-mono uppercase block text-slate-500">
                                    {rule.replace(/_/g, " ")}
                                </span>
                                <p className="text-lg font-bold mt-1 font-mono">{hits as number}</p>
                                <span className="text-[10px]">
                                    {(hits as number) > 0 ? "Violations detected" : "Compliant"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Signals List */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-white flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            Negative-Space Signals Generated ({assessment.signals?.length ?? 0})
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Gaps flagged for human supervisory review, validation, and Finding conversion
                        </p>
                    </div>
                    <Link
                        href={`/negative-space/${assessment.id}/signals`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1"
                    >
                        View Full Signals Workspace
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {assessment.signals?.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                        No negative-space signals detected. All telemetry matches baseline expectations.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {assessment.signals?.slice(0, 5).map((s) => (
                            <div
                                key={s.id}
                                onClick={() => router.push(`/negative-space/signals/${s.id}`)}
                                className="p-3.5 bg-slate-950 hover:bg-slate-800/60 rounded-lg border border-slate-800 transition cursor-pointer flex items-center justify-between gap-4"
                            >
                                <div className="space-y-1 max-w-2xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-cyan-400">{s.business_id}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                                            {s.category.replace(/_/g, " ")}
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                s.severity === "CRITICAL"
                                                    ? "bg-rose-500/20 text-rose-300"
                                                    : s.severity === "HIGH"
                                                    ? "bg-orange-500/20 text-orange-300"
                                                    : "bg-amber-500/20 text-amber-300"
                                            }`}
                                        >
                                            {s.severity}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300">{s.gap_description}</p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right font-mono">
                                        <span className="text-xs font-bold text-white block">{s.gap_percentage}% gap</span>
                                        <span className="text-[10px] text-slate-500">{s.confidence} Confidence</span>
                                    </div>
                                    <span className="p-1 text-slate-400 hover:text-white">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
