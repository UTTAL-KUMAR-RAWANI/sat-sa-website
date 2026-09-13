"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { secopsApi, Alert as AlertType } from "@/lib/api/secops";
import {
    ArrowLeft,
    Clock,
    Building2,
    Radio,
    User as UserIcon,
    AlertCircle,
    ExternalLink,
    Activity,
    FileText
} from "lucide-react";

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [alertItem, setAlertItem] = useState<AlertType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Triage form
    const [triageDecision, setTriageDecision] = useState("CONFIRMED_SECURITY_EVENT");
    const [triageNotes, setTriageNotes] = useState("");
    const [adjustSeverity, setAdjustSeverity] = useState("");
    const [adjustPriority, setAdjustPriority] = useState("");
    const [createCseChecked, setCreateCseChecked] = useState(true);
    const [triaging, setTriaging] = useState(false);

    const loadAlert = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await secopsApi.getAlert(resolvedParams.id);
            setAlertItem(data);
            setAdjustSeverity(data.severity);
            setAdjustPriority(data.priority);
            setTriageNotes(data.triage_notes || "");
            if (data.triage_decision) {
                setTriageDecision(data.triage_decision);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load alert details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlert();
    }, [resolvedParams.id]);

    const handleTriageSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTriaging(true);
        try {
            const updated = await secopsApi.triageAlert(resolvedParams.id, {
                decision: triageDecision,
                notes: triageNotes,
                severity: adjustSeverity,
                priority: adjustPriority,
                create_cse: createCseChecked
            });
            setAlertItem(updated);
            window.alert("Triage decision applied successfully.");
            if (updated.cse_id) {
                router.push(`/cse/${updated.cse_id}`);
            }
        } catch (err: any) {
            window.alert(err.message || "Error submitting triage");
        } finally {
            setTriaging(false);
        }
    };

    const handleAcknowledge = async () => {
        try {
            const updated = await secopsApi.transitionAlert(resolvedParams.id, {
                to_status: "ACKNOWLEDGED",
                reason: "Analyst acknowledged receipt and commenced active investigation."
            });
            setAlertItem(updated);
        } catch (err: any) {
            window.alert(err.message || "Error acknowledging alert");
        }
    };

    const handleClose = async () => {
        const reason = prompt("Enter closure justification notes:");
        if (reason === null) return;
        try {
            const updated = await secopsApi.transitionAlert(resolvedParams.id, {
                to_status: "CLOSED",
                reason: reason || "Closed by analyst."
            });
            setAlertItem(updated);
        } catch (err: any) {
            window.alert(err.message || "Error closing alert");
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Loading alert details...</span>
                </div>
            </div>
        );
    }

    if (error || !alertItem) {
        return (
            <div className="space-y-4">
                <Link href="/alerts" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to Alerts
                </Link>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-400">
                    <AlertCircle className="h-6 w-6 mb-2" />
                    <h2 className="text-base font-bold">Failed to load Alert</h2>
                    <p className="text-xs text-rose-300 mt-1">{error || "Record not found or access denied."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link href="/alerts" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Alerts Queue
                </Link>
                <div className="flex items-center gap-2">
                    {alertItem.status === "NEW" && (
                        <button
                            onClick={handleAcknowledge}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                        >
                            Acknowledge Alert
                        </button>
                    )}
                    {alertItem.status !== "CLOSED" && (
                        <button
                            onClick={handleClose}
                            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                        >
                            Close Alert
                        </button>
                    )}
                </div>
            </div>

            {/* Alert Header Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-sm font-bold text-emerald-400">
                                {alertItem.business_id}
                            </span>
                            <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
                                {alertItem.status}
                            </span>
                            <span className="rounded bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                                {alertItem.severity}
                            </span>
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-mono font-bold text-amber-400 border border-amber-500/30">
                                {alertItem.priority}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            {alertItem.title}
                        </h1>
                        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                            {alertItem.description || "No descriptive context supplied with this event telemetry."}
                        </p>
                    </div>

                    {alertItem.cse_id && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col items-start gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                                <Activity className="h-4 w-4" />
                                Escalated to Cyber Security Event
                            </div>
                            <Link
                                href={`/cse/${alertItem.cse_id}`}
                                className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                            >
                                Open {alertItem.cse_business_id || "CSE"}
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 mt-6 pt-5 text-xs">
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Originating Source</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Radio className="h-3.5 w-3.5 text-slate-500" />
                            {alertItem.source}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Supervised Entity</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            {alertItem.organization_name || "Enterprise Wide"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Assigned SOC Analyst</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                            {alertItem.assigned_to_name || "Queue (Unassigned)"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Ingested Timestamp</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {new Date(alertItem.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Triage & Operational Analysis Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Triage Form */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                    <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-emerald-400" />
                        Analyst Triage Assessment
                    </h2>
                    <p className="text-xs text-slate-400 mb-6">
                        Classify security impact, record investigation notes, and optionally instantiate a formal CSE ticket.
                    </p>

                    <form onSubmit={handleTriageSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-2">
                                Triage Classification Decision *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {[
                                    { value: "CONFIRMED_SECURITY_EVENT", label: "Confirmed Security Event", desc: "True positive requiring formal incident handling" },
                                    { value: "SUSPICIOUS", label: "Suspicious Activity", desc: "Under continuing observation" },
                                    { value: "BENIGN", label: "Benign Anomaly", desc: "Authorized behavior or verified test execution" },
                                    { value: "FALSE_POSITIVE", label: "False Positive", desc: "Sensor error or inaccurate rule threshold" },
                                    { value: "ESCALATE", label: "Direct Escalation", desc: "Severe threat demanding urgent supervisor intervention" }
                                ].map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${
                                            triageDecision === opt.value
                                                ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                                                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="decision"
                                                value={opt.value}
                                                checked={triageDecision === opt.value}
                                                onChange={(e) => setTriageDecision(e.target.value)}
                                                className="text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-xs font-semibold text-white">{opt.label}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 pl-5">{opt.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Triage Evaluation Notes *
                            </label>
                            <textarea
                                rows={4}
                                required
                                value={triageNotes}
                                onChange={(e) => setTriageNotes(e.target.value)}
                                placeholder="Explain forensic indicators observed, corroborating log sources, or why this decision was reached..."
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Adjusted Severity</label>
                                <select
                                    value={adjustSeverity}
                                    onChange={(e) => setAdjustSeverity(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Adjusted Priority</label>
                                <select
                                    value={adjustPriority}
                                    onChange={(e) => setAdjustPriority(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="P1">P1 - Urgent</option>
                                    <option value="P2">P2 - High</option>
                                    <option value="P3">P3 - Standard</option>
                                    <option value="P4">P4 - Low</option>
                                </select>
                            </div>
                        </div>

                        {!alertItem.cse_id && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="createCse"
                                    checked={createCseChecked}
                                    onChange={(e) => setCreateCseChecked(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="createCse" className="text-xs text-slate-300 cursor-pointer">
                                    <span className="font-semibold text-white block">Instantiate Cyber Security Event (CSE)</span>
                                    Automatically create a linked CSE ticket for formal investigation and supervisory visibility.
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={triaging}
                                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                            >
                                {triaging ? "Applying Triage..." : "Submit Triage Evaluation"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Col: Triage History & Traceability */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Triage Record
                        </h3>
                        {alertItem.triaged_at ? (
                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-slate-500 block text-[11px]">Recorded Decision</span>
                                    <span className="font-semibold text-emerald-400">{alertItem.triage_decision}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[11px]">Triaged By</span>
                                    <span className="text-slate-300">{alertItem.triaged_by_name || "Analyst"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[11px]">Triage Date</span>
                                    <span className="text-slate-300">{new Date(alertItem.triaged_at).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[11px]">Analyst Findings</span>
                                    <p className="text-slate-300 italic bg-slate-950 p-2 rounded border border-slate-800 mt-1">
                                        &ldquo;{alertItem.triage_notes}&rdquo;
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 italic py-4 text-center">
                                This alert has not been triaged yet.
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm text-xs space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Workflow Integrity
                        </h3>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                            SAT-SA enforces strictly controlled state machines. Moving from Alert to CSE creates an immutable relationship to ensure complete supervisory traceability.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
