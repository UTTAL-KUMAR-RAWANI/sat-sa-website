"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    assessmentsApi,
    AssessmentSummary,
    AssessmentStatus,
} from "@/lib/api/assessments";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    FileCheck,
    ClipboardCheck,
    ArrowLeft,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ShieldAlert,
    Building2,
    User as UserIcon,
    ChevronRight,
    MessageSquare,
} from "lucide-react";

export default function AssessmentReviewQueuePage() {
    const { user } = useAuth();
    const [reviewQueue, setReviewQueue] = useState<AssessmentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal action state
    const [selectedAsm, setSelectedAsm] = useState<AssessmentSummary | null>(null);
    const [actionType, setActionType] = useState<"APPROVE" | "REQUEST_CHANGES" | null>(null);
    const [actionComments, setActionComments] = useState("");
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const canApprove = hasPermission(user, Permissions.ASSESSMENT_APPROVE);
    const canReview = hasPermission(user, Permissions.ASSESSMENT_REVIEW);

    const loadReviewQueue = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await assessmentsApi.getReviewQueue();
            setReviewQueue(data);
        } catch (err: any) {
            setError(err.message || "Failed to load auditor review queue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReviewQueue();
    }, []);

    const handleActionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAsm || !actionType) return;

        if (actionType === "REQUEST_CHANGES" && !actionComments.trim()) {
            setActionError("Please provide specific feedback/reason for requesting changes.");
            return;
        }

        setActionSubmitting(true);
        setActionError(null);
        try {
            if (actionType === "APPROVE") {
                await assessmentsApi.approve(selectedAsm.id, actionComments.trim() || undefined);
            } else if (actionType === "REQUEST_CHANGES") {
                await assessmentsApi.requestChanges(selectedAsm.id, actionComments.trim());
            }

            setSelectedAsm(null);
            setActionType(null);
            setActionComments("");
            loadReviewQueue();
        } catch (err: any) {
            setActionError(err.message || "Failed to perform review decision");
        } finally {
            setActionSubmitting(false);
        }
    };

    const isUserSoDBlocked = (asm: AssessmentSummary) => {
        if (!user) return false;
        return asm.assessor_id === user.id || asm.created_by_id === user.id;
    };

    const getStatusBadge = (status: AssessmentStatus) => {
        switch (status) {
            case "SUBMITTED":
                return "bg-cyan-950/70 text-cyan-300 border-cyan-800";
            case "UNDER_REVIEW":
                return "bg-purple-950/70 text-purple-300 border-purple-800";
            case "CHANGES_REQUESTED":
                return "bg-rose-950/70 text-rose-300 border-rose-800";
            case "RESUBMITTED":
                return "bg-orange-950/70 text-orange-300 border-orange-800";
            default:
                return "bg-zinc-800 text-zinc-300 border-zinc-700";
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div className="flex items-center gap-3">
                    <Link
                        href="/assessments"
                        className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-800/60 text-purple-400 shadow-sm">
                        <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                            Auditor Review Queue
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Formal verification and independent sign-off for submitted security assessments
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadReviewQueue}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
                        <span>Refresh Queue</span>
                    </button>
                </div>
            </div>

            {/* SoD Notice Banner */}
            <div className="p-3.5 bg-purple-950/20 border border-purple-900/40 rounded-xl flex items-center justify-between text-xs text-purple-300">
                <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>
                        <strong>Separation of Duties (SoD) Active:</strong> Assessors and creators cannot independently approve or sign off their own assessment submissions.
                    </span>
                </div>
                <div className="text-[11px] text-purple-400/80 font-mono">
                    {reviewQueue.length} Active in Queue
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Review Cards Grid / List */}
            {loading ? (
                <div className="py-16 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
                    <p className="text-xs">Loading pending review items...</p>
                </div>
            ) : reviewQueue.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 stroke-[1.5]" />
                    <h3 className="text-sm font-semibold text-zinc-200">All Assessments Reviewed</h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                        There are no assessments currently awaiting auditor evaluation or sign-off.
                    </p>
                    <Link
                        href="/assessments"
                        className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                        <span>Return to Assessments Registry</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviewQueue.map((asm) => {
                        const sodBlocked = isUserSoDBlocked(asm);
                        const progressPercent =
                            asm.controls_count > 0
                                ? Math.round((asm.evaluated_controls_count / asm.controls_count) * 100)
                                : 0;

                        return (
                            <div
                                key={asm.id}
                                className="bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-5 shadow-sm space-y-4 transition"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-zinc-400">
                                                {asm.business_id}
                                            </span>
                                            <span
                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${getStatusBadge(
                                                    asm.status
                                                )}`}
                                            >
                                                {asm.status.replace(/_/g, " ")}
                                            </span>
                                            {asm.is_overdue && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800">
                                                    OVERDUE
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-bold text-white mt-1">
                                            <Link
                                                href={`/assessments/${asm.id}`}
                                                className="hover:text-blue-400 transition"
                                            >
                                                {asm.title}
                                            </Link>
                                        </h3>
                                    </div>

                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        {asm.priority}
                                    </span>
                                </div>

                                {asm.description && (
                                    <p className="text-xs text-zinc-400 line-clamp-2">
                                        {asm.description}
                                    </p>
                                )}

                                {/* Entity & Personnel Info */}
                                <div className="grid grid-cols-2 gap-2 text-xs border-y border-zinc-800/60 py-3">
                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className="truncate">{asm.organization_name || "Enterprise"}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                        <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className="truncate">Assessor: {asm.assessor_name || "Unassigned"}</span>
                                    </div>
                                </div>

                                {/* Controls & Evidence stats */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-zinc-400">
                                        <span>Control Evaluations</span>
                                        <span className="font-mono text-[11px]">
                                            {asm.evaluated_controls_count} / {asm.controls_count} ({progressPercent}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 transition-all"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                                        <span>{asm.evidence_count} evidence items</span>
                                        <span>{asm.findings_count} linked findings</span>
                                    </div>
                                </div>

                                {/* SoD Warning If Applicable */}
                                {sodBlocked && (
                                    <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/50 text-[11px] text-amber-400 flex items-center gap-2">
                                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>
                                            SoD Conflict: You are designated as assessor/creator. An independent auditor must approve.
                                        </span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2">
                                    <Link
                                        href={`/assessments/${asm.id}`}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition"
                                    >
                                        <span>Inspect Controls & Evidence</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>

                                    <div className="flex items-center gap-2">
                                        {canReview && asm.status === "SUBMITTED" && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await assessmentsApi.transition(asm.id, "UNDER_REVIEW");
                                                        loadReviewQueue();
                                                    } catch (err: any) {
                                                        alert(err.message || "Failed to start review");
                                                    }
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                                            >
                                                Start Review
                                            </button>
                                        )}

                                        {canReview && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAsm(asm);
                                                    setActionType("REQUEST_CHANGES");
                                                    setActionComments("");
                                                    setActionError(null);
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 transition"
                                            >
                                                Request Changes
                                            </button>
                                        )}

                                        {canApprove && (
                                            <button
                                                disabled={sodBlocked}
                                                onClick={() => {
                                                    setSelectedAsm(asm);
                                                    setActionType("APPROVE");
                                                    setActionComments("");
                                                    setActionError(null);
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition"
                                            >
                                                Approve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Decision Action Modal */}
            {selectedAsm && actionType && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                {actionType === "APPROVE" ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <span>Formally Approve Assessment ({selectedAsm.business_id})</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-5 h-5 text-rose-500" />
                                        <span>Request Changes ({selectedAsm.business_id})</span>
                                    </>
                                )}
                            </h3>
                            <button
                                onClick={() => {
                                    setSelectedAsm(null);
                                    setActionType(null);
                                }}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {actionError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {actionError}
                            </div>
                        )}

                        <form onSubmit={handleActionSubmit} className="space-y-4">
                            <p className="text-xs text-zinc-400">
                                {actionType === "APPROVE"
                                    ? "By approving this assessment, you verify that all control evaluations meet supervisory standards and linked evidence has been authenticated. This action is permanently recorded in the immutable audit trail."
                                    : "Specify the exact deficiencies or additional evidence required. The assessment will return to the lead assessor for remediation."}
                            </p>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Auditor Comments / Notes {actionType === "REQUEST_CHANGES" && "*"}
                                </label>
                                <textarea
                                    value={actionComments}
                                    onChange={(e) => setActionComments(e.target.value)}
                                    rows={4}
                                    placeholder={
                                        actionType === "APPROVE"
                                            ? "Optional auditor sign-off statement..."
                                            : "Detailed change requirements for the assessor..."
                                    }
                                    required={actionType === "REQUEST_CHANGES"}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-purple-600 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAsm(null);
                                        setActionType(null);
                                    }}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-md disabled:opacity-50 transition ${
                                        actionType === "APPROVE"
                                            ? "bg-emerald-600 hover:bg-emerald-500"
                                            : "bg-rose-600 hover:bg-rose-500"
                                    }`}
                                >
                                    {actionSubmitting
                                        ? "Submitting Decision..."
                                        : actionType === "APPROVE"
                                        ? "Confirm Sign-Off"
                                        : "Send Changes Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
