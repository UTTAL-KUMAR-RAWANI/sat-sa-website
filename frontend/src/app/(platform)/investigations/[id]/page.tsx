"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { secopsApi, Investigation, TimelineEvent } from "@/lib/api/secops";
import { findingsApi, Finding, FindingSeverity, FindingPriority } from "@/lib/api/findings";
import {
    ArrowLeft,
    Clock,
    User as UserIcon,
    AlertCircle,
    Upload,
    ExternalLink,
    Save,
    History,
    FileWarning,
    ChevronRight
} from "lucide-react";

export default function InvestigationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [inv, setInv] = useState<Investigation | null>(null);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Findings Summary editor
    const [findingsSummary, setFindingsSummary] = useState("");
    const [savingFindings, setSavingFindings] = useState(false);

    // Upload Evidence modal
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [evdTitle, setEvdTitle] = useState("");
    const [evdDesc, setEvdDesc] = useState("");
    const [evdType, setEvdType] = useState("LOG");
    const [evdFile, setEvdFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    // Connected Findings & Create Finding modal
    const [connectedFindings, setConnectedFindings] = useState<Finding[]>([]);
    const [showFindingModal, setShowFindingModal] = useState(false);
    const [fndTitle, setFndTitle] = useState("");
    const [fndDesc, setFndDesc] = useState("");
    const [fndSeverity, setFndSeverity] = useState<FindingSeverity>("HIGH");
    const [fndPriority, setFndPriority] = useState<FindingPriority>("HIGH");
    const [creatingFinding, setCreatingFinding] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [data, tlData, fndList] = await Promise.all([
                secopsApi.getInvestigation(resolvedParams.id),
                secopsApi.getInvestigationTimeline(resolvedParams.id),
                findingsApi.getFindings({ source_type: "INVESTIGATION" }).catch(() => ({ items: [] }))
            ]);
            setInv(data);
            setFindingsSummary(data.findings_summary || "");
            setTimeline(tlData);
            setConnectedFindings(fndList.items.filter((f) => f.investigation_id === resolvedParams.id));
        } catch (err: any) {
            setError(err.message || "Failed to load investigation details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [resolvedParams.id]);

    const handleCreateFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inv) return;
        setCreatingFinding(true);
        try {
            await findingsApi.createFinding({
                title: fndTitle,
                description: fndDesc,
                severity: fndSeverity,
                priority: fndPriority,
                classification: "Security",
                source_type: "INVESTIGATION",
                investigation_id: inv.id,
                cse_id: inv.cse_id
            });
            setShowFindingModal(false);
            setFndTitle("");
            setFndDesc("");
            loadData();
        } catch (err: any) {
            window.alert(err.message || "Error creating finding");
        } finally {
            setCreatingFinding(false);
        }
    };

    const handleSaveFindings = async () => {
        setSavingFindings(true);
        try {
            const updated = await secopsApi.updateInvestigation(resolvedParams.id, {
                findings_summary: findingsSummary
            });
            setInv(updated);
            alert("Investigation findings saved successfully.");
        } catch (err: any) {
            alert(err.message || "Error saving findings");
        } finally {
            setSavingFindings(false);
        }
    };

    const handleTransition = async (toStatus: string) => {
        const reason = prompt(`Enter reason notes for transition to '${toStatus}':`);
        if (reason === null) return;
        try {
            const updated = await secopsApi.transitionInvestigation(resolvedParams.id, {
                to_status: toStatus,
                reason: reason || undefined
            });
            setInv(updated);
            loadData();
        } catch (err: any) {
            alert(err.message || "Error transitioning investigation");
        }
    };

    const handleUploadEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("title", evdTitle);
            if (evdDesc) fd.append("description", evdDesc);
            fd.append("evidence_type", evdType);
            fd.append("investigation_id", resolvedParams.id);
            if (inv?.cse_id) fd.append("cse_id", inv.cse_id);
            if (evdFile) fd.append("file", evdFile);

            await secopsApi.uploadEvidence(fd);
            setShowUploadModal(false);
            setEvdTitle("");
            setEvdDesc("");
            setEvdFile(null);
            loadData();
        } catch (err: any) {
            alert(err.message || "Error uploading evidence");
        } finally {
            setUploading(false);
        }
    };

    const getNextAllowedTransitions = (status: string): string[] => {
        switch (status.toUpperCase()) {
            case "OPEN":
                return ["IN_PROGRESS", "CLOSED"];
            case "IN_PROGRESS":
                return ["ESCALATED", "CONCLUDED", "CLOSED"];
            case "ESCALATED":
                return ["IN_PROGRESS", "CONCLUDED"];
            case "CONCLUDED":
                return ["CLOSED", "IN_PROGRESS"];
            case "CLOSED":
                return ["IN_PROGRESS"];
            default:
                return [];
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Loading investigation console...</span>
                </div>
            </div>
        );
    }

    if (error || !inv) {
        return (
            <div className="space-y-4">
                <Link href="/investigations" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to Investigations
                </Link>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-400">
                    <AlertCircle className="h-6 w-6 mb-2" />
                    <h2 className="text-base font-bold">Investigation Unavailable</h2>
                    <p className="text-xs text-rose-300 mt-1">{error || "Record not found or outside scope."}</p>
                </div>
            </div>
        );
    }

    const nextStates = getNextAllowedTransitions(inv.status);

    return (
        <div className="space-y-6">
            {/* Top Back Link */}
            <div className="flex items-center justify-between">
                <Link href="/investigations" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Investigations Directory
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFindingModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors"
                    >
                        <FileWarning className="h-4 w-4" /> Create Finding
                    </button>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors"
                    >
                        <Upload className="h-4 w-4" /> Upload Evidence
                    </button>
                </div>
            </div>

            {/* Header Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-base font-bold text-emerald-400">
                                {inv.business_id}
                            </span>
                            <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-200 border border-slate-700">
                                {inv.status}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            {inv.title}
                        </h1>
                        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                            {inv.description || "No description logged."}
                        </p>
                    </div>

                    {/* Transition Controls */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-500 px-2 font-medium">Status Transition:</span>
                        {nextStates.map((st) => (
                            <button
                                key={st}
                                onClick={() => handleTransition(st)}
                                className="rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-colors"
                            >
                                → {st.replace(/_/g, " ")}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 pt-4 text-xs">
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Parent Incident (CSE)</div>
                        <div className="text-slate-300 font-medium">
                            <Link href={`/cse/${inv.cse_id}`} className="text-emerald-400 hover:underline flex items-center gap-1">
                                {inv.cse_business_id || "Open CSE"}
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Lead Forensic Analyst</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                            {inv.lead_analyst_name || "Unassigned"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Investigation Started</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {inv.started_at ? new Date(inv.started_at).toLocaleDateString() : "—"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Concluded At</div>
                        <div className="text-slate-300 font-medium">
                            {inv.completed_at ? new Date(inv.completed_at).toLocaleDateString() : "Ongoing"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Workspace: Findings Summary & Activity Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Findings Notepad */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-white">Forensic Findings Summary</h2>
                            <p className="text-xs text-slate-400">
                                Live technical notebook documenting indicators of compromise, timeline anomalies, and root-cause analysis.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveFindings}
                            disabled={savingFindings}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingFindings ? "Saving..." : "Save Findings"}
                        </button>
                    </div>

                    <textarea
                        rows={12}
                        value={findingsSummary}
                        onChange={(e) => setFindingsSummary(e.target.value)}
                        placeholder="Document technical findings, forensic artifacts, network indicators (IOCs), malware behavior, and preliminary remediation requirements..."
                        className="w-full font-mono text-xs text-slate-200 rounded-lg border border-slate-800 bg-slate-950 p-4 leading-relaxed focus:border-emerald-500 focus:outline-none"
                    />

                    {/* Connected Findings Section */}
                    <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <FileWarning className="w-4 h-4 text-amber-500" />
                                Formally Identified Findings ({connectedFindings.length})
                            </h3>
                            <button
                                onClick={() => setShowFindingModal(true)}
                                className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                            >
                                + New Finding
                            </button>
                        </div>

                        {connectedFindings.length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-4 bg-slate-950/40 border border-slate-800/60 rounded-lg">
                                No formal findings created from this investigation yet. Use the button above to escalate forensic observations into tracked findings.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2.5">
                                {connectedFindings.map((f) => (
                                    <div
                                        key={f.id}
                                        className="p-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-between gap-3 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/findings/${f.id}`}
                                                    className="font-mono text-xs font-bold text-amber-400 hover:underline"
                                                >
                                                    {f.business_id}
                                                </Link>
                                                <span className="text-xs text-slate-200 font-medium">{f.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                <span>Severity: <strong className="text-slate-300">{f.severity}</strong></span>
                                                <span>•</span>
                                                <span>Status: <strong className="text-slate-300">{f.status}</strong></span>
                                                {f.remediation_required && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-purple-400 font-semibold">Remediation Req</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <Link
                                            href={`/findings/${f.id}`}
                                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-xs border border-slate-800 flex items-center gap-1 shrink-0"
                                        >
                                            View <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Timeline */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <History className="h-4 w-4 text-emerald-400" />
                            Investigation Timeline
                        </h3>
                        <div className="relative border-l border-slate-800 ml-2 space-y-4">
                            {timeline.length === 0 ? (
                                <div className="text-xs text-slate-500 italic pl-4">No events logged yet.</div>
                            ) : (
                                timeline.map((item) => (
                                    <div key={item.id} className="relative pl-5">
                                        <div className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                                        <div className="text-xs font-medium text-white">{item.title}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {new Date(item.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Evidence Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <Upload className="h-5 w-5 text-emerald-400" />
                            Attach Evidence to Investigation
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Upload evidence artifacts. Checksum is computed on ingest and stored in PostgreSQL.
                        </p>
                        <form onSubmit={handleUploadEvidence} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Evidence Label *</label>
                                <input
                                    type="text"
                                    required
                                    value={evdTitle}
                                    onChange={(e) => setEvdTitle(e.target.value)}
                                    placeholder="e.g. Memory dump extraction log"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Evidence Type</label>
                                <select
                                    value={evdType}
                                    onChange={(e) => setEvdType(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="LOG">Log File</option>
                                    <option value="SCREENSHOT">Screenshot</option>
                                    <option value="DOCUMENT">Document</option>
                                    <option value="CONFIGURATION">Configuration</option>
                                    <option value="INVESTIGATION_ARTIFACT">Artifact</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">File</label>
                                <input
                                    type="file"
                                    onChange={(e) => setEvdFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {uploading ? "Uploading..." : "Save Evidence"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Finding Modal */}
            {showFindingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <FileWarning className="w-5 h-5 text-amber-500" />
                                Identify Finding from Investigation
                            </h2>
                            <button
                                onClick={() => setShowFindingModal(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm"
                            >
                                Cancel
                            </button>
                        </div>

                        <form onSubmit={handleCreateFinding} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Finding Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Unauthorized persistence mechanism in registry"
                                    value={fndTitle}
                                    onChange={(e) => setFndTitle(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Technical Observation / Details
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Detailed description of the discovered issue..."
                                    value={fndDesc}
                                    onChange={(e) => setFndDesc(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
                                    <select
                                        value={fndSeverity}
                                        onChange={(e) => setFndSeverity(e.target.value as FindingSeverity)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="CRITICAL">CRITICAL</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={fndPriority}
                                        onChange={(e) => setFndPriority(e.target.value as FindingPriority)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="URGENT">URGENT</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowFindingModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingFinding}
                                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                                >
                                    {creatingFinding ? "Saving..." : "Create Finding"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
