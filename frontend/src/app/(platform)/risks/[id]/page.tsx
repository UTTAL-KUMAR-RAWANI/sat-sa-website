"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    risksApi,
    RiskDetail,
    RiskLevel,
    RiskStatus,
    RiskTreatmentItem,
    RiskExceptionItem,
    RiskTimelineEvent,
    RiskTreatmentStrategy,
} from "@/lib/api/risks";
import { EscalateModal } from "@/components/supervision/EscalateModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission, hasAnyPermission } from "@/lib/rbac/permissions";
import {
    ShieldAlert,
    ArrowLeft,
    Building2,
    User as UserIcon,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileCheck,
    Activity,
    Layers,
    Send,
    Edit3,
    Check,
    AlertCircle,
    RefreshCw,
    ExternalLink,
    Lock,
    Sliders,
    Target,
    FileText,
    Plus,
    Wrench,
} from "lucide-react";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function RiskDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    const [risk, setRisk] = useState<RiskDetail | null>(null);
    const [timeline, setTimeline] = useState<RiskTimelineEvent[]>([]);
    const [activeTab, setActiveTab] = useState<
        "overview" | "matrix" | "treatments" | "exceptions" | "relationships" | "timeline"
    >("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [showInherentModal, setShowInherentModal] = useState(false);
    const [inhLikelihood, setInhLikelihood] = useState(3);
    const [inhImpact, setInhImpact] = useState(3);

    const [showResidualModal, setShowResidualModal] = useState(false);
    const [resLikelihood, setResLikelihood] = useState(2);
    const [resImpact, setResImpact] = useState(2);
    const [resControlsDesc, setResControlsDesc] = useState("");

    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [trtStrategy, setTrtStrategy] = useState<RiskTreatmentStrategy>("MITIGATE");
    const [trtDesc, setTrtDesc] = useState("");
    const [trtActions, setTrtActions] = useState("");
    const [trtTargetDate, setTrtTargetDate] = useState("");

    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [acceptJustification, setAcceptJustification] = useState("");
    const [acceptReviewDate, setAcceptReviewDate] = useState("");

    const [showExceptionModal, setShowExceptionModal] = useState(false);
    const [excTitle, setExcTitle] = useState("");
    const [excJustification, setExcJustification] = useState("");
    const [excExpiryDate, setExcExpiryDate] = useState("");
    const [showEscalateModal, setShowEscalateModal] = useState(false);

    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Permissions
    const canAssess = hasPermission(user, Permissions.RISK_ASSESS);
    const canTreat = hasPermission(user, Permissions.RISK_TREAT);
    const canAccept = hasPermission(user, Permissions.RISK_ACCEPT);
    const canUpdate = hasPermission(user, Permissions.RISK_UPDATE);
    const canClose = hasPermission(user, Permissions.RISK_CLOSE);
    const canCreateException = hasPermission(user, Permissions.RISK_EXCEPTION_CREATE);
    const canApproveException = hasPermission(user, Permissions.RISK_EXCEPTION_APPROVE);

    const loadRisk = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await risksApi.getById(id);
            setRisk(data);
            setInhLikelihood(data.likelihood);
            setInhImpact(data.impact);
            if (data.residual_likelihood) setResLikelihood(data.residual_likelihood);
            if (data.residual_impact) setResImpact(data.residual_impact);
            if (data.existing_controls_description) setResControlsDesc(data.existing_controls_description);
        } catch (err: any) {
            setError(err.message || "Failed to load risk dossier");
        } finally {
            setLoading(false);
        }
    };

    const loadTimeline = async () => {
        try {
            const events = await risksApi.getTimeline(id);
            setTimeline(events);
        } catch (err) {
            console.error("Failed to load timeline", err);
        }
    };

    useEffect(() => {
        loadRisk();
        loadTimeline();
    }, [id]);

    const isCreatorOrOwner =
        user && risk && (user.id === risk.identified_by_id || user.id === risk.owner_id);

    // Submit Inherent Assessment
    const handleSaveInherent = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionSubmitting(true);
        setModalError(null);
        try {
            await risksApi.assessInherent(id, {
                likelihood: Number(inhLikelihood),
                impact: Number(inhImpact),
            });
            setShowInherentModal(false);
            loadRisk();
            loadTimeline();
        } catch (err: any) {
            setModalError(err.message || "Failed to update inherent assessment");
        } finally {
            setActionSubmitting(false);
        }
    };

    // Submit Residual Assessment
    const handleSaveResidual = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionSubmitting(true);
        setModalError(null);
        try {
            await risksApi.assessResidual(id, {
                residual_likelihood: Number(resLikelihood),
                residual_impact: Number(resImpact),
                existing_controls_description: resControlsDesc.trim() || undefined,
            });
            setShowResidualModal(false);
            loadRisk();
            loadTimeline();
        } catch (err: any) {
            setModalError(err.message || "Failed to update residual assessment");
        } finally {
            setActionSubmitting(false);
        }
    };

    // Submit Treatment Decision
    const handleSaveTreatment = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionSubmitting(true);
        setModalError(null);
        try {
            await risksApi.decideTreatment(id, {
                strategy: trtStrategy,
                treatment_description: trtDesc.trim() || undefined,
                mitigation_actions: trtActions.trim() || undefined,
                target_date: trtTargetDate ? new Date(trtTargetDate).toISOString() : undefined,
            });
            setShowTreatmentModal(false);
            loadRisk();
            loadTimeline();
        } catch (err: any) {
            setModalError(err.message || "Failed to record treatment plan");
        } finally {
            setActionSubmitting(false);
        }
    };

    // Submit Risk Acceptance (SoD Enforced)
    const handleAcceptRisk = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptJustification.trim()) {
            setModalError("Acceptance justification is required.");
            return;
        }

        setActionSubmitting(true);
        setModalError(null);
        try {
            await risksApi.accept(id, {
                acceptance_justification: acceptJustification.trim(),
                review_date: acceptReviewDate ? new Date(acceptReviewDate).toISOString() : undefined,
            });
            setShowAcceptModal(false);
            loadRisk();
            loadTimeline();
        } catch (err: any) {
            setModalError(err.message || "Failed to accept risk");
        } finally {
            setActionSubmitting(false);
        }
    };

    // Submit Risk Exception
    const handleCreateException = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!excTitle.trim() || !excJustification.trim()) {
            setModalError("Title and justification are required.");
            return;
        }

        setActionSubmitting(true);
        setModalError(null);
        try {
            await risksApi.createException(id, {
                title: excTitle.trim(),
                justification: excJustification.trim(),
                expiry_date: excExpiryDate ? new Date(excExpiryDate).toISOString() : undefined,
            });
            setShowExceptionModal(false);
            setExcTitle("");
            setExcJustification("");
            loadRisk();
            loadTimeline();
        } catch (err: any) {
            setModalError(err.message || "Failed to request risk exception");
        } finally {
            setActionSubmitting(false);
        }
    };

    if (loading && !risk) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
                    <p className="text-xs text-zinc-400">Loading risk dossier...</p>
                </div>
            </div>
        );
    }

    if (!risk) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
                <div className="max-w-md mx-auto text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                    <h2 className="text-lg font-bold text-white">Risk Exposure Not Found</h2>
                    <p className="text-xs text-zinc-400">
                        {error || "The requested risk record could not be found or you lack permission to view it."}
                    </p>
                    <Link
                        href="/risks"
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Return to Risk Register</span>
                    </Link>
                </div>
            </div>
        );
    }

    const getLevelBadgeClass = (level: RiskLevel) => {
        switch (level) {
            case "CRITICAL":
                return "bg-rose-950/80 text-rose-300 border-rose-800 font-semibold";
            case "HIGH":
                return "bg-amber-950/80 text-amber-300 border-amber-800";
            case "MEDIUM":
                return "bg-yellow-950/60 text-yellow-300 border-yellow-800";
            case "LOW":
                return "bg-slate-900/60 text-slate-400 border-slate-700";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Breadcrumb & Navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Link href="/risks" className="hover:text-white transition">
                        Risks
                    </Link>
                    <span>/</span>
                    <span className="font-mono text-zinc-200">{risk.business_id}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            loadRisk();
                            loadTimeline();
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <Link
                        href="/risks"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Risks</span>
                    </Link>
                </div>
            </div>

            {/* Risk Header Card */}
            <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
                                {risk.business_id}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                                {risk.category}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${getLevelBadgeClass(
                                    risk.residual_risk_level || risk.inherent_risk_level
                                )}`}
                            >
                                {risk.residual_risk_level || risk.inherent_risk_level} EXPOSURE
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                                STATUS: {risk.status.replace(/_/g, " ")}
                            </span>
                            {risk.is_overdue && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>OVERDUE SLA</span>
                                </span>
                            )}
                        </div>

                        <h1 className="text-xl font-bold text-white tracking-tight">
                            {risk.title}
                        </h1>

                        <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed">
                            {risk.description || "No detailed threat narrative recorded."}
                        </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                        {canAssess && (
                            <button
                                onClick={() => {
                                    setShowInherentModal(true);
                                    setModalError(null);
                                }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5"
                            >
                                <Sliders className="w-3.5 h-3.5 text-yellow-400" />
                                <span>Assess Inherent</span>
                            </button>
                        )}

                        {canAssess && (
                            <button
                                onClick={() => {
                                    setShowResidualModal(true);
                                    setModalError(null);
                                }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5"
                            >
                                <Target className="w-3.5 h-3.5 text-blue-400" />
                                <span>Assess Residual</span>
                            </button>
                        )}

                        {canTreat && (
                            <button
                                onClick={() => {
                                    setShowTreatmentModal(true);
                                    setModalError(null);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center gap-1.5"
                            >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Treatment Plan</span>
                            </button>
                        )}

                        {canAccept && risk.status !== "ACCEPTED" && (
                            <div className="relative group">
                                <button
                                    disabled={Boolean(isCreatorOrOwner)}
                                    onClick={() => {
                                        setShowAcceptModal(true);
                                        setModalError(null);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Accept Risk</span>
                                </button>
                                {isCreatorOrOwner && (
                                    <div className="absolute right-0 top-full mt-1.5 w-64 p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[10px] text-amber-300 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                                        <div className="flex items-center gap-1 font-semibold mb-0.5">
                                            <Lock className="w-3 h-3" />
                                            <span>Separation of Duties (SoD)</span>
                                        </div>
                                        You are the creator or owner of this risk. Risk acceptance requires independent formal authorization.
                                    </div>
                                )}
                            </div>
                        )}

                        {canCreateException && (
                            <button
                                onClick={() => {
                                    setShowExceptionModal(true);
                                    setModalError(null);
                                }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition flex items-center gap-1.5"
                            >
                                <FileCheck className="w-3.5 h-3.5 text-purple-400" />
                                <span>Request Exception</span>
                            </button>
                        )}

                        <button
                            onClick={() => setShowEscalateModal(true)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition flex items-center gap-1.5"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Escalate to Supervision</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-zinc-800 flex items-center gap-1 text-xs font-medium">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`pb-2.5 px-3.5 border-b-2 transition ${
                        activeTab === "overview"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab("matrix")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "matrix"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>5×5 Matrix Visualizer</span>
                </button>
                <button
                    onClick={() => setActiveTab("treatments")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "treatments"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Treatments</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                        {risk.treatments.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("exceptions")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "exceptions"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Exceptions & Waivers</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                        {risk.exceptions.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("relationships")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "relationships"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Sources & Context</span>
                </button>
                <button
                    onClick={() => setActiveTab("timeline")}
                    className={`pb-2.5 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
                        activeTab === "timeline"
                            ? "border-rose-500 text-white font-semibold"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    <span>Audit Trail</span>
                </button>
            </div>

            {/* TAB: Overview (Comparative Inherent vs Residual Cards) */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        {/* Comparison Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Inherent Risk Card */}
                            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                        Inherent Risk (Pre-Control)
                                    </span>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getLevelBadgeClass(
                                            risk.inherent_risk_level
                                        )}`}
                                    >
                                        {risk.inherent_risk_level}
                                    </span>
                                </div>
                                <div className="text-3xl font-extrabold text-white">
                                    {risk.inherent_score}{" "}
                                    <span className="text-xs text-zinc-500 font-normal">/ 25</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                    <div>
                                        <span className="text-zinc-500 block">Likelihood:</span>
                                        <strong className="text-zinc-200">{risk.likelihood} / 5</strong>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block">Impact:</span>
                                        <strong className="text-zinc-200">{risk.impact} / 5</strong>
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-500 pt-1">
                                    Raw exposure baseline prior to application of safeguards.
                                </p>
                            </div>

                            {/* Residual Risk Card */}
                            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                        Residual Risk (Post-Control)
                                    </span>
                                    {risk.residual_risk_level ? (
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getLevelBadgeClass(
                                                risk.residual_risk_level
                                            )}`}
                                        >
                                            {risk.residual_risk_level}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-zinc-500 italic">Not evaluated</span>
                                    )}
                                </div>
                                <div className="text-3xl font-extrabold text-white">
                                    {risk.residual_score ?? "—"}{" "}
                                    <span className="text-xs text-zinc-500 font-normal">/ 25</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                    <div>
                                        <span className="text-zinc-500 block">Residual Likelihood:</span>
                                        <strong className="text-zinc-200">
                                            {risk.residual_likelihood ?? "—"} / 5
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block">Residual Impact:</span>
                                        <strong className="text-zinc-200">
                                            {risk.residual_impact ?? "—"} / 5
                                        </strong>
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-500 pt-1">
                                    Net exposure considering operational safeguards.
                                </p>
                            </div>
                        </div>

                        {/* Safeguards / Controls context */}
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Existing Controls & Safeguards Narrative
                            </h3>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                                {risk.existing_controls_description || (
                                    <span className="text-zinc-500 italic">
                                        No existing controls description recorded.
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Acceptance Justification If Accepted */}
                        {risk.status === "ACCEPTED" && (
                            <div className="bg-purple-950/30 border border-purple-900/60 rounded-xl p-5 space-y-3">
                                <div className="flex items-center justify-between border-b border-purple-900/40 pb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                        <span>Formal Risk Acceptance Statement</span>
                                    </h3>
                                    <span className="text-[10px] font-mono text-purple-400">
                                        Accepted: {risk.accepted_at ? new Date(risk.accepted_at).toLocaleDateString() : ""}
                                    </span>
                                </div>
                                <p className="text-xs text-purple-200 leading-relaxed">
                                    {risk.acceptance_justification}
                                </p>
                                <div className="text-[11px] text-purple-300/80 flex items-center justify-between pt-1">
                                    <span>Accepting Authority: <strong>{risk.accepted_by_name || "Supervisory Officer"}</strong></span>
                                    {risk.review_date && (
                                        <span>Next Mandatory Review: <strong>{new Date(risk.review_date).toLocaleDateString()}</strong></span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Personnel & Governance Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Governance & Ownership
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Risk Owner</span>
                                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                                        <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                                        <span>{risk.owner_name || "Unassigned"}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Identified By</span>
                                    <div className="flex items-center gap-2 text-zinc-300">
                                        <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{risk.identified_by_name || "System"}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Regulated Entity</span>
                                    <div className="flex items-center gap-2 text-zinc-300">
                                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{risk.organization_name || "Enterprise Wide"}</span>
                                    </div>
                                </div>

                                {risk.sector_name && (
                                    <div>
                                        <span className="text-zinc-500 block mb-0.5">Sector</span>
                                        <span className="text-zinc-300">{risk.sector_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Target & Review Dates
                            </h3>
                            <div className="space-y-2.5 text-xs text-zinc-300">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Target Resolution:</span>
                                    <span className="font-mono text-zinc-200">
                                        {risk.target_date ? new Date(risk.target_date).toLocaleDateString() : "None"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Scheduled Review:</span>
                                    <span className="font-mono text-zinc-200">
                                        {risk.review_date ? new Date(risk.review_date).toLocaleDateString() : "None"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: 5x5 Matrix Visualizer */}
            {activeTab === "matrix" && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4 max-w-4xl">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Activity className="w-4 h-4 text-rose-500" />
                                <span>5×5 Risk Matrix Position Tracker</span>
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Visualizing Inherent (I) vs Residual (R) coordinates on the standard 1–5 scoring plane
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-2 ring-white/50 text-[9px] font-bold flex items-center justify-center text-white">
                                    I
                                </span>
                                <span>Inherent ({risk.likelihood}, {risk.impact})</span>
                            </span>
                            {risk.residual_likelihood && risk.residual_impact && (
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-2 ring-white/50 text-[9px] font-bold flex items-center justify-center text-white">
                                        R
                                    </span>
                                    <span>Residual ({risk.residual_likelihood}, {risk.residual_impact})</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto pt-2">
                        <div className="min-w-[500px]">
                            <div className="grid grid-cols-6 gap-2 text-center text-xs">
                                <div className="font-semibold text-zinc-500 text-[11px] p-2 flex items-center justify-center">
                                    L \ I
                                </div>
                                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                    1 - Insignificant
                                </div>
                                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                    2 - Minor
                                </div>
                                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                    3 - Moderate
                                </div>
                                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                    4 - Major
                                </div>
                                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                    5 - Severe
                                </div>

                                {[5, 4, 3, 2, 1].map((l) => (
                                    <React.Fragment key={l}>
                                        <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px] flex items-center justify-center">
                                            {l}
                                        </div>
                                        {[1, 2, 3, 4, 5].map((i) => {
                                            const score = l * i;
                                            const isInherent = risk.likelihood === l && risk.impact === i;
                                            const isResidual = risk.residual_likelihood === l && risk.residual_impact === i;

                                            const levelClass =
                                                score >= 17
                                                    ? "bg-rose-950/60 border-rose-800 text-rose-300"
                                                    : score >= 10
                                                    ? "bg-amber-950/60 border-amber-800 text-amber-300"
                                                    : score >= 5
                                                    ? "bg-yellow-950/50 border-yellow-800 text-yellow-300"
                                                    : "bg-emerald-950/40 border-emerald-800 text-emerald-300";

                                            return (
                                                <div
                                                    key={`${l}-${i}`}
                                                    className={`h-16 rounded-lg border flex items-center justify-center relative transition ${levelClass}`}
                                                >
                                                    <span className="text-[10px] text-zinc-500 absolute top-1 left-1.5 font-mono">
                                                        {score}
                                                    </span>

                                                    <div className="flex items-center gap-1">
                                                        {isInherent && (
                                                            <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-extrabold flex items-center justify-center shadow-lg ring-2 ring-white">
                                                                I
                                                            </div>
                                                        )}
                                                        {isResidual && (
                                                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center shadow-lg ring-2 ring-white">
                                                                R
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Treatments */}
            {activeTab === "treatments" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">
                            Formulated Risk Treatments ({risk.treatments.length})
                        </h3>
                        {canTreat && (
                            <button
                                onClick={() => {
                                    setShowTreatmentModal(true);
                                    setModalError(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Treatment</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {risk.treatments.length === 0 ? (
                            <div className="col-span-2 py-12 text-center text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                                <Sliders className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
                                <p className="text-xs font-semibold text-zinc-400">No Treatment Plans Formulated</p>
                                <p className="text-[11px] text-zinc-500">
                                    Click "Add Treatment" to specify mitigation, transfer, or avoidance actions.
                                </p>
                            </div>
                        ) : (
                            risk.treatments.map((t) => (
                                <div
                                    key={t.id}
                                    className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-zinc-400">
                                                    {t.business_id}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800 uppercase">
                                                    {t.strategy}
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                                                    {t.status}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mt-1">{t.title}</h4>
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-300">{t.description}</p>

                                    {t.mitigation_actions && (
                                        <div className="text-xs bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/80 text-zinc-400 whitespace-pre-line font-mono">
                                            {t.mitigation_actions}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1 text-xs text-zinc-500 border-t border-zinc-800/60">
                                        <div className="flex items-center gap-3">
                                            <span>Owner: <strong className="text-zinc-300">{t.owner_name || "Unassigned"}</strong></span>
                                            {t.target_date && (
                                                <span>Target: <strong className="text-zinc-300">{new Date(t.target_date).toLocaleDateString()}</strong></span>
                                            )}
                                        </div>

                                        <Link
                                            href={`/remediations?create=true&risk_id=${risk.id}&risk_business_id=${risk.business_id}&risk_treatment_id=${t.id}&title=${encodeURIComponent(t.title)}`}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-500/50 px-2 py-0.5 rounded transition"
                                        >
                                            <Wrench className="w-3 h-3" />
                                            <span>Remediation Plan</span>
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Exceptions */}
            {activeTab === "exceptions" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">
                            Risk Exceptions & Policy Waivers ({risk.exceptions.length})
                        </h3>
                        {canCreateException && (
                            <button
                                onClick={() => {
                                    setShowExceptionModal(true);
                                    setModalError(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Request Exception</span>
                            </button>
                        )}
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                <tr>
                                    <th className="py-3 px-4">Exception ID & Title</th>
                                    <th className="py-3 px-4">Justification</th>
                                    <th className="py-3 px-4">Requested By</th>
                                    <th className="py-3 px-4">Expiry Date</th>
                                    <th className="py-3 px-4">Status & Reviewer</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {risk.exceptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                                            No exceptions requested for this risk.
                                        </td>
                                    </tr>
                                ) : (
                                    risk.exceptions.map((e) => (
                                        <tr key={e.id} className="hover:bg-zinc-850/50 transition">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-white">{e.title}</div>
                                                <div className="font-mono text-[11px] text-zinc-400">
                                                    {e.business_id}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 max-w-sm text-zinc-300 line-clamp-2">
                                                {e.justification}
                                            </td>

                                            <td className="py-3 px-4 text-zinc-300">
                                                {e.requested_by_name || "Unknown"}
                                            </td>

                                            <td className="py-3 px-4 font-mono text-zinc-400">
                                                {e.expiry_date ? new Date(e.expiry_date).toLocaleDateString() : "Indefinite"}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                                        e.status === "APPROVED"
                                                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                                            : e.status === "REJECTED"
                                                            ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                                            : "bg-purple-950/60 text-purple-400 border-purple-800"
                                                    }`}
                                                >
                                                    {e.status}
                                                </span>
                                                {e.approved_by_name && (
                                                    <div className="text-[10px] text-zinc-500 mt-0.5">
                                                        By: {e.approved_by_name}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: Sources & Context */}
            {activeTab === "relationships" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Linked Finding */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                            Originating Supervisory Finding
                        </span>
                        {risk.finding_id ? (
                            <div>
                                <div className="font-semibold text-white">{risk.finding_title}</div>
                                <div className="font-mono text-xs text-blue-400 mt-1">
                                    <Link href={`/findings/${risk.finding_id}`} className="hover:underline flex items-center gap-1">
                                        <span>{risk.finding_business_id}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">No finding directly attached.</span>
                        )}
                    </div>

                    {/* Linked Assessment */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                            Related Security Assessment
                        </span>
                        {risk.assessment_id ? (
                            <div>
                                <div className="font-semibold text-white">{risk.assessment_title}</div>
                                <div className="font-mono text-xs text-blue-400 mt-1">
                                    <Link href={`/assessments/${risk.assessment_id}`} className="hover:underline flex items-center gap-1">
                                        <span>{risk.assessment_business_id}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">No assessment directly attached.</span>
                        )}
                    </div>

                    {/* Linked Control */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                            Impacted Security Control
                        </span>
                        {risk.control_id ? (
                            <div>
                                <div className="font-semibold text-white">{risk.control_name}</div>
                                <div className="font-mono text-xs text-zinc-400 mt-1">
                                    {risk.control_business_id}
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">No specific control mapped.</span>
                        )}
                    </div>

                    {/* Linked CSE */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                            Originating Security Event (CSE)
                        </span>
                        {risk.cse_id ? (
                            <div>
                                <div className="font-semibold text-white">{risk.cse_title}</div>
                                <div className="font-mono text-xs text-blue-400 mt-1">
                                    <Link href={`/cse`} className="hover:underline flex items-center gap-1">
                                        <span>{risk.cse_business_id}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">No CSE directly attached.</span>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Audit Trail */}
            {activeTab === "timeline" && (
                <div className="space-y-4 max-w-3xl">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-rose-400" />
                        <span>Immutable Audit Trail & Timeline</span>
                    </h3>

                    <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                        {timeline.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-4">No audit events recorded yet.</div>
                        ) : (
                            timeline.map((evt) => (
                                <div key={evt.id} className="relative group">
                                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-zinc-950" />
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

            {/* Inherent Assessment Modal */}
            {showInherentModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-yellow-500" />
                                <span>Assess Inherent Risk (1–5)</span>
                            </h3>
                            <button
                                onClick={() => setShowInherentModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSaveInherent} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Likelihood (1–5)
                                    </label>
                                    <select
                                        value={inhLikelihood}
                                        onChange={(e) => setInhLikelihood(Number(e.target.value))}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200"
                                    >
                                        <option value={1}>1 - Rare</option>
                                        <option value={2}>2 - Unlikely</option>
                                        <option value={3}>3 - Possible</option>
                                        <option value={4}>4 - Likely</option>
                                        <option value={5}>5 - Almost Certain</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Impact (1–5)
                                    </label>
                                    <select
                                        value={inhImpact}
                                        onChange={(e) => setInhImpact(Number(e.target.value))}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200"
                                    >
                                        <option value={1}>1 - Insignificant</option>
                                        <option value={2}>2 - Minor</option>
                                        <option value={3}>3 - Moderate</option>
                                        <option value={4}>4 - Major</option>
                                        <option value={5}>5 - Severe</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                                <span className="text-xs text-zinc-400">Calculated Inherent Score: </span>
                                <strong className="text-sm text-white font-mono">{inhLikelihood * inhImpact} / 25</strong>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowInherentModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Calculating..." : "Save Assessment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Residual Assessment Modal */}
            {showResidualModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-500" />
                                <span>Assess Residual Risk (Post-Control)</span>
                            </h3>
                            <button
                                onClick={() => setShowResidualModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSaveResidual} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Residual Likelihood
                                    </label>
                                    <select
                                        value={resLikelihood}
                                        onChange={(e) => setResLikelihood(Number(e.target.value))}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200"
                                    >
                                        <option value={1}>1 - Rare</option>
                                        <option value={2}>2 - Unlikely</option>
                                        <option value={3}>3 - Possible</option>
                                        <option value={4}>4 - Likely</option>
                                        <option value={5}>5 - Almost Certain</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Residual Impact
                                    </label>
                                    <select
                                        value={resImpact}
                                        onChange={(e) => setResImpact(Number(e.target.value))}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200"
                                    >
                                        <option value={1}>1 - Insignificant</option>
                                        <option value={2}>2 - Minor</option>
                                        <option value={3}>3 - Moderate</option>
                                        <option value={4}>4 - Major</option>
                                        <option value={5}>5 - Severe</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Existing Controls Context
                                </label>
                                <textarea
                                    value={resControlsDesc}
                                    onChange={(e) => setResControlsDesc(e.target.value)}
                                    rows={2}
                                    placeholder="Explain how implemented controls mitigate raw likelihood or impact..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 resize-none"
                                />
                            </div>

                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                                <span className="text-xs text-zinc-400">Calculated Residual Score: </span>
                                <strong className="text-sm text-blue-400 font-mono">{resLikelihood * resImpact} / 25</strong>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowResidualModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Calculating..." : "Save Residual"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Treatment Decision Modal */}
            {showTreatmentModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-blue-500" />
                                <span>Formulate Risk Treatment Plan</span>
                            </h3>
                            <button
                                onClick={() => setShowTreatmentModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSaveTreatment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Treatment Strategy *
                                </label>
                                <select
                                    value={trtStrategy}
                                    onChange={(e) => setTrtStrategy(e.target.value as RiskTreatmentStrategy)}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                >
                                    <option value="MITIGATE">MITIGATE (Implement safeguards / technical controls)</option>
                                    <option value="ACCEPT">ACCEPT (Formal acceptance with justification)</option>
                                    <option value="TRANSFER">TRANSFER (Insurance, vendor liability, third-party)</option>
                                    <option value="AVOID">AVOID (Decommission asset / discontinue activity)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Treatment Description
                                </label>
                                <textarea
                                    value={trtDesc}
                                    onChange={(e) => setTrtDesc(e.target.value)}
                                    rows={2}
                                    placeholder="High-level treatment scope and intent..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Planned Action Items / Mitigation Steps
                                </label>
                                <textarea
                                    value={trtActions}
                                    onChange={(e) => setTrtActions(e.target.value)}
                                    rows={3}
                                    placeholder="1. Hardware token deployment&#10;2. Policy update&#10;3. Configuration change..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 font-mono resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Target Resolution Date
                                </label>
                                <input
                                    type="date"
                                    value={trtTargetDate}
                                    onChange={(e) => setTrtTargetDate(e.target.value)}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowTreatmentModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Formulating..." : "Save Treatment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Accept Risk Modal (SoD Enforced) */}
            {showAcceptModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                <span>Formally Accept Risk ({risk.business_id})</span>
                            </h3>
                            <button
                                onClick={() => setShowAcceptModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleAcceptRisk} className="space-y-4">
                            <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/40 text-xs text-purple-300">
                                <strong>Separation of Duties Verification:</strong> You are submitting formal risk acceptance as an independent authority. Your identity and justification will be immutably recorded.
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Formal Acceptance Justification *
                                </label>
                                <textarea
                                    value={acceptJustification}
                                    onChange={(e) => setAcceptJustification(e.target.value)}
                                    rows={4}
                                    placeholder="Explain business justification, compensating controls, or temporary contractual dependencies..."
                                    required
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 resize-none focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Mandatory Review Date (SLA)
                                </label>
                                <input
                                    type="date"
                                    value={acceptReviewDate}
                                    onChange={(e) => setAcceptReviewDate(e.target.value)}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAcceptModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Authorizing..." : "Confirm Acceptance"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Request Exception Modal */}
            {showExceptionModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FileCheck className="w-4 h-4 text-purple-400" />
                                <span>Request Policy Exception / Waiver</span>
                            </h3>
                            <button
                                onClick={() => setShowExceptionModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleCreateException} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Exception Title *
                                </label>
                                <input
                                    type="text"
                                    value={excTitle}
                                    onChange={(e) => setExcTitle(e.target.value)}
                                    placeholder="e.g. Temporary Protocol Waiver for Ingress Ciphers"
                                    required
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Justification & Operational Scope *
                                </label>
                                <textarea
                                    value={excJustification}
                                    onChange={(e) => setExcJustification(e.target.value)}
                                    rows={4}
                                    placeholder="Provide detailed justification for the exception and compensating controls..."
                                    required
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 resize-none focus:border-purple-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Requested Expiry Date
                                </label>
                                <input
                                    type="date"
                                    value={excExpiryDate}
                                    onChange={(e) => setExcExpiryDate(e.target.value)}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowExceptionModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionSubmitting}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {actionSubmitting ? "Requesting..." : "Submit Exception"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {risk && (
                <EscalateModal
                    isOpen={showEscalateModal}
                    onClose={() => setShowEscalateModal(false)}
                    resourceType="RISK"
                    resourceId={risk.id}
                    resourceBusinessId={risk.business_id}
                    resourceTitle={risk.title}
                    onSuccess={() => {
                        loadRisk();
                        loadTimeline();
                    }}
                />
            )}
        </div>
    );
}
