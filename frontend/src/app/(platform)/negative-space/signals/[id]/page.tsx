"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    negativeSpaceApi,
    NegativeSpaceSignal,
} from "@/lib/api/negative-space";
import {
    ArrowLeft,
    EyeOff,
    CheckCircle2,
    XCircle,
    FileWarning,
    AlertTriangle,
    ShieldAlert,
    MessageSquare,
    RefreshCw,
    Send,
    ExternalLink,
    Sliders,
    Layers,
    Clock,
    Activity,
} from "lucide-react";

export default function NegativeSpaceSignalWorkspacePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const signalId = resolvedParams.id;
    const router = useRouter();
    const { user } = useAuth();

    const [signal, setSignal] = useState<NegativeSpaceSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal / form states
    const [reviewNotes, setReviewNotes] = useState("");
    const [dismissModalOpen, setDismissModalOpen] = useState(false);
    const [dismissReason, setDismissReason] = useState("");
    const [findingModalOpen, setFindingModalOpen] = useState(false);
    const [findingTitle, setFindingTitle] = useState("");
    const [findingPriority, setFindingPriority] = useState("MEDIUM");
    const [convertedFindingId, setConvertedFindingId] = useState<string | null>(null);

    const canReview = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_SIGNAL_REVIEW) : false;
    const canValidate = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_SIGNAL_VALIDATE) : false;
    const canDismiss = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_SIGNAL_DISMISS) : false;
    const canConvert = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_CONVERT_FINDING) : false;

    const loadSignal = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await negativeSpaceApi.getSignal(signalId);
            setSignal(data);
            if (data.converted_finding_id) {
                setConvertedFindingId(data.converted_finding_id);
            }
        } catch (err: any) {
            console.error("Failed to load signal:", err);
            setError(err.message || "Failed to load signal details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSignal();
    }, [signalId]);

    const handleAddReviewComment = async () => {
        if (!reviewNotes.trim()) return;
        setSubmitting(true);
        try {
            const updated = await negativeSpaceApi.reviewSignal(signalId, { review_comments: reviewNotes });
            setSignal(updated);
            setReviewNotes("");
        } catch (err: any) {
            alert(err.message || "Failed to record review note");
        } finally {
            setSubmitting(false);
        }
    };

    const handleValidate = async () => {
        setSubmitting(true);
        try {
            const updated = await negativeSpaceApi.validateSignal(signalId, {
                notes: "Confirmed genuine detection coverage gap by human analyst.",
            });
            setSignal(updated);
        } catch (err: any) {
            alert(err.message || "Failed to validate signal");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDismiss = async () => {
        if (!dismissReason.trim() || dismissReason.trim().length < 10) {
            alert("Mandatory justification must be at least 10 characters.");
            return;
        }
        setSubmitting(true);
        try {
            const updated = await negativeSpaceApi.dismissSignal(signalId, {
                dismissal_reason: dismissReason.trim(),
            });
            setSignal(updated);
            setDismissModalOpen(false);
        } catch (err: any) {
            alert(err.message || "Failed to dismiss signal");
        } finally {
            setSubmitting(false);
        }
    };

    const handleConvertToFinding = async () => {
        setSubmitting(true);
        try {
            const res = await negativeSpaceApi.convertSignalToFinding(signalId, {
                title: findingTitle.trim() || undefined,
                priority: findingPriority,
                remediation_required: true,
            });
            setSignal(res.signal);
            setConvertedFindingId(res.finding_id);
            setFindingModalOpen(false);
        } catch (err: any) {
            alert(err.message || "Failed to convert signal to Finding");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !signal) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                    <p className="text-sm text-slate-400">Loading negative-space signal workspace...</p>
                </div>
            </div>
        );
    }

    if (error && !signal) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
                <div className="max-w-xl mx-auto p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 text-rose-400">
                        <AlertTriangle className="w-6 h-6" />
                        <h2 className="text-lg font-bold">Failed to Load Signal</h2>
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

    if (!signal) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-start gap-4">
                    <Link
                        href={`/negative-space/${signal.assessment_id}`}
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition mt-1"
                        title="Back to Assessment Dossier"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold text-base">{signal.business_id}</span>
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {signal.category.replace(/_/g, " ")}
                            </span>
                            <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    signal.severity === "CRITICAL"
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        : signal.severity === "HIGH"
                                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                            >
                                {signal.severity}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-900 text-slate-400 border border-slate-800">
                                Confidence: {signal.confidence}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white mt-2 max-w-3xl">
                            {signal.gap_description}
                        </h1>
                    </div>
                </div>

                {/* Status & Converted Link */}
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {signal.status}
                    </span>
                    {convertedFindingId && (
                        <Link
                            href={`/findings/${convertedFindingId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded border border-purple-500/40 transition"
                        >
                            View Linked Finding
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Data Quality Safety Callout */}
            {signal.data_quality_concern && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="font-semibold text-amber-200">Data Quality Alert: Qualified Signal</h4>
                        <p className="text-xs text-amber-300/80">
                            {signal.data_quality_notes || "Dataset ingestion quality concerns detected. Absence may be due to ingestion errors, schema mismatch, or parsing dropouts rather than genuine telemetry loss."}
                        </p>
                        <p className="text-[11px] text-amber-400/90 font-medium">
                            Safety Boundary: Validate against endpoint agent status and collector network logs before confirming as a genuine monitoring blind spot.
                        </p>
                    </div>
                </div>
            )}

            {/* Core Principle Comparison Grid */}
            <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
                            Core Negative-Space Assessment
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5">
                            “What should have been observed, but was not observed?”
                        </h3>
                    </div>
                    <div className="text-right font-mono">
                        <span className="text-2xl font-bold text-rose-400">{signal.gap_percentage.toFixed(1)}%</span>
                        <span className="text-xs text-slate-500 block">Telemetry Gap Magnitude</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Expected Activity */}
                    <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                Expected Security Telemetry
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">Baseline Frequency</span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-lg text-xs font-mono text-cyan-300 space-y-1">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(signal.expected_activity || {}, null, 2)}
                            </pre>
                        </div>
                        <p className="text-xs text-slate-400">
                            Derived from historical telemetry normal profiles, authorized asset registries, or active control specifications.
                        </p>
                    </div>

                    {/* Observed Activity */}
                    <div className="p-4 bg-slate-950 rounded-xl border border-rose-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                                Observed Telemetry In Window
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">Evaluation Telemetry</span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-lg text-xs font-mono text-rose-300 space-y-1">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(signal.observed_activity || {}, null, 2)}
                            </pre>
                        </div>
                        <p className="text-xs text-slate-400">
                            Actual telemetry recorded in the ingestion window. Identifies sensor silence, dropped packets, or suppressed alerting.
                        </p>
                    </div>
                </div>

                {/* Supporting Rule Execution Details */}
                {signal.supporting_event_refs && (
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Deterministic Rule Context
                        </span>
                        <div className="p-3 bg-slate-900/80 rounded font-mono text-xs text-slate-300">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(signal.supporting_event_refs, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            {/* Human Review & Action Studio */}
            <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-cyan-400" />
                            Human Review & Action Workspace
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Validate, add commentary, dismiss with justification, or convert confirmed gaps to formal Findings
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {canValidate && signal.status !== "VALIDATED" && signal.status !== "CONVERTED_TO_FINDING" && (
                            <button
                                onClick={handleValidate}
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30 transition disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Validate Gap
                            </button>
                        )}

                        {canDismiss && signal.status !== "DISMISSED" && signal.status !== "CONVERTED_TO_FINDING" && (
                            <button
                                onClick={() => setDismissModalOpen(true)}
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" />
                                Dismiss Signal
                            </button>
                        )}

                        {canConvert && signal.status !== "CONVERTED_TO_FINDING" && signal.status !== "DISMISSED" && (
                            <button
                                onClick={() => setFindingModalOpen(true)}
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-slate-950 rounded-lg transition shadow-lg shadow-purple-500/20 disabled:opacity-50 font-bold"
                            >
                                <FileWarning className="w-4 h-4" />
                                Convert to Finding
                            </button>
                        )}
                    </div>
                </div>

                {/* Review Notes & Comments */}
                <div className="space-y-4">
                    {signal.review_comments && (
                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                            <span className="text-xs font-semibold text-slate-400">Analyst Review Log</span>
                            <p className="text-sm text-slate-200 whitespace-pre-wrap">{signal.review_comments}</p>
                            <span className="text-[11px] text-slate-500 font-mono block mt-2">
                                Last updated: {signal.reviewed_at ? new Date(signal.reviewed_at).toLocaleString() : "--"}
                            </span>
                        </div>
                    )}

                    {signal.dismissal_reason && (
                        <div className="p-4 bg-slate-950 rounded-lg border border-rose-500/20 space-y-1">
                            <span className="text-xs font-semibold text-rose-400">Dismissal Justification (Mandatory Audit)</span>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{signal.dismissal_reason}</p>
                        </div>
                    )}

                    {/* Add Review Note Form */}
                    {canReview && signal.status !== "DISMISSED" && signal.status !== "CONVERTED_TO_FINDING" && (
                        <div className="space-y-3 pt-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Add Investigation Notes / Hypotheses
                            </label>
                            <div className="flex gap-2">
                                <textarea
                                    rows={2}
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Enter review comments (e.g. checked syslog forwarder config, sensor disconnected at 14:00 UTC)..."
                                    className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                                />
                                <button
                                    onClick={handleAddReviewComment}
                                    disabled={submitting || !reviewNotes.trim()}
                                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-sm transition disabled:opacity-50 self-end"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* DISMISSAL MODAL */}
            {dismissModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <XCircle className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-white">Dismiss Negative-Space Signal</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                            Dismissing requires a mandatory, auditable justification explaining why this absence is expected or benign (minimum 10 characters).
                        </p>

                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                Mandatory Justification *
                            </label>
                            <textarea
                                rows={4}
                                value={dismissReason}
                                onChange={(e) => setDismissReason(e.target.value)}
                                placeholder="State why telemetry absence is benign (e.g., Scheduled maintenance window, server decommissioned per change ticket CHG-2026-104)..."
                                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDismissModalOpen(false)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDismiss}
                                disabled={submitting || dismissReason.trim().length < 10}
                                className="px-4 py-2 text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition disabled:opacity-50"
                            >
                                Confirm Dismissal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONVERT TO FINDING MODAL */}
            {findingModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-purple-400">
                            <FileWarning className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-white">Convert to Formal Finding</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                            This creates a formal Finding with source type <code>NEGATIVE_SPACE</code> and initiates the governance & remediation lifecycle.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                    Finding Title
                                </label>
                                <input
                                    type="text"
                                    value={findingTitle}
                                    onChange={(e) => setFindingTitle(e.target.value)}
                                    placeholder={`[Negative-Space] ${signal.category.replace(/_/g, " ")}: ${signal.gap_description.slice(0, 50)}...`}
                                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                    Priority
                                </label>
                                <select
                                    value={findingPriority}
                                    onChange={(e) => setFindingPriority(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                                >
                                    <option value="P1">P1 - Critical Priority</option>
                                    <option value="P2">P2 - High Priority</option>
                                    <option value="P3">P3 - Medium Priority</option>
                                    <option value="P4">P4 - Low Priority</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setFindingModalOpen(false)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConvertToFinding}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-semibold bg-purple-500 hover:bg-purple-400 text-slate-950 rounded-lg transition disabled:opacity-50 font-bold"
                            >
                                Convert to Finding
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
