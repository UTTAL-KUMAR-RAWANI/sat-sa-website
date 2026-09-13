"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    assessmentsApi,
    AssessmentDetail,
    AssessmentControlItem,
    AssessmentEvidenceItem,
    AssessmentFindingItem,
    AssessmentTimelineEvent,
    AssessmentStatus,
    AssessmentPriority,
} from "@/lib/api/assessments";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission, hasAnyPermission } from "@/lib/rbac/permissions";
import {
    ClipboardCheck,
    ArrowLeft,
    Building2,
    User as UserIcon,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ShieldAlert,
    FileCheck,
    FileText,
    Activity,
    Layers,
    Send,
    Edit3,
    Check,
    AlertCircle,
    RefreshCw,
    ExternalLink,
    Lock,
} from "lucide-react";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function AssessmentDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
    const [timeline, setTimeline] = useState<AssessmentTimelineEvent[]>([]);
    const [activeTab, setActiveTab] = useState<
        "overview" | "controls" | "evidence" | "findings" | "review" | "timeline"
    >("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Workflow action state
    const [actionModal, setActionModal] = useState<{
        type: "START" | "SUBMIT" | "BEGIN_REVIEW" | "REQUEST_CHANGES" | "RESUBMIT" | "APPROVE" | "CLOSE";
        title: string;
        requireComments?: boolean;
    } | null>(null);
    const [actionComments, setActionComments] = useState("");
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Control evaluation modal
    const [selectedControl, setSelectedControl] = useState<AssessmentControlItem | null>(null);
    const [evalStatus, setEvalStatus] = useState<string>("COMPLIANT");
    const [evalEffectiveness, setEvalEffectiveness] = useState<string>("EFFECTIVE");
    const [evalNotes, setEvalNotes] = useState<string>("");
    const [evalReviewerNotes, setEvalReviewerNotes] = useState<string>("");
    const [evaluating, setEvaluating] = useState(false);
    const [evalError, setEvalError] = useState<string | null>(null);

    // Evidence verify modal
    const [selectedEvidence, setSelectedEvidence] = useState<AssessmentEvidenceItem | null>(null);
    const [verifyDecision, setVerifyDecision] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
    const [verifyComments, setVerifyComments] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    // Permissions
    const canUpdate = hasPermission(user, Permissions.ASSESSMENT_UPDATE);
    const canSubmit = hasPermission(user, Permissions.ASSESSMENT_SUBMIT);
    const canReview = hasPermission(user, Permissions.ASSESSMENT_REVIEW);
    const canApprove = hasPermission(user, Permissions.ASSESSMENT_APPROVE);
    const canClose = hasPermission(user, Permissions.ASSESSMENT_CLOSE);
    const canUpdateControls = hasPermission(user, Permissions.ASSESSMENT_CONTROLS_UPDATE);
    const canVerifyEvidence = hasPermission(user, Permissions.EVIDENCE_VERIFY);

    const loadAssessment = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await assessmentsApi.getById(id);
            setAssessment(data);
        } catch (err: any) {
            setError(err.message || "Failed to load assessment details");
        } finally {
            setLoading(false);
        }
    };

    const loadTimeline = async () => {
        try {
            const events = await assessmentsApi.getTimeline(id);
            setTimeline(events);
        } catch (err) {
            console.error("Failed to load timeline", err);
        }
    };

    useEffect(() => {
        loadAssessment();
        loadTimeline();
    }, [id]);

    const isAssessorOrCreator =
        user && assessment && (user.id === assessment.assessor_id || user.id === assessment.created_by_id);

    // Workflow actions execution
    const handleWorkflowAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assessment || !actionModal) return;

        if (actionModal.requireComments && !actionComments.trim()) {
            setActionError("Please provide reason / comments.");
            return;
        }

        setActionSubmitting(true);
        setActionError(null);

        try {
            switch (actionModal.type) {
                case "START":
                    await assessmentsApi.start(assessment.id);
                    break;
                case "SUBMIT":
                    await assessmentsApi.submit(assessment.id, actionComments.trim() || undefined);
                    break;
                case "BEGIN_REVIEW":
                    await assessmentsApi.transition(assessment.id, "UNDER_REVIEW", actionComments.trim() || undefined);
                    break;
                case "REQUEST_CHANGES":
                    await assessmentsApi.requestChanges(assessment.id, actionComments.trim());
                    break;
                case "RESUBMIT":
                    await assessmentsApi.resubmit(assessment.id, actionComments.trim() || undefined);
                    break;
                case "APPROVE":
                    await assessmentsApi.approve(assessment.id, actionComments.trim() || undefined);
                    break;
                case "CLOSE":
                    await assessmentsApi.close(assessment.id, actionComments.trim() || undefined);
                    break;
            }

            setActionModal(null);
            setActionComments("");
            loadAssessment();
            loadTimeline();
        } catch (err: any) {
            setActionError(err.message || "Workflow transition failed");
        } finally {
            setActionSubmitting(false);
        }
    };

    // Control evaluation save
    const handleSaveControlEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assessment || !selectedControl) return;

        setEvaluating(true);
        setEvalError(null);
        try {
            await assessmentsApi.updateControl(assessment.id, selectedControl.id, {
                status: evalStatus,
                effectiveness: evalEffectiveness,
                evaluation_notes: evalNotes.trim() || undefined,
                reviewer_comments: evalReviewerNotes.trim() || undefined,
            });

            setSelectedControl(null);
            loadAssessment();
            loadTimeline();
        } catch (err: any) {
            setEvalError(err.message || "Failed to update control evaluation");
        } finally {
            setEvaluating(false);
        }
    };

    // Evidence verification save
    const handleSaveEvidenceVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvidence) return;

        setVerifying(true);
        setVerifyError(null);
        try {
            await assessmentsApi.verifyEvidence(selectedEvidence.id, {
                status: verifyDecision,
                reviewer_comments: verifyComments.trim() || undefined,
            });

            setSelectedEvidence(null);
            loadAssessment();
            loadTimeline();
        } catch (err: any) {
            setVerifyError(err.message || "Failed to record evidence verification");
        } finally {
            setVerifying(false);
        }
    };

    if (loading && !assessment) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-xs text-zinc-400">Loading security assessment dossier...</p>
                </div>
            </div>
        );
    }

    if (!assessment) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
                <div className="max-w-md mx-auto text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                    <h2 className="text-lg font-bold text-white">Assessment Not Found</h2>
                    <p className="text-xs text-zinc-400">
                        {error || "The requested assessment could not be located or you lack authorization to access it."}
                    </p>
                    <Link
                        href="/assessments"
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Return to Registry</span>
                    </Link>
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: AssessmentStatus) => {
        switch (status) {
            case "DRAFT":
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
            case "ASSIGNED":
                return "bg-slate-900/60 text-slate-300 border-slate-700";
            case "IN_PROGRESS":
                return "bg-blue-950/60 text-blue-400 border-blue-800";
            case "EVIDENCE_REQUIRED":
                return "bg-amber-950/60 text-amber-400 border-amber-800";
            case "SUBMITTED":
                return "bg-cyan-950/60 text-cyan-400 border-cyan-800";
            case "UNDER_REVIEW":
                return "bg-purple-950/60 text-purple-400 border-purple-800";
            case "CHANGES_REQUESTED":
                return "bg-rose-950/60 text-rose-400 border-rose-800";
            case "RESUBMITTED":
                return "bg-orange-950/60 text-orange-400 border-orange-800";
            case "APPROVED":
                return "bg-emerald-950/60 text-emerald-400 border-emerald-800";
            case "CLOSED":
                return "bg-zinc-900 text-zinc-500 border-zinc-800";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    const evaluatedPercent =
        assessment.controls_count > 0
            ? Math.round((assessment.evaluated_controls_count / assessment.controls_count) * 100)
            : 0;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Breadcrumb & Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Link href="/assessments" className="hover:text-white transition">
                        Assessments
                    </Link>
                    <span>/</span>
                    <span className="font-mono text-zinc-200">{assessment.business_id}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            loadAssessment();
                            loadTimeline();
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <Link
                        href="/assessments"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Assessments</span>
                    </Link>
                </div>
            </div>

            {/* Assessment Header Card */}
            <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
                                {assessment.business_id}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${getStatusBadge(
                                    assessment.status
                                )}`}
                            >
                                {assessment.status.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {assessment.priority} PRIORITY
                            </span>
                            {assessment.is_overdue && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>OVERDUE SLA</span>
                                </span>
                            )}
                        </div>

                        <h1 className="text-xl font-bold text-white tracking-tight">
                            {assessment.title}
                        </h1>

                        <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed">
                            {assessment.description || "No specific scope notes provided."}
                        </p>
                    </div>

                    {/* Separation of Duties Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                        {/* Start (Draft/Assigned -> In Progress) */}
                        {(assessment.status === "DRAFT" || assessment.status === "ASSIGNED") && (canUpdate || canSubmit) && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "START",
                                        title: "Commence Assessment Evaluation",
                                    })
                                }
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
                            >
                                Start Assessment
                            </button>
                        )}

                        {/* Submit (In Progress/Evidence Required -> Submitted) */}
                        {(assessment.status === "IN_PROGRESS" || assessment.status === "EVIDENCE_REQUIRED") && canSubmit && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "SUBMIT",
                                        title: "Submit Assessment for Auditor Review",
                                        requireComments: false,
                                    })
                                }
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Submit for Review</span>
                            </button>
                        )}

                        {/* Begin Review (Submitted -> Under Review) */}
                        {assessment.status === "SUBMITTED" && canReview && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "BEGIN_REVIEW",
                                        title: "Begin Auditor Review",
                                    })
                                }
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition flex items-center gap-1.5"
                            >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Begin Review</span>
                            </button>
                        )}

                        {/* Request Changes (Under Review -> Changes Requested) */}
                        {assessment.status === "UNDER_REVIEW" && canReview && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "REQUEST_CHANGES",
                                        title: "Request Assessor Changes / Evidence",
                                        requireComments: true,
                                    })
                                }
                                className="px-3 py-2 text-xs font-medium rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/70 transition flex items-center gap-1.5"
                            >
                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                <span>Request Changes</span>
                            </button>
                        )}

                        {/* Resubmit (Changes Requested -> Resubmitted) */}
                        {assessment.status === "CHANGES_REQUESTED" && canSubmit && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "RESUBMIT",
                                        title: "Resubmit Remediated Assessment",
                                        requireComments: false,
                                    })
                                }
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Resubmit to Reviewer</span>
                            </button>
                        )}

                        {/* Approve Assessment (Under Review/Resubmitted -> Approved) */}
                        {(assessment.status === "UNDER_REVIEW" || assessment.status === "RESUBMITTED") && canApprove && (
                            <div className="relative group">
                                <button
                                    disabled={Boolean(isAssessorOrCreator)}
                                    onClick={() =>
                                        setActionModal({
                                            type: "APPROVE",
                                            title: "Formally Approve Security Assessment",
                                            requireComments: false,
                                        })
                                    }
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Approve Assessment</span>
                                </button>
                                {isAssessorOrCreator && (
                                    <div className="absolute right-0 top-full mt-1.5 w-64 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] text-amber-300 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                                        <div className="flex items-center gap-1 font-semibold mb-0.5">
                                            <Lock className="w-3 h-3" />
                                            <span>Separation of Duties (SoD)</span>
                                        </div>
                                        You are registered as the lead assessor or creator. Only an independent auditor can approve this assessment.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Close Assessment (Approved -> Closed) */}
                        {assessment.status === "APPROVED" && canClose && (
                            <button
                                onClick={() =>
                                    setActionModal({
                                        type: "CLOSE",
                                        title: "Formally Close Assessment",
                                        requireComments: false,
                                    })
                                }
                                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                            >
                                Close Assessment
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="pt-2 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                        <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Evaluation Progress</span>
                        </span>
                        <span className="font-mono text-zinc-300 text-[11px]">
                            {assessment.evaluated_controls_count} of {assessment.controls_count} controls evaluated ({evaluatedPercent}%)
                        </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${
                                evaluatedPercent === 100
                                    ? "bg-emerald-500"
                                    : evaluatedPercent > 50
                                    ? "bg-blue-500"
                                    : "bg-amber-500"
                            }`}
                            style={{ width: `${evaluatedPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Tabs Bar */}
            <div className="border-b border-zinc-800 flex items-center gap-1 text-xs font-medium">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`pb-2.5 px-3.5 border-b-2 transition ${
                        activeTab === "overview"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab("controls")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "controls"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Controls & Evaluation</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                        {assessment.controls_count}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("evidence")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "evidence"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Evidence Repository</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                        {assessment.evidence.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("findings")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "findings"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Linked Findings</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                        {assessment.findings.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("review")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "review"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Auditor Sign-Off</span>
                    {assessment.status === "APPROVED" && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("timeline")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "timeline"
                            ? "border-blue-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Activity & Audit Trail</span>
                </button>
            </div>

            {/* TAB CONTENT: Overview */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        {/* Scope and Context */}
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Scope & Supervisory Context
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Regulated Entity / Org</span>
                                    <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>{assessment.organization_name || "Enterprise Wide"}</span>
                                    </span>
                                </div>

                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Industry Sector</span>
                                    <span className="text-zinc-200 font-semibold">
                                        {assessment.sector_name || "All Sectors"}
                                    </span>
                                </div>

                                {assessment.cse_business_id && (
                                    <div>
                                        <span className="text-zinc-500 block mb-0.5">Source Security Event (CSE)</span>
                                        <Link
                                            href={`/cse`}
                                            className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                                        >
                                            <span>{assessment.cse_business_id}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    </div>
                                )}

                                {assessment.investigation_business_id && (
                                    <div>
                                        <span className="text-zinc-500 block mb-0.5">Source Investigation</span>
                                        <Link
                                            href={`/investigations`}
                                            className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                                        >
                                            <span>{assessment.investigation_business_id}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Compliance Breakdown */}
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Control Compliance Breakdown
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {(() => {
                                    const compliant = assessment.controls.filter((c) => c.status === "COMPLIANT").length;
                                    const partial = assessment.controls.filter((c) => c.status === "PARTIALLY_COMPLIANT").length;
                                    const nonCompliant = assessment.controls.filter((c) => c.status === "NON_COMPLIANT").length;
                                    const notStarted = assessment.controls.filter((c) => c.status === "NOT_STARTED" || !c.status).length;

                                    return (
                                        <>
                                            <div className="p-3 bg-zinc-950/60 border border-emerald-900/40 rounded-xl">
                                                <span className="text-[11px] text-emerald-400 font-medium block">Compliant</span>
                                                <span className="text-xl font-bold text-emerald-400">{compliant}</span>
                                            </div>
                                            <div className="p-3 bg-zinc-950/60 border border-yellow-900/40 rounded-xl">
                                                <span className="text-[11px] text-yellow-400 font-medium block">Partially Compliant</span>
                                                <span className="text-xl font-bold text-yellow-400">{partial}</span>
                                            </div>
                                            <div className="p-3 bg-zinc-950/60 border border-rose-900/40 rounded-xl">
                                                <span className="text-[11px] text-rose-400 font-medium block">Non Compliant</span>
                                                <span className="text-xl font-bold text-rose-400">{nonCompliant}</span>
                                            </div>
                                            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                                <span className="text-[11px] text-zinc-400 font-medium block">Not Evaluated</span>
                                                <span className="text-xl font-bold text-zinc-300">{notStarted}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Personnel & Milestones Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Assessment Roles
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Lead Assessor</span>
                                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                                        <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                                        <span>{assessment.assessor_name || "Unassigned"}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Independent Auditor Reviewer</span>
                                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                                        <FileCheck className="w-3.5 h-3.5 text-purple-400" />
                                        <span>{assessment.reviewer_name || "Awaiting Assignment"}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Initiator / Created By</span>
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{assessment.created_by_name || "System"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Lifecycle Milestones
                            </h3>
                            <div className="space-y-2.5 text-xs text-zinc-300">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Target Due Date:</span>
                                    <span className="font-mono text-zinc-200">
                                        {assessment.due_date ? new Date(assessment.due_date).toLocaleDateString() : "None"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Commenced Date:</span>
                                    <span className="font-mono text-zinc-200">
                                        {assessment.start_date ? new Date(assessment.start_date).toLocaleDateString() : "Pending"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Submitted for Review:</span>
                                    <span className="font-mono text-zinc-200">
                                        {assessment.submitted_date ? new Date(assessment.submitted_date).toLocaleDateString() : "Pending"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Approved Date:</span>
                                    <span className="font-mono text-zinc-200">
                                        {assessment.approved_date ? new Date(assessment.approved_date).toLocaleDateString() : "Pending"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Closed Date:</span>
                                    <span className="font-mono text-zinc-200">
                                        {assessment.closed_date ? new Date(assessment.closed_date).toLocaleDateString() : "Pending"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Controls & Evaluation */}
            {activeTab === "controls" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">
                            Assigned Security Controls ({assessment.controls.length})
                        </h3>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-zinc-300">
                                <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                    <tr>
                                        <th className="py-3 px-4">Control Code & Title</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Compliance Status</th>
                                        <th className="py-3 px-4">Effectiveness</th>
                                        <th className="py-3 px-4">Evaluator & Notes</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {assessment.controls.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-zinc-500">
                                                No controls currently mapped to this assessment.
                                            </td>
                                        </tr>
                                    ) : (
                                        assessment.controls.map((ctrl) => (
                                            <tr key={ctrl.id} className="hover:bg-zinc-850/50 transition">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-white">
                                                        {ctrl.control_name || "Security Control"}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-zinc-400">
                                                        {ctrl.control_business_id || "CTRL-UNKNOWN"}
                                                    </div>
                                                </td>

                                                <td className="py-3 px-4 text-zinc-400">
                                                    {ctrl.control_category || "General"}
                                                </td>

                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                                                            ctrl.status === "COMPLIANT"
                                                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                                                : ctrl.status === "PARTIALLY_COMPLIANT"
                                                                ? "bg-yellow-950/60 text-yellow-400 border-yellow-800"
                                                                : ctrl.status === "NON_COMPLIANT"
                                                                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                                        }`}
                                                    >
                                                        {(ctrl.status || "NOT_STARTED").replace(/_/g, " ")}
                                                    </span>
                                                </td>

                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                                                            ctrl.effectiveness === "EFFECTIVE"
                                                                ? "bg-blue-950/60 text-blue-400 border-blue-800"
                                                                : ctrl.effectiveness === "PARTIALLY_EFFECTIVE"
                                                                ? "bg-amber-950/60 text-amber-400 border-amber-800"
                                                                : ctrl.effectiveness === "INEFFECTIVE"
                                                                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                                                : "bg-zinc-800 text-zinc-500 border-zinc-700"
                                                        }`}
                                                    >
                                                        {(ctrl.effectiveness || "NOT_ASSESSED").replace(/_/g, " ")}
                                                    </span>
                                                </td>

                                                <td className="py-3 px-4 max-w-xs">
                                                    <div className="text-zinc-300 line-clamp-1">
                                                        {ctrl.evaluation_notes || <span className="text-zinc-500 italic">No notes recorded</span>}
                                                    </div>
                                                    {ctrl.evaluator_name && (
                                                        <div className="text-[10px] text-zinc-500 mt-0.5">
                                                            By: {ctrl.evaluator_name}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 px-4 text-right">
                                                    {canUpdateControls && assessment.status !== "CLOSED" && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedControl(ctrl);
                                                                setEvalStatus(ctrl.status || "COMPLIANT");
                                                                setEvalEffectiveness(ctrl.effectiveness || "EFFECTIVE");
                                                                setEvalNotes(ctrl.evaluation_notes || "");
                                                                setEvalReviewerNotes(ctrl.reviewer_comments || "");
                                                                setEvalError(null);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                                                        >
                                                            <Edit3 className="w-3 h-3 text-zinc-400" />
                                                            <span>Evaluate</span>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Evidence Repository */}
            {activeTab === "evidence" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">
                            Linked Assessment Evidence ({assessment.evidence.length})
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assessment.evidence.length === 0 ? (
                            <div className="col-span-2 py-12 text-center text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
                                <p className="text-xs font-semibold text-zinc-400">No Evidence Attached Yet</p>
                                <p className="text-[11px] text-zinc-500">
                                    Evidence items uploaded or attached from investigations will appear here.
                                </p>
                            </div>
                        ) : (
                            assessment.evidence.map((ev) => (
                                <div
                                    key={ev.id}
                                    className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-zinc-400 font-semibold">
                                                    {ev.business_id || "EV-DOC"}
                                                </span>
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                                        ev.verification_status === "VERIFIED"
                                                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                                            : ev.verification_status === "REJECTED"
                                                            ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                                            : "bg-amber-950/60 text-amber-400 border-amber-800"
                                                    }`}
                                                >
                                                    {ev.verification_status}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mt-1">{ev.title}</h4>
                                        </div>

                                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                                            {ev.evidence_type}
                                        </span>
                                    </div>

                                    {ev.description && (
                                        <p className="text-xs text-zinc-400">{ev.description}</p>
                                    )}

                                    <div className="text-[11px] text-zinc-500 space-y-1 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/80 font-mono">
                                        <div className="flex justify-between">
                                            <span>URI:</span>
                                            <span className="truncate max-w-[200px] text-zinc-300">{ev.file_uri}</span>
                                        </div>
                                        {ev.checksum && (
                                            <div className="flex justify-between">
                                                <span>Checksum:</span>
                                                <span className="truncate max-w-[200px] text-zinc-400">{ev.checksum}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Verification metadata & action */}
                                    <div className="flex items-center justify-between pt-1 text-xs">
                                        <div className="text-[11px] text-zinc-500">
                                            {ev.verified_by_name ? (
                                                <span>Verified by: <strong className="text-zinc-300">{ev.verified_by_name}</strong></span>
                                            ) : (
                                                <span>Awaiting auditor verification</span>
                                            )}
                                        </div>

                                        {canVerifyEvidence && (
                                            <button
                                                onClick={() => {
                                                    setSelectedEvidence(ev);
                                                    setVerifyDecision("VERIFIED");
                                                    setVerifyComments(ev.reviewer_comments || "");
                                                    setVerifyError(null);
                                                }}
                                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1"
                                            >
                                                <Check className="w-3 h-3 text-emerald-400" />
                                                <span>Verify / Sign</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Linked Findings */}
            {activeTab === "findings" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">
                            Deficiencies & Findings ({assessment.findings.length})
                        </h3>
                        <Link
                            href="/findings"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                        >
                            <span>Open Findings Registry</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                <tr>
                                    <th className="py-3 px-4">Finding Code & Title</th>
                                    <th className="py-3 px-4">Severity & Priority</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Related Control</th>
                                    <th className="py-3 px-4 text-right">Inspect</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {assessment.findings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                                            No supervisory findings linked to this assessment.
                                        </td>
                                    </tr>
                                ) : (
                                    assessment.findings.map((f) => (
                                        <tr key={f.id} className="hover:bg-zinc-850/50 transition">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-white">
                                                    <Link href={`/findings/${f.id}`} className="hover:text-blue-400">
                                                        {f.title}
                                                    </Link>
                                                </div>
                                                <div className="font-mono text-[11px] text-zinc-400">
                                                    {f.business_id}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800 uppercase">
                                                        {f.severity}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                                                    {f.status}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-zinc-400 font-mono">
                                                {f.control_business_id || "—"}
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <Link
                                                    href={`/findings/${f.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                                                >
                                                    <span>View</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Auditor Sign-Off & SoD Verification */}
            {activeTab === "review" && (
                <div className="space-y-6 max-w-4xl">
                    {/* SoD Verification Card */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Lock className="w-4 h-4 text-purple-400" />
                                <span>Separation of Duties (SoD) Protocol Verification</span>
                            </h3>
                            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded-full">
                                ENFORCED
                            </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">
                            SAT-SA cryptographically and relationally guarantees that no assessor can approve their own evaluation. An independent review auditor with dedicated supervisory authority must inspect the control evaluations and evidence before final sign-off.
                        </p>

                        <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
                            <div>
                                <span className="text-zinc-500 block">Designated Assessor:</span>
                                <span className="text-zinc-200 font-semibold">{assessment.assessor_name || "Unassigned"}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block">Designated Reviewer:</span>
                                <span className="text-zinc-200 font-semibold">{assessment.reviewer_name || "Unassigned"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Ledger */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            <span>Formal Approval Ledger</span>
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
                                <div>
                                    <span className="font-semibold text-zinc-200 block">Current Approval State</span>
                                    <span className="text-zinc-500 text-[11px]">
                                        {assessment.status === "APPROVED"
                                            ? "Formally verified and approved by Independent Auditor Reviewer"
                                            : assessment.status === "CLOSED"
                                            ? "Assessment completed and archived"
                                            : "Awaiting auditor completion and sign-off"}
                                    </span>
                                </div>
                                <span
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase ${getStatusBadge(
                                        assessment.status
                                    )}`}
                                >
                                    {assessment.status}
                                </span>
                            </div>

                            {assessment.approved_date && (
                                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300">
                                    <div className="font-semibold">Approved Timestamp:</div>
                                    <div className="font-mono text-[11px] mt-0.5">
                                        {new Date(assessment.approved_date).toUTCString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Activity & Audit Trail */}
            {activeTab === "timeline" && (
                <div className="space-y-4 max-w-3xl">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span>Immutable Audit Trail</span>
                    </h3>

                    <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                        {timeline.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-4">No audit events recorded yet.</div>
                        ) : (
                            timeline.map((evt) => (
                                <div key={evt.id} className="relative group">
                                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-zinc-950" />
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-white">{evt.title}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                {new Date(evt.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400">{evt.description}</p>
                                        {evt.actor_name && (
                                            <div className="text-[10px] text-zinc-500 pt-1">
                                                Actor: <strong className="text-zinc-300">{evt.actor_name}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Workflow Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-blue-500" />
                                <span>{actionModal.title}</span>
                            </h3>
                            <button
                                onClick={() => setActionModal(null)}
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

                        <form onSubmit={handleWorkflowAction} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Remarks / Decision Notes {actionModal.requireComments && "*"}
                                </label>
                                <textarea
                                    value={actionComments}
                                    onChange={(e) => setActionComments(e.target.value)}
                                    rows={4}
                                    placeholder="Provide operational comments for this transition..."
                                    required={actionModal.requireComments}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-600 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setActionModal(null)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Processing..." : "Confirm Transition"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Evaluate Control Modal */}
            {selectedControl && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    Evaluate Control: {selectedControl.control_business_id}
                                </h3>
                                <p className="text-xs text-zinc-400">{selectedControl.control_name}</p>
                            </div>
                            <button
                                onClick={() => setSelectedControl(null)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {evalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {evalError}
                            </div>
                        )}

                        <form onSubmit={handleSaveControlEvaluation} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Compliance Status
                                    </label>
                                    <select
                                        value={evalStatus}
                                        onChange={(e) => setEvalStatus(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="COMPLIANT">Compliant</option>
                                        <option value="PARTIALLY_COMPLIANT">Partially Compliant</option>
                                        <option value="NON_COMPLIANT">Non Compliant</option>
                                        <option value="NOT_APPLICABLE">Not Applicable</option>
                                        <option value="NOT_STARTED">Not Started</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Effectiveness Score
                                    </label>
                                    <select
                                        value={evalEffectiveness}
                                        onChange={(e) => setEvalEffectiveness(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="EFFECTIVE">Effective</option>
                                        <option value="PARTIALLY_EFFECTIVE">Partially Effective</option>
                                        <option value="INEFFECTIVE">Ineffective</option>
                                        <option value="NOT_ASSESSED">Not Assessed</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Assessor Evaluation Notes
                                </label>
                                <textarea
                                    value={evalNotes}
                                    onChange={(e) => setEvalNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Explain the testing methodology, findings, or gaps observed..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-600 focus:outline-none resize-none"
                                />
                            </div>

                            {canReview && (
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Auditor Reviewer Comments
                                    </label>
                                    <textarea
                                        value={evalReviewerNotes}
                                        onChange={(e) => setEvalReviewerNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Auditor verification feedback..."
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-purple-600 focus:outline-none resize-none"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedControl(null)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={evaluating}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {evaluating ? "Saving..." : "Save Evaluation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Evidence Verification Modal */}
            {selectedEvidence && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-purple-400" />
                                    <span>Verify Evidence Artifact</span>
                                </h3>
                                <p className="text-xs text-zinc-400">{selectedEvidence.title}</p>
                            </div>
                            <button
                                onClick={() => setSelectedEvidence(null)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {verifyError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {verifyError}
                            </div>
                        )}

                        <form onSubmit={handleSaveEvidenceVerification} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Verification Decision
                                </label>
                                <select
                                    value={verifyDecision}
                                    onChange={(e) => setVerifyDecision(e.target.value as "VERIFIED" | "REJECTED")}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-purple-600 focus:outline-none"
                                >
                                    <option value="VERIFIED">Verified & Authenticated</option>
                                    <option value="REJECTED">Rejected / Insufficient</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Auditor Verification Notes
                                </label>
                                <textarea
                                    value={verifyComments}
                                    onChange={(e) => setVerifyComments(e.target.value)}
                                    rows={3}
                                    placeholder="Confirm document authenticity, checksum validation, or reasons for rejection..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-purple-600 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedEvidence(null)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={verifying}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {verifying ? "Signing..." : "Confirm Verification"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
