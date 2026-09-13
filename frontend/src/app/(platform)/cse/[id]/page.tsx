"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { secopsApi, CSE, Investigation, TimelineEvent } from "@/lib/api/secops";
import { findingsApi, Finding, FindingSeverity, FindingPriority } from "@/lib/api/findings";
import {
    ArrowLeft,
    Building2,
    User as UserIcon,
    Clock,
    Plus,
    Upload,
    TrendingUp,
    FileSearch,
    Paperclip,
    History,
    AlertCircle,
    ExternalLink,
    UserCheck,
    FileWarning,
    ChevronRight,
    ShieldAlert
} from "lucide-react";
import { EscalateModal } from "@/components/supervision/EscalateModal";
import ActivityTimeline from "@/components/common/ActivityTimeline";

export default function CSEDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [cse, setCse] = useState<CSE | null>(null);
    const [investigations, setInvestigations] = useState<Investigation[]>([]);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [connectedFindings, setConnectedFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<"overview" | "investigations" | "evidence" | "timeline" | "findings">("overview");

    // Modal states
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [showFindingModal, setShowFindingModal] = useState(false);
    const [fndTitle, setFndTitle] = useState("");
    const [fndDesc, setFndDesc] = useState("");
    const [fndSeverity, setFndSeverity] = useState<FindingSeverity>("HIGH");
    const [fndPriority, setFndPriority] = useState<FindingPriority>("HIGH");
    const [creatingFinding, setCreatingFinding] = useState(false);
    const [showLaunchInvModal, setShowLaunchInvModal] = useState(false);
    const [showUploadEvidenceModal, setShowUploadEvidenceModal] = useState(false);

    // Form inputs
    const [assignUserId, setAssignUserId] = useState("");
    const [assignNotes, setAssignNotes] = useState("");
    const [escalateReason, setEscalateReason] = useState("");
    const [escalateSeverity, setEscalateSeverity] = useState("HIGH");
    const [invTitle, setInvTitle] = useState("");
    const [invDesc, setInvDesc] = useState("");
    
    // Evidence inputs
    const [evdTitle, setEvdTitle] = useState("");
    const [evdDesc, setEvdDesc] = useState("");
    const [evdType, setEvdType] = useState("LOG");
    const [evdSource, setEvdSource] = useState("");
    const [evdFile, setEvdFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const cseData = await secopsApi.getCSE(resolvedParams.id);
            setCse(cseData);

            const [invData, timelineData, fndData] = await Promise.all([
                secopsApi.listInvestigations({ cse_id: resolvedParams.id, limit: 50 }),
                secopsApi.getCSETimeline(resolvedParams.id),
                findingsApi.getFindings({ source_type: "CSE" }).catch(() => ({ items: [] }))
            ]);
            setInvestigations(invData.items);
            setTimeline(timelineData);
            setConnectedFindings(fndData.items.filter((f) => f.cse_id === resolvedParams.id));
        } catch (err: any) {
            setError(err.message || "Failed to load incident workspace");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cse) return;
        setCreatingFinding(true);
        try {
            await findingsApi.createFinding({
                title: fndTitle,
                description: fndDesc,
                severity: fndSeverity,
                priority: fndPriority,
                classification: "Security",
                source_type: "CSE",
                cse_id: cse.id
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

    useEffect(() => {
        loadData();
    }, [resolvedParams.id]);

    const handleTransition = async (toStatus: string) => {
        const reason = prompt(`Enter justification notes for transition to '${toStatus}':`);
        if (reason === null) return;
        try {
            const updated = await secopsApi.transitionCSE(resolvedParams.id, {
                to_status: toStatus,
                reason: reason || undefined
            });
            setCse(updated);
            loadData();
        } catch (err: any) {
            alert(err.message || "Error transitioning CSE");
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const updated = await secopsApi.assignCSE(resolvedParams.id, {
                assigned_to_id: assignUserId,
                notes: assignNotes
            });
            setCse(updated);
            setShowAssignModal(false);
            setAssignNotes("");
            loadData();
        } catch (err: any) {
            alert(err.message || "Error assigning lead");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEscalate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await secopsApi.escalateCSE(resolvedParams.id, {
                reason: escalateReason,
                severity: escalateSeverity
            });
            setShowEscalateModal(false);
            setEscalateReason("");
            alert("CSE escalated successfully. Supervisory alerts dispatched.");
            loadData();
        } catch (err: any) {
            alert(err.message || "Error escalating CSE");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLaunchInvestigation = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await secopsApi.createInvestigation({
                cse_id: resolvedParams.id,
                title: invTitle,
                description: invDesc
            });
            setShowLaunchInvModal(false);
            setInvTitle("");
            setInvDesc("");
            loadData();
        } catch (err: any) {
            alert(err.message || "Error creating investigation");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUploadEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("title", evdTitle);
            if (evdDesc) fd.append("description", evdDesc);
            fd.append("evidence_type", evdType);
            if (evdSource) fd.append("source", evdSource);
            fd.append("cse_id", resolvedParams.id);
            if (evdFile) fd.append("file", evdFile);

            await secopsApi.uploadEvidence(fd);
            setShowUploadEvidenceModal(false);
            setEvdTitle("");
            setEvdDesc("");
            setEvdFile(null);
            loadData();
        } catch (err: any) {
            alert(err.message || "Error uploading evidence");
        } finally {
            setSubmitting(false);
        }
    };

    // Allowed transition mapping
    const getNextAllowedTransitions = (status: string): string[] => {
        switch (status.toUpperCase()) {
            case "NEW":
                return ["TRIAGED", "INVESTIGATING", "CLOSED"];
            case "TRIAGED":
                return ["INVESTIGATING", "ESCALATED", "CLOSED"];
            case "INVESTIGATING":
                return ["ESCALATED", "FINDING_IDENTIFIED", "UNDER_REVIEW", "RESOLVED", "CLOSED"];
            case "ESCALATED":
                return ["INVESTIGATING", "UNDER_REVIEW", "RESOLVED"];
            case "FINDING_IDENTIFIED":
                return ["REMEDIATION_REQUIRED", "UNDER_REVIEW", "RESOLVED"];
            case "REMEDIATION_REQUIRED":
                return ["UNDER_REVIEW", "RESOLVED"];
            case "UNDER_REVIEW":
                return ["RESOLVED", "INVESTIGATING"];
            case "RESOLVED":
                return ["CLOSED", "INVESTIGATING"];
            case "CLOSED":
                return ["INVESTIGATING"];
            default:
                return [];
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Loading CSE workspace...</span>
                </div>
            </div>
        );
    }

    if (error || !cse) {
        return (
            <div className="space-y-4">
                <Link href="/cse" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to CSE Directory
                </Link>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-400">
                    <AlertCircle className="h-6 w-6 mb-2" />
                    <h2 className="text-base font-bold">Failed to load CSE</h2>
                    <p className="text-xs text-rose-300 mt-1">{error || "Record not found or outside authorized scope."}</p>
                </div>
            </div>
        );
    }

    const nextStates = getNextAllowedTransitions(cse.status);

    return (
        <div className="space-y-6">
            {/* Top Back Link */}
            <div className="flex items-center justify-between">
                <Link href="/cse" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to CSE Directory
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFindingModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors"
                    >
                        <FileWarning className="h-4 w-4" />
                        Create Finding
                    </button>
                    <button
                        onClick={() => setShowEscalateModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                        <TrendingUp className="h-4 w-4" />
                        Escalate CSE
                    </button>
                    <button
                        onClick={() => setShowLaunchInvModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Launch Investigation
                    </button>
                </div>
            </div>

            {/* Header Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-base font-bold text-emerald-400">
                                {cse.business_id}
                            </span>
                            <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-200 border border-slate-700">
                                {cse.status}
                            </span>
                            <span className="rounded bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                                {cse.severity}
                            </span>
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-mono font-bold text-amber-400 border border-amber-500/30">
                                {cse.priority}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            {cse.title}
                        </h1>
                    </div>

                    {/* Transition Control Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-500 px-2 font-medium">Transitions:</span>
                        {nextStates.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic">No available transitions</span>
                        ) : (
                            nextStates.map((st) => (
                                <button
                                    key={st}
                                    onClick={() => handleTransition(st)}
                                    className="rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-colors"
                                >
                                    → {st.replace(/_/g, " ")}
                                </button>
                            ))
                        )}
                        <button
                            onClick={() => setShowEscalateModal(true)}
                            className="rounded bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-colors flex items-center gap-1 ml-1"
                        >
                            <ShieldAlert className="w-3 h-3" /> Escalate to Supervision
                        </button>
                    </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 pt-4 text-xs">
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Supervised Entity</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            {cse.organization_name || "Enterprise Wide"}
                        </div>
                        {cse.sector_name && (
                            <div className="text-[10px] text-slate-500 pl-5">{cse.sector_name}</div>
                        )}
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Assigned Lead Analyst</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                            {cse.assigned_to_name || "Unassigned"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Originating Alert</div>
                        <div className="text-slate-300 font-medium">
                            {cse.originating_alert_id ? (
                                <Link href={`/alerts/${cse.originating_alert_id}`} className="text-emerald-400 hover:underline flex items-center gap-1">
                                    {cse.originating_alert_business_id || "View Alert"}
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            ) : (
                                <span className="text-slate-500">Standalone CSE</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-[11px] mb-0.5">Created Timestamp</div>
                        <div className="text-slate-300 font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {new Date(cse.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`pb-3 transition-colors ${
                        activeTab === "overview"
                            ? "border-b-2 border-emerald-400 text-emerald-400"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Overview & Analysis
                </button>
                <button
                    onClick={() => setActiveTab("investigations")}
                    className={`pb-3 flex items-center gap-1.5 transition-colors ${
                        activeTab === "investigations"
                            ? "border-b-2 border-emerald-400 text-emerald-400"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <FileSearch className="h-3.5 w-3.5" />
                    Investigations ({investigations.length})
                </button>
                <button
                    onClick={() => setActiveTab("evidence")}
                    className={`pb-3 flex items-center gap-1.5 transition-colors ${
                        activeTab === "evidence"
                            ? "border-b-2 border-emerald-400 text-emerald-400"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <Paperclip className="h-3.5 w-3.5" />
                    Evidence Locker
                </button>
                <button
                    onClick={() => setActiveTab("timeline")}
                    className={`pb-3 flex items-center gap-1.5 transition-colors ${
                        activeTab === "timeline"
                            ? "border-b-2 border-emerald-400 text-emerald-400"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <History className="h-3.5 w-3.5" />
                    Audit Timeline
                </button>
                <button
                    onClick={() => setActiveTab("findings")}
                    className={`pb-3 flex items-center gap-1.5 transition-colors ${
                        activeTab === "findings"
                            ? "border-b-2 border-amber-400 text-amber-400 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <FileWarning className="h-3.5 w-3.5 text-amber-500" />
                    Findings ({connectedFindings.length})
                </button>
            </div>

            {/* Tab 1: Overview */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                            <h2 className="text-sm font-bold text-white mb-2">Detailed Narrative & Context</h2>
                            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                                {cse.description || "No extensive description entered for this event."}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Incident Lead Ownership
                            </h3>
                            <div className="text-xs">
                                <span className="text-slate-500 block text-[11px]">Primary Assignee</span>
                                <span className="text-white font-medium">{cse.assigned_to_name || "Unassigned"}</span>
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={() => setShowAssignModal(true)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                                >
                                    Reassign Lead Analyst
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Investigations */}
            {activeTab === "investigations" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white">Attached Investigations</h2>
                        <button
                            onClick={() => setShowLaunchInvModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                            <Plus className="h-4 w-4" /> Launch Investigation
                        </button>
                    </div>

                    {investigations.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-500">
                            No investigations launched yet for this CSE.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {investigations.map((inv) => (
                                <div key={inv.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 hover:border-slate-700 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-mono text-xs text-emerald-400 font-semibold">{inv.business_id}</span>
                                            <h3 className="text-sm font-bold text-white mt-1">{inv.title}</h3>
                                        </div>
                                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                                            {inv.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2">
                                        {inv.description || "No description provided."}
                                    </p>
                                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                                        <span>Lead: {inv.lead_analyst_name || "Unassigned"}</span>
                                        <Link href={`/investigations/${inv.id}`} className="text-emerald-400 font-semibold hover:underline flex items-center gap-1">
                                            Open Console →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Evidence Locker */}
            {activeTab === "evidence" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white">Forensic Evidence & Supporting Artifacts</h2>
                        <button
                            onClick={() => setShowUploadEvidenceModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                            <Upload className="h-4 w-4" /> Upload Evidence
                        </button>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
                        <p className="mb-2">Evidence records attached directly to this CSE or linked investigations.</p>
                        <p className="text-slate-500 text-[11px]">
                            SHA-256 integrity checksums are strictly computed on ingest to satisfy evidentiary custody requirements.
                        </p>
                    </div>
                </div>
            )}

            {/* Tab 4: Activity Timeline */}
            {activeTab === "timeline" && (
                <div className="space-y-6">
                    <ActivityTimeline resourceType="CSE" resourceId={cse.id} />
                </div>
            )}

            {/* Findings Tab Panel */}
            {activeTab === "findings" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <FileWarning className="w-4 h-4 text-amber-500" />
                                Confirmed & Tracked Findings ({connectedFindings.length})
                            </h3>
                            <p className="text-xs text-slate-400">
                                Findings originating from this cyber security event or its downstream investigations.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowFindingModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors"
                        >
                            <FileWarning className="h-4 w-4" /> Create Finding
                        </button>
                    </div>

                    {connectedFindings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                            No findings linked to this CSE yet. Identify weaknesses or policy violations using the button above.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {connectedFindings.map((f) => (
                                <div
                                    key={f.id}
                                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <Link
                                            href={`/findings/${f.id}`}
                                            className="font-mono text-xs font-bold text-amber-400 hover:underline"
                                        >
                                            {f.business_id}
                                        </Link>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                            {f.status}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-white line-clamp-1">{f.title}</h4>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                                        <span>Severity: <strong className="text-slate-200">{f.severity}</strong></span>
                                        <span>•</span>
                                        <span>Priority: <strong className="text-slate-200">{f.priority}</strong></span>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <Link
                                            href={`/findings/${f.id}`}
                                            className="text-xs text-amber-400 hover:underline flex items-center gap-0.5"
                                        >
                                            View Finding Workspace <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Escalate Modal */}
            {showEscalateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-rose-400" />
                            Escalate Incident to Supervisory Authority
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Raise formal escalation for cross-entity impact assessment or critical supervisory directive.
                        </p>
                        <form onSubmit={handleEscalate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Escalation Justification *</label>
                                <textarea
                                    rows={3}
                                    required
                                    value={escalateReason}
                                    onChange={(e) => setEscalateReason(e.target.value)}
                                    placeholder="State regulatory breach risk, critical infrastructure exposure, or required directive..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Urgency Severity</label>
                                <select
                                    value={escalateSeverity}
                                    onChange={(e) => setEscalateSeverity(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-rose-500 focus:outline-none"
                                >
                                    <option value="CRITICAL">Critical - Immediate Threat</option>
                                    <option value="HIGH">High - Systemic Exposure</option>
                                    <option value="MEDIUM">Medium - Supervisory Inquiry</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEscalateModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                                >
                                    {submitting ? "Dispatching..." : "Confirm Escalation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Launch Investigation Modal */}
            {showLaunchInvModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-emerald-400" />
                            Launch Security Investigation
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Instantiate a technical investigation track linked directly to this CSE.
                        </p>
                        <form onSubmit={handleLaunchInvestigation} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Investigation Scope / Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={invTitle}
                                    onChange={(e) => setInvTitle(e.target.value)}
                                    placeholder="e.g. Memory forensics & C2 infrastructure mapping"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Investigation Objectives</label>
                                <textarea
                                    rows={3}
                                    value={invDesc}
                                    onChange={(e) => setInvDesc(e.target.value)}
                                    placeholder="Key questions to answer, targeted endpoints, or data capture protocol..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowLaunchInvModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {submitting ? "Launching..." : "Launch Investigation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload Evidence Modal */}
            {showUploadEvidenceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <Upload className="h-5 w-5 text-emerald-400" />
                            Upload Forensic Evidence Artifact
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Attach logs, captures, or artifacts. Cryptographic SHA-256 hash will be computed automatically.
                        </p>
                        <form onSubmit={handleUploadEvidence} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Artifact Label *</label>
                                <input
                                    type="text"
                                    required
                                    value={evdTitle}
                                    onChange={(e) => setEvdTitle(e.target.value)}
                                    placeholder="e.g. Perimeter firewall flow capture session"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
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
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Source Sensor</label>
                                    <input
                                        type="text"
                                        value={evdSource}
                                        onChange={(e) => setEvdSource(e.target.value)}
                                        placeholder="Palo Alto, Zeek..."
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Evidence File</label>
                                <input
                                    type="file"
                                    onChange={(e) => setEvdFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadEvidenceModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {submitting ? "Uploading..." : "Save Evidence"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Lead Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-emerald-400" />
                            Assign Incident Lead Analyst
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Delegate primary technical responsibility for this incident.
                        </p>
                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Analyst User ID *</label>
                                <input
                                    type="text"
                                    required
                                    value={assignUserId}
                                    onChange={(e) => setAssignUserId(e.target.value)}
                                    placeholder="Enter target User UUID or ID"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Handover Instructions / Notes</label>
                                <textarea
                                    rows={3}
                                    value={assignNotes}
                                    onChange={(e) => setAssignNotes(e.target.value)}
                                    placeholder="Priorities, required containment steps, or SLA deadline..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {submitting ? "Assigning..." : "Assign Analyst"}
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
                                Identify Finding from Incident
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
                                    placeholder="e.g. Inadequate egress firewall filtering on gateway"
                                    value={fndTitle}
                                    onChange={(e) => setFndTitle(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Technical Details & Description
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Observed security weakness or policy deviation..."
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

            {cse && (
                <EscalateModal
                    isOpen={showEscalateModal}
                    onClose={() => setShowEscalateModal(false)}
                    resourceType="CSE"
                    resourceId={cse.id}
                    resourceBusinessId={cse.business_id}
                    resourceTitle={cse.title}
                    onSuccess={() => loadData()}
                />
            )}
        </div>
    );
}
