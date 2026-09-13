"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    findingsApi,
    Finding,
    FindingTimelineEvent,
    FindingStatus,
    FindingCommentType,
} from "@/lib/api/findings";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    FileWarning,
    Building2,
    User as UserIcon,
    ArrowLeft,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Shield,
    MessageSquare,
    History,
    Paperclip,
    Send,
    ChevronRight,
    ExternalLink,
    Wrench,
    AlertCircle,
    RefreshCw,
    UserCheck,
    ShieldAlert,
} from "lucide-react";
import { EscalateModal } from "@/components/supervision/EscalateModal";
import ActivityTimeline from "@/components/common/ActivityTimeline";

export default function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { user } = useAuth();

    const [finding, setFinding] = useState<Finding | null>(null);
    const [timeline, setTimeline] = useState<FindingTimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "comments" | "timeline">("overview");

    // Modal state for workflow transitions
    const [transitionModal, setTransitionModal] = useState<{
        open: boolean;
        targetState: FindingStatus;
        title: string;
        requireNotes: boolean;
        isRemediation?: boolean;
    }>({
        open: false,
        targetState: "REVIEW",
        title: "",
        requireNotes: false,
    });
    const [transitionNotes, setTransitionNotes] = useState("");

    // Modal state for assignment
    const [assignModal, setAssignModal] = useState(false);
    const [assignUserId, setAssignUserId] = useState("");
    const [assignDueDate, setAssignDueDate] = useState("");
    const [assignNotes, setAssignNotes] = useState("");
    const [showEscalateModal, setShowEscalateModal] = useState(false);

    // Comment input state
    const [newComment, setNewComment] = useState("");
    const [newCommentType, setNewCommentType] = useState<FindingCommentType>("GENERAL_COMMENT");

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [fData, tData] = await Promise.all([
                findingsApi.getFinding(resolvedParams.id),
                findingsApi.getTimeline(resolvedParams.id),
            ]);
            setFinding(fData);
            setTimeline(tData);
        } catch (err: any) {
            setError(err.message || "Failed to load finding details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [resolvedParams.id]);

    // Permissions
    const canSubmit = hasPermission(user, Permissions.FINDING_SUBMIT) || hasPermission(user, Permissions.FINDING_CREATE);
    const canReview = hasPermission(user, Permissions.FINDING_REVIEW);
    const canApprove = hasPermission(user, Permissions.FINDING_APPROVE);
    const canClose = hasPermission(user, Permissions.FINDING_CLOSE);
    const canUpdate = hasPermission(user, Permissions.FINDING_UPDATE);
    const canCreateRisk = hasPermission(user, Permissions.RISK_CREATE);

    // Separation of Duties check for UI guidance (backend strictly validates this too)
    const isCreator = user && finding && user.id === finding.created_by_id;

    const handleTransitionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await findingsApi.transitionFinding(resolvedParams.id, {
                target_state: transitionModal.targetState,
                review_notes: transitionNotes || undefined,
                remediation_required: transitionModal.isRemediation || undefined,
            });
            setTransitionModal({ ...transitionModal, open: false });
            setTransitionNotes("");
            await loadData();
        } catch (err: any) {
            window.alert(err.message || "Error executing transition");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await findingsApi.assignFinding(resolvedParams.id, {
                assigned_to_id: assignUserId || (user?.id ?? ""),
                due_date: assignDueDate ? new Date(assignDueDate).toISOString() : undefined,
                notes: assignNotes || undefined,
            });
            setAssignModal(false);
            setAssignNotes("");
            await loadData();
        } catch (err: any) {
            window.alert(err.message || "Error assigning finding");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setSubmitting(true);
        try {
            await findingsApi.addComment(resolvedParams.id, {
                comment: newComment.trim(),
                comment_type: newCommentType,
            });
            setNewComment("");
            await loadData();
        } catch (err: any) {
            window.alert(err.message || "Error adding note");
        } finally {
            setSubmitting(false);
        }
    };

    const getSeverityBadge = (sev: string) => {
        switch (sev.toUpperCase()) {
            case "CRITICAL":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            case "HIGH":
                return "bg-orange-500/15 text-orange-400 border-orange-500/30";
            case "MEDIUM":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "LOW":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            default:
                return "bg-slate-500/15 text-slate-400 border-slate-500/30";
        }
    };

    const getPriorityBadge = (prio: string) => {
        switch (prio.toUpperCase()) {
            case "URGENT":
                return "text-rose-400 bg-rose-950/50 border-rose-800/60";
            case "HIGH":
                return "text-orange-400 bg-orange-950/50 border-orange-800/60";
            case "MEDIUM":
                return "text-amber-400 bg-amber-950/50 border-amber-800/60";
            default:
                return "text-slate-400 bg-slate-900 border-slate-700";
        }
    };

    const getStatusBadge = (st: string) => {
        switch (st.toUpperCase()) {
            case "CONFIRMED":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
            case "REMEDIATION_REQUIRED":
                return "bg-purple-500/15 text-purple-400 border-purple-500/40";
            case "REVIEW":
                return "bg-blue-500/15 text-blue-400 border-blue-500/40";
            case "SUBMITTED":
                return "bg-cyan-500/15 text-cyan-400 border-cyan-500/40";
            case "IDENTIFIED":
            case "DRAFT":
                return "bg-amber-500/15 text-amber-400 border-amber-500/40";
            case "CLOSED":
                return "bg-slate-800 text-slate-400 border-slate-700";
            case "REJECTED":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            default:
                return "bg-slate-800 text-slate-300 border-slate-700";
        }
    };

    // Lifecycle steps for stepper
    const lifecycleSteps: { label: string; key: FindingStatus }[] = [
        { label: "Identified", key: "IDENTIFIED" },
        { label: "Submitted", key: "SUBMITTED" },
        { label: "Review", key: "REVIEW" },
        { label: "Confirmed", key: "CONFIRMED" },
        { label: "Remediation Required", key: "REMEDIATION_REQUIRED" },
        { label: "Closed", key: "CLOSED" },
    ];

    const getStepIndex = (st: string) => {
        switch (st.toUpperCase()) {
            case "IDENTIFIED":
            case "DRAFT":
                return 0;
            case "SUBMITTED":
                return 1;
            case "REVIEW":
                return 2;
            case "CONFIRMED":
                return 3;
            case "REMEDIATION_REQUIRED":
            case "REMEDIATION":
            case "VALIDATION":
                return 4;
            case "CLOSED":
                return 5;
            default:
                return 0;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                <p>Loading finding workspace...</p>
            </div>
        );
    }

    if (error || !finding) {
        return (
            <div className="space-y-4">
                <Link
                    href="/findings"
                    className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Findings Directory
                </Link>
                <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <div>
                        <h3 className="font-semibold">Access Error</h3>
                        <p className="text-sm text-rose-300">{error || "Finding not found."}</p>
                    </div>
                </div>
            </div>
        );
    }

    const currentStepIndex = getStepIndex(finding.status);

    return (
        <div className="space-y-6">
            {/* Top breadcrumb navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href="/findings"
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Findings
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs"
                        title="Reload"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Header Workspace */}
            <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-base font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                                {finding.business_id}
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${getSeverityBadge(finding.severity)}`}>
                                {finding.severity} SEVERITY
                            </span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${getPriorityBadge(finding.priority)}`}>
                                {finding.priority} PRIORITY
                            </span>
                            <span className={`text-xs font-semibold px-3 py-0.5 rounded-full border ${getStatusBadge(finding.status)}`}>
                                {finding.status.replace("_", " ")}
                            </span>
                            {finding.remediation_required && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    REMEDIATION MANDATED
                                </span>
                            )}
                            {finding.is_overdue && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3.5 h-3.5" /> OVERDUE
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                            {finding.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                            <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-200">{finding.organization_name || "Enterprise"}</span>
                                <span className="text-slate-500">({finding.sector_name || "Cross-Sector"})</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>Owner: <span className="text-slate-200 font-medium">{finding.assigned_to_name || "Unassigned"}</span></span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>
                                    Due:{" "}
                                    {finding.due_date ? (
                                        <span className={`font-semibold ${finding.is_overdue ? "text-rose-400" : "text-slate-200"}`}>
                                            {new Date(finding.due_date).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        "None"
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Submit for Review */}
                        {(finding.status === "IDENTIFIED" || finding.status === "DRAFT") && canSubmit && (
                            <button
                                onClick={() =>
                                    setTransitionModal({
                                        open: true,
                                        targetState: "SUBMITTED",
                                        title: "Submit Finding for Formal Review",
                                        requireNotes: false,
                                    })
                                }
                                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" /> Submit for Review
                            </button>
                        )}

                        {/* 2. Start Review */}
                        {finding.status === "SUBMITTED" && canReview && (
                            <button
                                onClick={() =>
                                    setTransitionModal({
                                        open: true,
                                        targetState: "REVIEW",
                                        title: "Commence Independent Review",
                                        requireNotes: false,
                                    })
                                }
                                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                                <Shield className="w-3.5 h-3.5" /> Start Review
                            </button>
                        )}

                        {/* 3. Reviewer decisions (Confirm, Request Changes, Reject) */}
                        {finding.status === "REVIEW" && (
                            <>
                                {canApprove && !isCreator && (
                                    <button
                                        onClick={() =>
                                            setTransitionModal({
                                                open: true,
                                                targetState: "CONFIRMED",
                                                title: "Confirm Finding as Valid Security Weakness",
                                                requireNotes: true,
                                            })
                                        }
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Finding
                                    </button>
                                )}

                                {isCreator && canApprove && (
                                    <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-xs flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Independent reviewer required (Separation of Duties)</span>
                                    </div>
                                )}

                                {canReview && (
                                    <button
                                        onClick={() =>
                                            setTransitionModal({
                                                open: true,
                                                targetState: "DRAFT",
                                                title: "Request Revisions / Changes",
                                                requireNotes: true,
                                            })
                                        }
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Request Changes
                                    </button>
                                )}

                                {canApprove && !isCreator && (
                                    <button
                                        onClick={() =>
                                            setTransitionModal({
                                                open: true,
                                                targetState: "REJECTED",
                                                title: "Reject Finding",
                                                requireNotes: true,
                                            })
                                        }
                                        className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Reject
                                    </button>
                                )}
                            </>
                        )}

                        {/* 4. Mark Remediation Required */}
                        {finding.status === "CONFIRMED" && !finding.remediation_required && canApprove && (
                            <button
                                onClick={() =>
                                    setTransitionModal({
                                        open: true,
                                        targetState: "REMEDIATION_REQUIRED",
                                        title: "Mandate Remediation Required",
                                        requireNotes: false,
                                        isRemediation: true,
                                    })
                                }
                                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                                <Wrench className="w-3.5 h-3.5" /> Mandate Remediation
                            </button>
                        )}

                        {/* Remediation Action Link */}
                        {finding.remediation_required && (
                            <Link
                                href={`/remediations?create=true&finding_id=${finding.id}&finding_business_id=${finding.business_id}&title=${encodeURIComponent(finding.title)}&priority=${finding.severity}`}
                                className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
                            >
                                <Wrench className="w-3.5 h-3.5" /> Create Remediation Plan
                            </Link>
                        )}


                        {/* 5. Close Finding */}
                        {(finding.status === "CONFIRMED" || finding.status === "REMEDIATION_REQUIRED") && canClose && (
                            <button
                                onClick={() =>
                                    setTransitionModal({
                                        open: true,
                                        targetState: "CLOSED",
                                        title: "Close Finding",
                                        requireNotes: false,
                                    })
                                }
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                            >
                                Close Finding
                            </button>
                        )}

                        {/* Assign / Due date */}
                        {canUpdate && (
                            <button
                                onClick={() => {
                                    setAssignUserId(finding.assigned_to_id || "");
                                    setAssignDueDate(finding.due_date ? finding.due_date.slice(0, 10) : "");
                                    setAssignModal(true);
                                }}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <UserCheck className="w-3.5 h-3.5" /> Assign / Due Date
                            </button>
                        )}

                        {/* Promote to Risk in Risk & GRC */}
                        {canCreateRisk && (
                            <Link
                                href={`/risks?create=true&finding_id=${finding.id}&finding_business_id=${encodeURIComponent(finding.business_id)}&title=${encodeURIComponent(finding.title)}&org_id=${finding.organization_id || ""}&sector_id=${finding.sector_id || ""}`}
                                className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <ShieldAlert className="w-3.5 h-3.5" /> Assess Risk
                            </Link>
                        )}

                        {/* Escalate to Supervision */}
                        <button
                            onClick={() => setShowEscalateModal(true)}
                            className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" /> Escalate to Supervision
                        </button>
                    </div>
                </div>

                {/* Workflow Stepper */}
                <div className="pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
                        {lifecycleSteps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex || finding.status === step.key;
                            const isCurrent = finding.status === step.key;

                            return (
                                <React.Fragment key={step.key}>
                                    <div className="flex flex-col items-center gap-1.5 relative">
                                        <div
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                isCurrent
                                                    ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20"
                                                    : isCompleted
                                                    ? "bg-emerald-500 text-slate-950"
                                                    : "bg-slate-800 text-slate-500 border border-slate-700"
                                            }`}
                                        >
                                            {isCompleted && !isCurrent ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <span
                                            className={`text-[11px] font-medium whitespace-nowrap ${
                                                isCurrent
                                                    ? "text-amber-400 font-bold"
                                                    : isCompleted
                                                    ? "text-slate-300"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {step.label}
                                        </span>
                                    </div>
                                    {idx < lifecycleSteps.length - 1 && (
                                        <div
                                            className={`flex-1 h-0.5 mx-2 transition-all ${
                                                idx < currentStepIndex ? "bg-emerald-500" : "bg-slate-800"
                                            }`}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 text-sm font-medium gap-6">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`pb-3 border-b-2 transition-colors ${
                        activeTab === "overview"
                            ? "border-amber-500 text-amber-400 font-semibold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Overview & Relationships
                </button>
                <button
                    onClick={() => setActiveTab("evidence")}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === "evidence"
                            ? "border-amber-500 text-amber-400 font-semibold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <Paperclip className="w-4 h-4" />
                    Evidence Locker ({finding.evidence.length})
                </button>
                <button
                    onClick={() => setActiveTab("comments")}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === "comments"
                            ? "border-amber-500 text-amber-400 font-semibold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Review Notes & Discussion ({finding.comments.length})
                </button>
                <button
                    onClick={() => setActiveTab("timeline")}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === "timeline"
                            ? "border-amber-500 text-amber-400 font-semibold"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <History className="w-4 h-4" />
                    Activity History
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Description & Technical Observations */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-3">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                                Description & Technical Observations
                            </h3>
                            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {finding.description || "No detailed description provided."}
                            </p>
                        </div>

                        {/* Connected Systems / Relationships */}
                        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                                Connected SAT-SA Systems
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Related CSE */}
                                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                                    <span className="text-xs font-medium text-slate-400 block mb-1">Related CSE</span>
                                    {finding.cse_id ? (
                                        <div>
                                            <Link
                                                href={`/cse/${finding.cse_id}`}
                                                className="text-sm font-mono text-sky-400 hover:underline font-semibold flex items-center gap-1"
                                            >
                                                {finding.cse_business_id || "View CSE"}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Link>
                                            <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">{finding.cse_title}</p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500 italic">No direct CSE linked</span>
                                    )}
                                </div>

                                {/* Related Investigation */}
                                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                                    <span className="text-xs font-medium text-slate-400 block mb-1">Related Investigation</span>
                                    {finding.investigation_id ? (
                                        <div>
                                            <Link
                                                href={`/investigations/${finding.investigation_id}`}
                                                className="text-sm font-mono text-sky-400 hover:underline font-semibold flex items-center gap-1"
                                            >
                                                {finding.investigation_business_id || "View Investigation"}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Link>
                                            <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                                                {finding.investigation_title}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500 italic">No direct investigation linked</span>
                                    )}
                                </div>

                                {/* Affected Control */}
                                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                                    <span className="text-xs font-medium text-slate-400 block mb-1">Affected Control</span>
                                    {finding.control_id ? (
                                        <div>
                                            <span className="text-sm font-mono text-amber-400 font-semibold block">
                                                {finding.control_business_id}
                                            </span>
                                            <p className="text-xs text-slate-300 mt-0.5">{finding.control_name}</p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500 italic">No specific control tagged</span>
                                    )}
                                </div>

                                {/* Remediation Task */}
                                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                                    <span className="text-xs font-medium text-slate-400 block mb-1">Remediation Status</span>
                                    {finding.remediation_required ? (
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
                                                <Wrench className="w-3.5 h-3.5" />
                                                <span>Remediation Mandated</span>
                                            </div>
                                            <Link
                                                href={`/remediations?create=true&finding_id=${finding.id}&finding_business_id=${finding.business_id}&title=${encodeURIComponent(finding.title)}&priority=${finding.severity}`}
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-500/50 px-2 py-0.5 rounded transition"
                                            >
                                                <span>Execute</span>
                                                <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500 italic">Remediation not mandated</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Metadata Panel */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                                Finding Governance
                            </h3>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-slate-500 block">Source Origin</span>
                                    <span className="text-slate-200 font-semibold">{finding.source_type}</span>
                                </div>

                                <div>
                                    <span className="text-slate-500 block">Classification</span>
                                    <span className="text-slate-200 font-medium">{finding.classification}</span>
                                </div>

                                <div>
                                    <span className="text-slate-500 block">Created By</span>
                                    <span className="text-slate-200">{finding.created_by_name || "System"}</span>
                                </div>

                                <div>
                                    <span className="text-slate-500 block">Created At</span>
                                    <span className="text-slate-200">{new Date(finding.created_at).toLocaleString()}</span>
                                </div>

                                <div>
                                    <span className="text-slate-500 block">Current Assignee</span>
                                    <span className="text-slate-200 font-semibold">{finding.assigned_to_name || "Unassigned"}</span>
                                </div>

                                <div>
                                    <span className="text-slate-500 block">Target Resolution Due Date</span>
                                    <span className={finding.is_overdue ? "text-rose-400 font-bold" : "text-slate-200"}>
                                        {finding.due_date ? new Date(finding.due_date).toLocaleDateString() : "None"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Evidence Locker Tab */}
            {activeTab === "evidence" && (
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-100">Attached Supporting Evidence</h3>
                            <p className="text-xs text-slate-400">
                                Cryptographically verified network captures, system logs, memory dumps, and artifacts.
                            </p>
                        </div>
                    </div>

                    {finding.evidence.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                            No evidence artifacts attached to this finding.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {finding.evidence.map((ev) => (
                                <div key={ev.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs text-amber-400 font-bold">{ev.business_id}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                            {ev.evidence_type}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-200">{ev.title}</h4>
                                    {ev.description && <p className="text-xs text-slate-400">{ev.description}</p>}
                                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between font-mono">
                                        <span>{ev.filename || "artifact.dat"}</span>
                                        <span>{ev.file_size ? `${(ev.file_size / 1024).toFixed(1)} KB` : ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Comments & Review Notes Tab */}
            {activeTab === "comments" && (
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-100">Review Notes & Discussion</h3>
                        <p className="text-xs text-slate-400">
                            Auditable review deliberations, change requests, and supervisory decision notes.
                        </p>
                    </div>

                    {/* New comment input */}
                    <form onSubmit={handleAddComment} className="space-y-3 bg-slate-950/50 p-4 border border-slate-800 rounded-xl">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-300">Add Entry</span>
                            <select
                                value={newCommentType}
                                onChange={(e) => setNewCommentType(e.target.value as FindingCommentType)}
                                className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                                <option value="GENERAL_COMMENT">General Comment</option>
                                <option value="REVIEW_NOTE">Review Note</option>
                                <option value="CHANGE_REQUEST">Change Request</option>
                                <option value="DECISION_NOTE">Decision Note</option>
                            </select>
                        </div>
                        <textarea
                            rows={3}
                            placeholder="Type observation, feedback, or review note..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting || !newComment.trim()}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                            >
                                <Send className="w-3 h-3" /> Post Note
                            </button>
                        </div>
                    </form>

                    {/* List of comments */}
                    <div className="space-y-3">
                        {finding.comments.length === 0 ? (
                            <p className="text-center text-xs text-slate-500 py-6">No discussion notes logged yet.</p>
                        ) : (
                            finding.comments.map((c) => (
                                <div key={c.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200">{c.author_name || "User"}</span>
                                            {c.author_role && (
                                                <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[10px]">
                                                    {c.author_role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase font-bold text-amber-400 px-1.5 py-0.2 bg-amber-500/10 border border-amber-500/20 rounded">
                                                {c.comment_type.replace("_", " ")}
                                            </span>
                                            <span className="text-slate-500 text-[11px]">
                                                {new Date(c.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.comment}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Timeline Tab */}
            {activeTab === "timeline" && (
                <div className="space-y-6">
                    <ActivityTimeline resourceType="FINDING" resourceId={finding.id} />
                </div>
            )}

            {/* Workflow Transition Modal */}
            {transitionModal.open && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="text-base font-bold text-slate-100">{transitionModal.title}</h3>

                        <form onSubmit={handleTransitionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Review Notes / Decision Rationale {transitionModal.requireNotes && "*"}
                                </label>
                                <textarea
                                    rows={3}
                                    required={transitionModal.requireNotes}
                                    placeholder="Enter deliberation details or required changes..."
                                    value={transitionNotes}
                                    onChange={(e) => setTransitionNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setTransitionModal({ ...transitionModal, open: false })}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded transition-colors disabled:opacity-50"
                                >
                                    {submitting ? "Processing..." : "Confirm Action"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assignment & Due Date Modal */}
            {assignModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <h3 className="text-base font-bold text-slate-100">Assign Finding & Target Due Date</h3>

                        <form onSubmit={handleAssignSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Target Resolution Due Date
                                </label>
                                <input
                                    type="date"
                                    value={assignDueDate}
                                    onChange={(e) => setAssignDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Assignment Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Add notes for assignee..."
                                    value={assignNotes}
                                    onChange={(e) => setAssignNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setAssignModal(false)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded transition-colors disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : "Save Assignment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {finding && (
                <EscalateModal
                    isOpen={showEscalateModal}
                    onClose={() => setShowEscalateModal(false)}
                    resourceType="FINDING"
                    resourceId={finding.id}
                    resourceBusinessId={finding.business_id}
                    resourceTitle={finding.title}
                    onSuccess={() => loadData()}
                />
            )}
        </div>
    );
}
