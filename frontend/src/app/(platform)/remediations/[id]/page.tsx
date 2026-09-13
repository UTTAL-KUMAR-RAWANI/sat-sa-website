"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    remediationsApi,
    RemediationDetail,
    RemediationPriority,
    RemediationStatus,
    RemediationEvidenceItem,
    RemediationTimelineEvent,
} from "@/lib/api/remediations";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import { EscalateModal } from "@/components/supervision/EscalateModal";
import ActivityTimeline from "@/components/common/ActivityTimeline";
import {
    Wrench,
    ArrowLeft,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    Ban,
    FileCheck,
    FileText,
    Upload,
    Users,
    User as UserIcon,
    Building2,
    Calendar,
    ChevronRight,
    AlertTriangle,
    RefreshCw,
    Play,
    Check,
    RotateCcw,
    Layers,
    Lock,
    ExternalLink,
    Tag,
} from "lucide-react";

export default function RemediationDetailPage() {
    const { id } = useParams() as { id: string };
    const { user } = useAuth();
    const router = useRouter();

    const [remediation, setRemediation] = useState<RemediationDetail | null>(null);
    const [timeline, setTimeline] = useState<RemediationTimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Modal states
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTeam, setAssignTeam] = useState("");
    const [assignDate, setAssignDate] = useState("");
    const [assignNotes, setAssignNotes] = useState("");

    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState("");

    const [showUnblockModal, setShowUnblockModal] = useState(false);
    const [unblockNotes, setUnblockNotes] = useState("");

    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitNotes, setSubmitNotes] = useState("");

    const [showEvidenceModal, setShowEvidenceModal] = useState(false);
    const [evTitle, setEvTitle] = useState("");
    const [evDesc, setEvDesc] = useState("");
    const [evType, setEvType] = useState("SCAN_REPORT");
    const [evUrl, setEvUrl] = useState("");

    const [showValidateModal, setShowValidateModal] = useState(false);
    const [validateDecision, setValidateDecision] = useState<"VERIFIED" | "RETURNED_FOR_CORRECTION">("VERIFIED");
    const [validateComments, setValidateComments] = useState("");

    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeNotes, setCloseNotes] = useState("");
    const [showEscalateModal, setShowEscalateModal] = useState(false);

    const [submittingAction, setSubmittingAction] = useState(false);

    // Permissions
    const canUpdate = hasPermission(user, Permissions.REMEDIATION_UPDATE);
    const canAssign = hasPermission(user, Permissions.REMEDIATION_ASSIGN);
    const canStart = hasPermission(user, Permissions.REMEDIATION_START);
    const canBlock = hasPermission(user, Permissions.REMEDIATION_BLOCK);
    const canSubmitEvidence = hasPermission(user, Permissions.REMEDIATION_SUBMIT_EVIDENCE);
    const canValidate = hasPermission(user, Permissions.REMEDIATION_VALIDATE);
    const canVerify = hasPermission(user, Permissions.REMEDIATION_VERIFY);
    const canClose = hasPermission(user, Permissions.REMEDIATION_CLOSE);
    const canUploadEvidence = hasPermission(user, Permissions.REMEDIATION_EVIDENCE_CREATE);
    const canReviewEvidence = hasPermission(user, Permissions.REMEDIATION_EVIDENCE_VERIFY);

    // Separation of Duties check:
    // Is current user the assigned owner of this remediation?
    const isOwner = Boolean(user?.id && remediation?.owner_id && user.id === remediation.owner_id);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await remediationsApi.getById(id);
            setRemediation(data);
            setAssignTeam(data.assigned_team || "");
            if (data.target_date) {
                setAssignDate(new Date(data.target_date).toISOString().slice(0, 10));
            }
        } catch (err: any) {
            setError(err.message || "Failed to load remediation record.");
        } finally {
            setLoading(false);
        }
    };

    const loadTimeline = async () => {
        setTimelineLoading(true);
        try {
            const events = await remediationsApi.getTimeline(id);
            setTimeline(events);
        } catch (err) {
            console.error("Failed to load timeline", err);
        } finally {
            setTimelineLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadData();
            loadTimeline();
        }
    }, [id]);

    const showToast = (type: "success" | "error", text: string) => {
        setActionMsg({ type, text });
        setTimeout(() => setActionMsg(null), 5000);
    };

    const handleStart = async () => {
        setSubmittingAction(true);
        try {
            await remediationsApi.start(id);
            showToast("success", "Remediation transitioned to IN_PROGRESS.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to start remediation.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingAction(true);
        try {
            await remediationsApi.assign(id, {
                assigned_team: assignTeam || undefined,
                target_date: assignDate ? new Date(assignDate).toISOString() : undefined,
                notes: assignNotes || undefined,
            });
            setShowAssignModal(false);
            showToast("success", "Remediation assignment updated.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to update assignment.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!blockReason.trim() || blockReason.trim().length < 5) {
            showToast("error", "A blocking reason of at least 5 characters is mandatory.");
            return;
        }

        setSubmittingAction(true);
        try {
            await remediationsApi.block(id, { blocked_reason: blockReason });
            setShowBlockModal(false);
            setBlockReason("");
            showToast("success", "Remediation status transitioned to BLOCKED.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to block remediation.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleUnblock = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingAction(true);
        try {
            await remediationsApi.unblock(id, { unblock_notes: unblockNotes || undefined });
            setShowUnblockModal(false);
            setUnblockNotes("");
            showToast("success", "Remediation unblocked and returned to IN_PROGRESS.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to unblock remediation.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleSubmitEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingAction(true);
        try {
            await remediationsApi.submitEvidence(id, { submission_notes: submitNotes || undefined });
            setShowSubmitModal(false);
            setSubmitNotes("");
            showToast("success", "Corrective action marked complete. Evidence submitted for validation.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to submit evidence.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleAddEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evTitle.trim()) {
            showToast("error", "Evidence title is required.");
            return;
        }

        setSubmittingAction(true);
        try {
            await remediationsApi.addEvidence(id, {
                title: evTitle,
                description: evDesc || undefined,
                evidence_type: evType,
                file_url: evUrl || undefined,
            });
            setShowEvidenceModal(false);
            setEvTitle("");
            setEvDesc("");
            setEvUrl("");
            showToast("success", "Evidence item attached to remediation checklist.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to attach evidence.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleEvidenceReview = async (evidenceId: string, status: string, comments: string) => {
        try {
            await remediationsApi.reviewEvidence(id, evidenceId, {
                verification_status: status,
                reviewer_comments: comments,
            });
            showToast("success", `Evidence status updated to ${status}.`);
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to review evidence.");
        }
    };

    const handleValidationDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validateDecision === "RETURNED_FOR_CORRECTION" && !validateComments.trim()) {
            showToast("error", "Validator review comments explaining deficiencies are required when returning for correction.");
            return;
        }

        setSubmittingAction(true);
        try {
            await remediationsApi.verify(id, {
                decision: validateDecision,
                reviewer_comments: validateComments || undefined,
            });
            setShowValidateModal(false);
            setValidateComments("");
            showToast(
                "success",
                validateDecision === "VERIFIED"
                    ? "Remediation verified and signed off successfully."
                    : "Remediation returned for correction to implementation owner."
            );
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Validation decision submission failed.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleClose = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingAction(true);
        try {
            await remediationsApi.close(id, { closure_notes: closeNotes || undefined });
            setShowCloseModal(false);
            setCloseNotes("");
            showToast("success", "Remediation officially closed in audit ledger.");
            loadData();
            loadTimeline();
        } catch (err: any) {
            showToast("error", err.message || "Failed to close remediation.");
        } finally {
            setSubmittingAction(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                <span className="text-sm">Loading remediation specifications and evidence dossier...</span>
            </div>
        );
    }

    if (error || !remediation) {
        return (
            <div className="min-h-screen bg-[#070b14] text-slate-100 p-8 flex flex-col items-center justify-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                <h2 className="text-xl font-bold text-white mb-2">Remediation Record Not Found</h2>
                <p className="text-sm text-slate-400 max-w-md text-center mb-6">
                    {error || "The requested remediation record does not exist or you lack sufficient scope permissions to view it."}
                </p>
                <Link
                    href="/remediations"
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 px-4 py-2 rounded-lg text-sm transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Remediations Ledger</span>
                </Link>
            </div>
        );
    }

    // Progression Step calculation
    const steps: { key: RemediationStatus; label: string }[] = [
        { key: "OPEN", label: "Open" },
        { key: "ASSIGNED", label: "Assigned" },
        { key: "IN_PROGRESS", label: "In Progress" },
        { key: "EVIDENCE_SUBMITTED", label: "Evidence Submitted" },
        { key: "VALIDATION", label: "Validation" },
        { key: "VERIFIED", label: "Verified" },
        { key: "CLOSED", label: "Closed" },
    ];

    const currentStepIdx =
        remediation.status === "BLOCKED"
            ? 2 // Maps alongside IN_PROGRESS
            : steps.findIndex((s) => s.key === remediation.status);

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 lg:p-8 space-y-6">
            {/* Top Navigation & Feedback Toast */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Link
                    href="/remediations"
                    className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Remediations Portfolio</span>
                </Link>

                {actionMsg && (
                    <div
                        className={`px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-lg transition animate-in fade-in slide-in-from-top-2 ${
                            actionMsg.type === "success"
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                    >
                        {actionMsg.type === "success" ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{actionMsg.text}</span>
                    </div>
                )}
            </div>

            {/* Header Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-3 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded">
                                {remediation.business_id}
                            </span>
                            <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                    remediation.priority === "CRITICAL"
                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                        : remediation.priority === "HIGH"
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                        : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                }`}
                            >
                                {remediation.priority} PRIORITY
                            </span>

                            <div
                                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${
                                    remediation.status === "BLOCKED"
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                        : remediation.status === "VERIFIED"
                                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                                        : remediation.status === "CLOSED"
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                        : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        remediation.status === "BLOCKED"
                                            ? "bg-rose-400 animate-ping"
                                            : remediation.status === "IN_PROGRESS"
                                            ? "bg-indigo-400 animate-pulse"
                                            : "bg-cyan-400"
                                    }`}
                                />
                                <span>{remediation.status.replace("_", " ")}</span>
                            </div>

                            {remediation.is_overdue && (
                                <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> SLA BREACHED
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-white tracking-tight">{remediation.title}</h1>

                        {remediation.description && (
                            <p className="text-sm text-slate-300 leading-relaxed">{remediation.description}</p>
                        )}
                    </div>

                    {/* Operational Action Controls Bar */}
                    <div className="flex flex-wrap items-center gap-2.5 lg:self-start">
                        {/* OPEN -> Assign */}
                        {remediation.status === "OPEN" && canAssign && (
                            <button
                                onClick={() => setShowAssignModal(true)}
                                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition"
                            >
                                <Users className="w-4 h-4" />
                                <span>Assign Owner & Team</span>
                            </button>
                        )}

                        {/* ASSIGNED -> Start */}
                        {remediation.status === "ASSIGNED" && canStart && (
                            <button
                                onClick={handleStart}
                                disabled={submittingAction}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                            >
                                <Play className="w-4 h-4" />
                                <span>Start Execution</span>
                            </button>
                        )}

                        {/* IN_PROGRESS -> Block or Submit Evidence */}
                        {remediation.status === "IN_PROGRESS" && (
                            <>
                                {canBlock && (
                                    <button
                                        onClick={() => setShowBlockModal(true)}
                                        className="bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 text-slate-300 px-3.5 py-2 rounded-lg text-sm flex items-center gap-1.5 transition"
                                    >
                                        <Ban className="w-4 h-4 text-rose-400" />
                                        <span>Block</span>
                                    </button>
                                )}

                                {canSubmitEvidence && (
                                    <button
                                        onClick={() => setShowSubmitModal(true)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition"
                                    >
                                        <FileCheck className="w-4 h-4" />
                                        <span>Submit for Validation</span>
                                    </button>
                                )}
                            </>
                        )}

                        {/* BLOCKED -> Unblock */}
                        {remediation.status === "BLOCKED" && canStart && (
                            <button
                                onClick={() => setShowUnblockModal(true)}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-amber-600/20 transition"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Resolve Blocker & Resume</span>
                            </button>
                        )}

                        {/* VALIDATION / EVIDENCE_SUBMITTED -> Decision Modal */}
                        {(remediation.status === "EVIDENCE_SUBMITTED" || remediation.status === "VALIDATION") &&
                            canVerify && (
                                <button
                                    onClick={() => setShowValidateModal(true)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-purple-600/20 transition"
                                >
                                    <FileCheck className="w-4 h-4" />
                                    <span>Validator Review & Decision</span>
                                </button>
                            )}

                        {/* VERIFIED -> Close */}
                        {remediation.status === "VERIFIED" && canClose && (
                            <button
                                onClick={() => setShowCloseModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Close Remediation</span>
                            </button>
                        )}

                        {/* Escalate to Supervision */}
                        <button
                            onClick={() => setShowEscalateModal(true)}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-amber-500/10 transition"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            <span>Escalate to Supervision</span>
                        </button>
                    </div>
                </div>

                {/* State Machine Visual Progression Stepper */}
                <div className="mt-8 pt-6 border-t border-slate-800">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                        <span>Workflow State Progression</span>
                        {remediation.status === "BLOCKED" && (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                                <Ban className="w-3 h-3" /> BLOCKED IN EXECUTION
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {steps.map((s, idx) => {
                            const isPast = currentStepIdx > idx;
                            const isCurrent = currentStepIdx === idx;
                            return (
                                <div
                                    key={s.key}
                                    className={`p-2.5 rounded-lg border text-center transition ${
                                        isCurrent
                                            ? remediation.status === "BLOCKED"
                                                ? "bg-rose-500/10 border-rose-500/50 text-rose-300"
                                                : "bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/20"
                                            : isPast
                                            ? "bg-slate-950/60 border-slate-800 text-emerald-400"
                                            : "bg-slate-950/20 border-slate-800/40 text-slate-600"
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        {isPast ? (
                                            <Check className="w-3 h-3 text-emerald-400" />
                                        ) : isCurrent ? (
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    remediation.status === "BLOCKED" ? "bg-rose-400 animate-ping" : "bg-cyan-400 animate-pulse"
                                                }`}
                                            />
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                        )}
                                    </div>
                                    <div className="text-[11px] font-semibold">{s.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Blocked State Notice Banner (If Blocked) */}
            {remediation.status === "BLOCKED" && (
                <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-5 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                                <Ban className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-rose-300 text-sm">Execution Blocked</h3>
                                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                                    {remediation.blocked_reason || "No detailed blocking reason recorded."}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-rose-400/80 font-mono mt-2.5">
                                    <span>Blocked By: {remediation.blocked_by_name || "Authorized Engineer"}</span>
                                    {remediation.blocked_at && (
                                        <span>Timestamp: {new Date(remediation.blocked_at).toLocaleString()}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {canStart && (
                            <button
                                onClick={() => setShowUnblockModal(true)}
                                className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs shrink-0 transition"
                            >
                                Resolve & Unblock
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Separation of Duties Notice (Validation State) */}
            {(remediation.status === "EVIDENCE_SUBMITTED" || remediation.status === "VALIDATION") && (
                <div
                    className={`rounded-xl p-5 border backdrop-blur-sm ${
                        isOwner
                            ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                            : "bg-purple-950/20 border-purple-500/30 text-purple-300"
                    }`}
                >
                    <div className="flex items-start gap-3.5">
                        <div
                            className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                                isOwner
                                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                    : "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                            }`}
                        >
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">
                                {isOwner
                                    ? "Separation of Duties (SoD) Enforced"
                                    : "Independent Validator Authority Required"}
                            </h3>
                            <p className="text-xs mt-1 leading-relaxed opacity-90">
                                {isOwner
                                    ? "You are assigned as the implementation owner for this remediation. To ensure supervisory integrity, platform regulations strictly prohibit remediation owners from verifying or signing off on their own corrective actions. Final validation must be completed by an independent Auditor Reviewer, CISO, or GRC Officer."
                                    : "This remediation has completed corrective actions and is awaiting independent validation. Verify the uploaded evidence checklist against the completion criteria before signing off or returning for correction."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2-Column Core Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2 Cols): Action Plan, Source Context, Evidence */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Section 2: Source Context Card */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Layers className="w-4 h-4 text-cyan-400" />
                                <span>Source Linkage & Context</span>
                            </h3>
                            <span className="text-xs text-slate-500 font-mono">Origin: {remediation.source}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Linked Finding */}
                            {remediation.finding_id ? (
                                <Link
                                    href={`/findings/${remediation.finding_id}`}
                                    className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 transition group"
                                >
                                    <div className="flex items-center justify-between text-xs text-blue-400 mb-1">
                                        <span className="font-mono">{remediation.finding_business_id || "Finding"}</span>
                                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                                    </div>
                                    <div className="text-xs font-medium text-slate-200 line-clamp-1">
                                        {remediation.finding_title || "Linked Finding Details"}
                                    </div>
                                </Link>
                            ) : (
                                <div className="p-3.5 rounded-lg bg-slate-950/30 border border-slate-800/40 text-slate-600 text-xs">
                                    No Finding Linked
                                </div>
                            )}

                            {/* Linked Risk */}
                            {remediation.risk_id ? (
                                <Link
                                    href={`/risks/${remediation.risk_id}`}
                                    className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition group"
                                >
                                    <div className="flex items-center justify-between text-xs text-purple-400 mb-1">
                                        <span className="font-mono">{remediation.risk_business_id || "Risk"}</span>
                                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                                    </div>
                                    <div className="text-xs font-medium text-slate-200 line-clamp-1">
                                        {remediation.risk_title || "Linked Risk Details"}
                                    </div>
                                </Link>
                            ) : (
                                <div className="p-3.5 rounded-lg bg-slate-950/30 border border-slate-800/40 text-slate-600 text-xs">
                                    No Risk Linked
                                </div>
                            )}

                            {/* Control */}
                            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 sm:col-span-2 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Security Control Reference</span>
                                    <span className="font-medium text-slate-200">
                                        {remediation.control_business_id ? `${remediation.control_business_id}: ${remediation.control_name}` : "No specific control attached"}
                                    </span>
                                </div>
                                <ShieldAlert className="w-4 h-4 text-cyan-400/80" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Action Plan & Technical Specification */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-cyan-400" />
                            <span>Action Plan & Technical Implementation Details</span>
                        </h3>

                        {/* Corrective Action */}
                        <div>
                            <label className="text-xs font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                                Corrective Action Specification
                            </label>
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {remediation.corrective_action || "No formal corrective action documented."}
                            </div>
                        </div>

                        {/* Root Cause & Expected Outcome */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                                    Root Cause Analysis
                                </label>
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 min-h-[70px]">
                                    {remediation.root_cause || "Not specified."}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                                    Expected Outcome
                                </label>
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 min-h-[70px]">
                                    {remediation.expected_outcome || "Not specified."}
                                </div>
                            </div>
                        </div>

                        {/* Implementation Steps */}
                        <div>
                            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                                Implementation Steps
                            </label>
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                {remediation.implementation_steps || "No sequenced steps defined."}
                            </div>
                        </div>

                        {/* Completion Criteria & Dependencies */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                                    Completion Criteria
                                </label>
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300">
                                    {remediation.completion_criteria || "Zero remaining deficiencies on re-test."}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                                    Operational Dependencies
                                </label>
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300">
                                    {remediation.dependencies || "None."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Evidence Checklist & Submissions */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <FileCheck className="w-4 h-4 text-cyan-400" />
                                    <span>Evidence Checklist & Verification Dossier</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Required verification artifacts for sign-off and auditor review.
                                </p>
                            </div>

                            {canUploadEvidence && (
                                <button
                                    onClick={() => setShowEvidenceModal(true)}
                                    className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:border-cyan-500/40 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Attach Evidence</span>
                                </button>
                            )}
                        </div>

                        {/* Required Evidence Requirements */}
                        {remediation.required_evidence_types && (
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                                    Required Types:
                                </span>
                                {remediation.required_evidence_types.split(",").map((type, idx) => {
                                    const trimmed = type.trim();
                                    const isMissing = remediation.missing_evidence_types?.includes(trimmed.toUpperCase());
                                    return (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 ${
                                                isMissing
                                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                            }`}
                                        >
                                            {isMissing ? (
                                                <AlertCircle className="w-2.5 h-2.5" />
                                            ) : (
                                                <Check className="w-2.5 h-2.5" />
                                            )}
                                            <span>{trimmed}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Evidence Items List */}
                        {remediation.evidence_items && remediation.evidence_items.length > 0 ? (
                            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
                                {remediation.evidence_items.map((ev) => (
                                    <div key={ev.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-cyan-400">
                                                    {ev.business_id}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-100">{ev.title}</span>
                                                <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                                    {ev.evidence_type}
                                                </span>
                                            </div>

                                            {ev.description && (
                                                <p className="text-xs text-slate-400">{ev.description}</p>
                                            )}

                                            <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                                                <span>Uploaded by: {ev.uploaded_by_name || "Engineer"}</span>
                                                <span>•</span>
                                                <span>{new Date(ev.created_at).toLocaleDateString()}</span>
                                                {ev.reviewer_comments && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-cyan-400">Review: {ev.reviewer_comments}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            <span
                                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                    ev.verification_status === "VERIFIED"
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                                        : ev.verification_status === "REJECTED"
                                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                                }`}
                                            >
                                                {ev.verification_status}
                                            </span>

                                            {canReviewEvidence && ev.verification_status === "PENDING" && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            handleEvidenceReview(ev.id, "VERIFIED", "Artifact verified compliant.")
                                                        }
                                                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs rounded transition"
                                                        title="Verify Evidence"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleEvidenceReview(ev.id, "REJECTED", "Insufficient detail.")
                                                        }
                                                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs rounded transition"
                                                        title="Reject Evidence"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 border border-dashed border-slate-800 rounded-lg text-center text-slate-500 text-xs">
                                No evidence files attached yet. Attach verification artifacts before requesting validator sign-off.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column (1 Col): Metadata, Assignments, Validation Decision, Timeline */}
                <div className="space-y-6">
                    {/* Metadata & Ownership Card */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-cyan-400" />
                            <span>Ownership & Assignments</span>
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Remediation Owner</span>
                                <span className="font-semibold text-slate-200">
                                    {remediation.owner_name || "Unassigned"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Assigned Team</span>
                                <span className="font-semibold text-slate-200">
                                    {remediation.assigned_team || "None"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Organization</span>
                                <span className="font-medium text-slate-300">
                                    {remediation.organization_name || "Platform Enterprise"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Sector</span>
                                <span className="font-medium text-slate-300">
                                    {remediation.sector_name || "National"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                <span className="text-slate-400">Target Date (SLA)</span>
                                <span className={remediation.is_overdue ? "text-rose-400 font-bold" : "text-slate-300"}>
                                    {remediation.target_date
                                        ? new Date(remediation.target_date).toLocaleDateString()
                                        : "Not set"}
                                </span>
                            </div>

                            {remediation.started_at && (
                                <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                    <span className="text-slate-400">Execution Started</span>
                                    <span className="text-slate-300">
                                        {new Date(remediation.started_at).toLocaleDateString()}
                                    </span>
                                </div>
                            )}

                            {remediation.verified_at && (
                                <div className="flex items-center justify-between py-1.5 border-b border-slate-800">
                                    <span className="text-slate-400">Validated By</span>
                                    <span className="text-teal-400 font-medium">
                                        {remediation.verified_by_name || "Authorized Validator"}
                                    </span>
                                </div>
                            )}

                            {remediation.closed_at && (
                                <div className="flex items-center justify-between py-1.5">
                                    <span className="text-slate-400">Closure Date</span>
                                    <span className="text-emerald-400 font-medium">
                                        {new Date(remediation.closed_at).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {canAssign && (
                            <button
                                onClick={() => setShowAssignModal(true)}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs py-2 rounded-lg font-medium transition"
                            >
                                Edit Ownership & SLA
                            </button>
                        )}
                    </div>

                    {/* Section 7: Activity & Audit Timeline */}
                    <ActivityTimeline resourceType="REMEDIATION" resourceId={remediation.id} />
                </div>
            </div>

            {/* Modal 1: Assign Owner & Team */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Assign Remediation Ownership</h3>
                        <form onSubmit={handleAssign} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">Assigned Team</label>
                                <input
                                    type="text"
                                    value={assignTeam}
                                    onChange={(e) => setAssignTeam(e.target.value)}
                                    placeholder="e.g. IT Infrastructure Team"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1">Target Date (SLA)</label>
                                <input
                                    type="date"
                                    value={assignDate}
                                    onChange={(e) => setAssignDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1">Assignment Notes</label>
                                <textarea
                                    rows={2}
                                    value={assignNotes}
                                    onChange={(e) => setAssignNotes(e.target.value)}
                                    placeholder="Operational instructions..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-cyan-500 text-slate-950 font-semibold px-4 py-1.5 rounded-lg"
                                >
                                    Save Assignment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Block Remediation */}
            {showBlockModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-rose-400">
                            <Ban className="w-5 h-5" />
                            <h3 className="font-semibold text-white text-base">Block Remediation Execution</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                            A detailed operational reason is mandatory when transitioning this remediation to the BLOCKED state.
                        </p>

                        <form onSubmit={handleBlock} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">
                                    Blocking Rationale <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    minLength={5}
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    placeholder="e.g. Blocked pending vendor microcode emergency patch release or CAB freeze approval..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBlockModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg transition"
                                >
                                    Confirm Block
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 3: Unblock Remediation */}
            {showUnblockModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Resolve Block & Resume Work</h3>
                        <form onSubmit={handleUnblock} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">Unblock Resolution Notes</label>
                                <textarea
                                    rows={3}
                                    value={unblockNotes}
                                    onChange={(e) => setUnblockNotes(e.target.value)}
                                    placeholder="How was the blocker resolved? (e.g. CAB change freeze waiver granted)"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUnblockModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg"
                                >
                                    Resume Execution
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 4: Submit Evidence for Validation */}
            {showSubmitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Submit Corrective Action for Validation</h3>
                        <p className="text-xs text-slate-400">
                            Confirm that engineering work is complete and attached evidence satisfies the required verification checklist.
                        </p>

                        <form onSubmit={handleSubmitEvidence} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">Submission Notes</label>
                                <textarea
                                    rows={3}
                                    value={submitNotes}
                                    onChange={(e) => setSubmitNotes(e.target.value)}
                                    placeholder="Summary of completed actions and verification artifacts..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSubmitModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-lg"
                                >
                                    Submit for Validation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 5: Attach Evidence */}
            {showEvidenceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Attach Remediation Evidence</h3>
                        <form onSubmit={handleAddEvidence} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">
                                    Artifact Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={evTitle}
                                    onChange={(e) => setEvTitle(e.target.value)}
                                    placeholder="e.g. SonarQube v2.4.1 Secret Scan Verification"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1">Evidence Type</label>
                                <select
                                    value={evType}
                                    onChange={(e) => setEvType(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                >
                                    <option value="SCAN_REPORT">SCAN_REPORT</option>
                                    <option value="CONFIGURATION">CONFIGURATION</option>
                                    <option value="SYSTEM_LOG">SYSTEM_LOG</option>
                                    <option value="CHANGE_RECORD">CHANGE_RECORD</option>
                                    <option value="POLICY">POLICY</option>
                                    <option value="SCREENSHOT">SCREENSHOT</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1">Storage URL / File URI</label>
                                <input
                                    type="text"
                                    value={evUrl}
                                    onChange={(e) => setEvUrl(e.target.value)}
                                    placeholder="https://storage.sat-sa.local/scans/report.pdf"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1">Description</label>
                                <textarea
                                    rows={2}
                                    value={evDesc}
                                    onChange={(e) => setEvDesc(e.target.value)}
                                    placeholder="What does this artifact verify?"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEvidenceModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg"
                                >
                                    Save Evidence Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 6: Independent Validator Review & Decision */}
            {showValidateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Independent Validator Decision</h3>

                        {isOwner ? (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">
                                <strong>Separation of Duties Warning:</strong> You are the assigned remediation owner. As enforced by backend security policies, your verification submission will be rejected.
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Verify that corrective actions satisfy all completion criteria and that attached evidence is authentic.
                            </p>
                        )}

                        <form onSubmit={handleValidationDecision} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1.5 font-medium">Validation Decision</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setValidateDecision("VERIFIED")}
                                        className={`p-3 rounded-lg border text-center font-semibold transition ${
                                            validateDecision === "VERIFIED"
                                                ? "bg-teal-500/20 border-teal-500 text-teal-300"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                                        }`}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-teal-400" />
                                        <span>Verify & Sign Off</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setValidateDecision("RETURNED_FOR_CORRECTION")}
                                        className={`p-3 rounded-lg border text-center font-semibold transition ${
                                            validateDecision === "RETURNED_FOR_CORRECTION"
                                                ? "bg-amber-500/20 border-amber-500 text-amber-300"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                                        }`}
                                    >
                                        <RotateCcw className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                                        <span>Return for Correction</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-300 mb-1.5 font-medium">
                                    Validator Review Comments{" "}
                                    {validateDecision === "RETURNED_FOR_CORRECTION" && (
                                        <span className="text-rose-400">* (Mandatory for returns)</span>
                                    )}
                                </label>
                                <textarea
                                    rows={4}
                                    required={validateDecision === "RETURNED_FOR_CORRECTION"}
                                    value={validateComments}
                                    onChange={(e) => setValidateComments(e.target.value)}
                                    placeholder={
                                        validateDecision === "VERIFIED"
                                            ? "Audit verification details, independent re-test results, and sign-off rationale..."
                                            : "Specific deficiencies identified that must be resolved before resubmission..."
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowValidateModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction || isOwner}
                                    className={`px-5 py-2 rounded-lg font-semibold text-slate-950 transition ${
                                        validateDecision === "VERIFIED"
                                            ? "bg-teal-400 hover:bg-teal-300 disabled:opacity-40"
                                            : "bg-amber-400 hover:bg-amber-300 disabled:opacity-40"
                                    }`}
                                >
                                    {submittingAction
                                        ? "Processing..."
                                        : validateDecision === "VERIFIED"
                                        ? "Confirm Sign-Off"
                                        : "Return for Correction"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 7: Close Remediation */}
            {showCloseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
                        <h3 className="font-semibold text-white text-base">Officially Close Remediation</h3>
                        <p className="text-xs text-slate-400">
                            Closing marks this remediation as permanently resolved in the supervisory register.
                        </p>

                        <form onSubmit={handleClose} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1">Final Closure Notes</label>
                                <textarea
                                    rows={3}
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    placeholder="Closure confirmation summary..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCloseModal(false)}
                                    className="px-3 py-1.5 text-slate-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAction}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg"
                                >
                                    Confirm Closure
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {remediation && (
                <EscalateModal
                    isOpen={showEscalateModal}
                    onClose={() => setShowEscalateModal(false)}
                    resourceType="REMEDIATION"
                    resourceId={remediation.id}
                    resourceBusinessId={remediation.business_id}
                    resourceTitle={remediation.title}
                    onSuccess={() => loadData()}
                />
            )}
        </div>
    );
}
