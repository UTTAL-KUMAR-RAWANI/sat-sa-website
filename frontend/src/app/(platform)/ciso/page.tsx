"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    ExecutiveApi,
    CISOSummaryResponse,
    ExecutiveRiskOverview,
    ExecutiveFindingsOverview,
    ExecutiveRemediationOverview,
    ExecutiveAssessmentOverview,
    ExecutiveNegativeSpaceOverview,
    ExecutiveSupervisionOverview,
    ExecutiveTrendsResponse,
    ExecutiveComparisonResponse,
} from "@/lib/api/executive";
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    Activity,
    FileWarning,
    Wrench,
    ClipboardCheck,
    EyeOff,
    Gavel,
    Download,
    RefreshCw,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Building2,
    Layers,
    Info,
    ChevronRight,
    AlertCircle,
} from "lucide-react";

export default function CISODashboardPage() {
    const { user } = useAuth();

    const [summary, setSummary] = useState<CISOSummaryResponse | null>(null);
    const [risks, setRisks] = useState<ExecutiveRiskOverview | null>(null);
    const [findings, setFindings] = useState<ExecutiveFindingsOverview | null>(null);
    const [remediation, setRemediation] = useState<ExecutiveRemediationOverview | null>(null);
    const [assessments, setAssessments] = useState<ExecutiveAssessmentOverview | null>(null);
    const [negativeSpace, setNegativeSpace] = useState<ExecutiveNegativeSpaceOverview | null>(null);
    const [supervision, setSupervision] = useState<ExecutiveSupervisionOverview | null>(null);
    const [trends, setTrends] = useState<ExecutiveTrendsResponse | null>(null);
    const [comparison, setComparison] = useState<ExecutiveComparisonResponse | null>(null);

    const [trendDays, setTrendDays] = useState<number>(30);
    const [activeTab, setActiveTab] = useState<"overview" | "risks" | "findings" | "remediation" | "assessments" | "negative-space" | "supervision">("overview");
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const canExport = user ? hasPermission(user, Permissions.EXECUTIVE_EXPORT) : false;

    const loadAllData = async (days: number = trendDays) => {
        setLoading(true);
        setError(null);
        try {
            const [
                sumData,
                riskData,
                fndData,
                remData,
                asmtData,
                nsData,
                supData,
                trendData,
                compData,
            ] = await Promise.all([
                ExecutiveApi.getCISOSummary(),
                ExecutiveApi.getCISORisks(),
                ExecutiveApi.getCISOFindings(),
                ExecutiveApi.getCISORemediation(),
                ExecutiveApi.getCISOAssessments(),
                ExecutiveApi.getCISONegativeSpace(),
                ExecutiveApi.getCISOSupervision(),
                ExecutiveApi.getCISOTrends(days),
                ExecutiveApi.getComparison().catch(() => null),
            ]);

            setSummary(sumData);
            setRisks(riskData);
            setFindings(fndData);
            setRemediation(remData);
            setAssessments(asmtData);
            setNegativeSpace(nsData);
            setSupervision(supData);
            setTrends(trendData);
            setComparison(compData);
        } catch (err: any) {
            console.error("Failed to load CISO dashboard data:", err);
            setError(err.message || "Failed to load executive leadership data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData(trendDays);
    }, [trendDays]);

    const handleExportCSV = async () => {
        if (!canExport) return;
        setExporting(true);
        setSuccessMessage(null);
        try {
            const blob = await ExecutiveApi.downloadSummaryCSV();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `sat_sa_ciso_executive_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setSuccessMessage("Executive summary CSV exported and audit logged successfully.");
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            setError(err.message || "Export failed.");
        } finally {
            setExporting(false);
        }
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return "text-slate-500";
        if (score >= 85) return "text-emerald-400";
        if (score >= 70) return "text-teal-400";
        if (score >= 50) return "text-amber-400";
        return "text-rose-500";
    };

    const getScoreBadge = (score: number | null) => {
        if (score === null) return { label: "Unavailable", bg: "bg-slate-800 text-slate-400 border-slate-700" };
        if (score >= 85) return { label: "Excellent Posture", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
        if (score >= 70) return { label: "Adequate Posture", bg: "bg-teal-500/10 text-teal-400 border-teal-500/30" };
        if (score >= 50) return { label: "Needs Remediation", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
        return { label: "Critical Exposure", bg: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
            {/* Top Navigation / Breadcrumbs */}
            <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-16 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                            <span>Platform</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-emerald-400 font-medium">Executive Leadership</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-white">CISO Overview</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                            <ShieldCheck className="h-7 w-7 text-emerald-400" />
                            CISO Leadership Dashboard
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {summary && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
                                Scope: {summary.effective_scope}
                            </span>
                        )}

                        <button
                            onClick={() => loadAllData(trendDays)}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </button>

                        {canExport && (
                            <button
                                onClick={handleExportCSV}
                                disabled={exporting}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                                <Download className="h-3.5 w-3.5" />
                                {exporting ? "Exporting..." : "Export CSV"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Notification Messages */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                {error && (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-rose-200">Executive Query Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-sm flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-emerald-200">Export Completed</p>
                            <p>{successMessage}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-8">
                {/* 1. HERO: SECURITY POSTURE SCORE CARD */}
                {summary?.posture && (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Score Gauge Display */}
                            <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 text-center">
                                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">
                                    Authoritative Posture Score
                                </span>
                                
                                {summary.posture.is_available ? (
                                    <div className="relative flex flex-col items-center my-2">
                                        <div className={`text-6xl font-black tracking-tight ${getScoreColor(summary.posture.overall_score)}`}>
                                            {summary.posture.overall_score}
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium mt-1">out of 100</span>
                                        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold border ${getScoreBadge(summary.posture.overall_score).bg}`}>
                                            {getScoreBadge(summary.posture.overall_score).label}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 my-2 text-center">
                                        <div className="text-slate-500 font-bold text-lg mb-1">Posture Unavailable</div>
                                        <p className="text-xs text-slate-400 max-w-xs">
                                            Insufficient telemetry or security entities within this scope to compute an explainable score.
                                        </p>
                                    </div>
                                )}

                                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed max-w-xs">
                                    {summary.posture.explanation}
                                </p>
                            </div>

                            {/* Sub-Score Breakdown */}
                            <div className="lg:col-span-8 flex flex-col justify-between h-full space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                                            Posture Sub-Score Components & Weights
                                        </h2>
                                        <span className="text-xs text-slate-400">Deterministic Weighted Model</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                        {/* Risk (25%) */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                <span>Risk (25%)</span>
                                                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                                            </div>
                                            <div className={`text-xl font-bold ${getScoreColor(summary.posture.risk_subscore)}`}>
                                                {summary.posture.risk_subscore !== null ? `${summary.posture.risk_subscore}` : "N/A"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">Active risk severity</div>
                                        </div>

                                        {/* Findings (25%) */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                <span>Findings (25%)</span>
                                                <FileWarning className="h-3.5 w-3.5 text-amber-400" />
                                            </div>
                                            <div className={`text-xl font-bold ${getScoreColor(summary.posture.findings_subscore)}`}>
                                                {summary.posture.findings_subscore !== null ? `${summary.posture.findings_subscore}` : "N/A"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">Open vulnerabilities</div>
                                        </div>

                                        {/* Remediation (20%) */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                <span>Remediation (20%)</span>
                                                <Wrench className="h-3.5 w-3.5 text-teal-400" />
                                            </div>
                                            <div className={`text-xl font-bold ${getScoreColor(summary.posture.remediation_subscore)}`}>
                                                {summary.posture.remediation_subscore !== null ? `${summary.posture.remediation_subscore}` : "N/A"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">SLA velocity</div>
                                        </div>

                                        {/* Assessments (15%) */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                <span>Controls (15%)</span>
                                                <ClipboardCheck className="h-3.5 w-3.5 text-sky-400" />
                                            </div>
                                            <div className={`text-xl font-bold ${getScoreColor(summary.posture.assessments_subscore)}`}>
                                                {summary.posture.assessments_subscore !== null ? `${summary.posture.assessments_subscore}` : "N/A"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">Control efficacy</div>
                                        </div>

                                        {/* Detection Coverage (15%) */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                <span>Coverage (15%)</span>
                                                <EyeOff className="h-3.5 w-3.5 text-violet-400" />
                                            </div>
                                            <div className={`text-xl font-bold ${getScoreColor(summary.posture.negative_space_subscore)}`}>
                                                {summary.posture.negative_space_subscore !== null ? `${summary.posture.negative_space_subscore}` : "N/A"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">Negative space</div>
                                        </div>
                                    </div>
                                </div>

                                {summary.posture.missing_reasons && summary.posture.missing_reasons.length > 0 && (
                                    <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2">
                                        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Sub-score telemetry gaps: </span>
                                            {summary.posture.missing_reasons.join(" • ")}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. EXECUTIVE ATTENTION REQUIRED (ACTION QUEUE) */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle className="h-5 w-5 text-rose-400" />
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Prioritized Attention Required
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                {summary?.attention_required?.length || 0} Critical Items
                            </span>
                        </div>
                        <span className="text-xs text-slate-400">
                            Critical risks, overdue remediations, escalations & telemetry gaps
                        </span>
                    </div>

                    {summary?.attention_required && summary.attention_required.length > 0 ? (
                        <div className="divide-y divide-slate-800/80">
                            {summary.attention_required.map((item) => (
                                <div
                                    key={`${item.item_type}-${item.id}`}
                                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 px-3 rounded-lg transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border shrink-0 mt-0.5 ${
                                                item.severity === "CRITICAL"
                                                    ? "bg-rose-500/20 text-rose-300 border-rose-600/40"
                                                    : item.severity === "HIGH"
                                                    ? "bg-amber-500/20 text-amber-300 border-amber-600/40"
                                                    : "bg-slate-800 text-slate-300 border-slate-700"
                                            }`}
                                        >
                                            {item.item_type}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-slate-400">
                                                    {item.business_id}
                                                </span>
                                                <span className="text-sm font-semibold text-white">
                                                    {item.title}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {item.reason} {item.due_date && `• Due: ${new Date(item.due_date).toLocaleDateString()}`}
                                                {item.owner && ` • Assigned: ${item.owner}`}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={item.action_url}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline shrink-0"
                                    >
                                        Take Action
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                            No critical escalations or overdue remediation blockers currently requiring immediate executive attention.
                        </div>
                    )}
                </div>

                {/* 3. OPERATIONAL DEEP DIVES TABS */}
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
                        <button
                            onClick={() => setActiveTab("overview")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "overview"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Executive Grid
                        </button>
                        <button
                            onClick={() => setActiveTab("risks")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "risks"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Risks & GRC
                        </button>
                        <button
                            onClick={() => setActiveTab("findings")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "findings"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Findings & Aging
                        </button>
                        <button
                            onClick={() => setActiveTab("remediation")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "remediation"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Remediations
                        </button>
                        <button
                            onClick={() => setActiveTab("assessments")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "assessments"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Assessments
                        </button>
                        <button
                            onClick={() => setActiveTab("negative-space")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "negative-space"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Negative-Space
                        </button>
                        <button
                            onClick={() => setActiveTab("supervision")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                activeTab === "supervision"
                                    ? "bg-emerald-600 text-slate-950 shadow-md"
                                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                            }`}
                        >
                            Supervision
                        </button>
                    </div>

                    {/* TAB: OVERVIEW KPI TILES */}
                    {activeTab === "overview" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Open Risks */}
                            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition">
                                <div className="flex items-center justify-between text-slate-400 mb-2">
                                    <span className="text-xs uppercase font-semibold">Active Risks</span>
                                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                                </div>
                                <div className="text-3xl font-bold text-white">{summary?.open_risks_count ?? 0}</div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                                    <span className="text-rose-400 font-semibold">{summary?.critical_risks_count ?? 0} Critical</span>
                                    <Link href="/risks" className="text-emerald-400 hover:underline">View GRC</Link>
                                </div>
                            </div>

                            {/* Card 2: Open Findings */}
                            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition">
                                <div className="flex items-center justify-between text-slate-400 mb-2">
                                    <span className="text-xs uppercase font-semibold">Open Findings</span>
                                    <FileWarning className="h-4 w-4 text-amber-400" />
                                </div>
                                <div className="text-3xl font-bold text-white">{summary?.open_findings_count ?? 0}</div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                                    <span className="text-amber-400 font-semibold">{summary?.critical_findings_count ?? 0} Critical</span>
                                    <Link href="/findings" className="text-emerald-400 hover:underline">View Findings</Link>
                                </div>
                            </div>

                            {/* Card 3: Remediation Completion % */}
                            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition">
                                <div className="flex items-center justify-between text-slate-400 mb-2">
                                    <span className="text-xs uppercase font-semibold">Remediation Velocity</span>
                                    <Wrench className="h-4 w-4 text-teal-400" />
                                </div>
                                <div className="text-3xl font-bold text-teal-400">{summary?.remediation_completion_pct ?? 0}%</div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                                    <span className="text-rose-400 font-semibold">{summary?.overdue_remediations_count ?? 0} Overdue</span>
                                    <Link href="/remediations" className="text-emerald-400 hover:underline">Remediation</Link>
                                </div>
                            </div>

                            {/* Card 4: Negative Space Signals */}
                            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition">
                                <div className="flex items-center justify-between text-slate-400 mb-2">
                                    <span className="text-xs uppercase font-semibold">Detection Gaps</span>
                                    <EyeOff className="h-4 w-4 text-violet-400" />
                                </div>
                                <div className="text-3xl font-bold text-violet-400">{summary?.negative_space_coverage_gaps ?? 0}</div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                                    <span className="text-violet-300 font-semibold">{summary?.negative_space_high_signals ?? 0} High/Crit Signals</span>
                                    <Link href="/negative-space" className="text-emerald-400 hover:underline">Negative Space</Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: RISKS & GRC */}
                    {activeTab === "risks" && risks && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-rose-400" />
                                Risk Profile & Treatment Governance
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                                    <div className="text-xs text-slate-400">Critical Risks</div>
                                    <div className="text-2xl font-bold text-rose-400 mt-1">{risks.by_level["CRITICAL"] || 0}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                                    <div className="text-xs text-slate-400">High Risks</div>
                                    <div className="text-2xl font-bold text-amber-400 mt-1">{risks.by_level["HIGH"] || 0}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                                    <div className="text-xs text-slate-400">Requiring Treatment</div>
                                    <div className="text-2xl font-bold text-teal-400 mt-1">{risks.requiring_treatment}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                                    <div className="text-xs text-slate-400">Open Exceptions</div>
                                    <div className="text-2xl font-bold text-sky-400 mt-1">{risks.open_exceptions}</div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                    Distribution by Risk Category
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(risks.by_category).map(([cat, cnt]) => (
                                        <div key={cat} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                                            <span className="text-slate-300 font-medium">{cat}</span>
                                            <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800">{cnt}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: FINDINGS & AGING */}
                    {activeTab === "findings" && findings && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FileWarning className="h-5 w-5 text-amber-400" />
                                Security Findings Exposure & Aging
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Aging &gt; 30 Days</div>
                                    <div className="text-2xl font-bold text-amber-400 mt-1">{findings.aging_over_30d}</div>
                                    <div className="text-[11px] text-slate-400 mt-1">Vulnerabilities unaddressed past standard 30d SLA</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Aging &gt; 60 Days</div>
                                    <div className="text-2xl font-bold text-orange-400 mt-1">{findings.aging_over_60d}</div>
                                    <div className="text-[11px] text-slate-400 mt-1">Severe escalation threshold exceeded</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Aging &gt; 90 Days</div>
                                    <div className="text-2xl font-bold text-rose-500 mt-1">{findings.aging_over_90d}</div>
                                    <div className="text-[11px] text-slate-400 mt-1">Non-compliant critical supervisory risk</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                <div>
                                    <span className="font-semibold text-white">Negative Space Derived Findings: </span>
                                    <span className="text-violet-400 font-bold ml-1">{findings.negative_space_findings}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Active Remediation Required: </span>
                                    <span className="text-teal-400 font-bold ml-1">{findings.requiring_remediation}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: REMEDIATIONS */}
                    {activeTab === "remediation" && remediation && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Wrench className="h-5 w-5 text-teal-400" />
                                Strategic Remediation Pipeline
                            </h3>

                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-300">Overall Remediation Completion</span>
                                    <span className="font-bold text-teal-400">{remediation.completion_rate_pct}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all"
                                        style={{ width: `${remediation.completion_rate_pct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Overdue SLA</div>
                                    <div className="text-2xl font-bold text-rose-400 mt-1">{remediation.overdue_count}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Blocked Items</div>
                                    <div className="text-2xl font-bold text-amber-400 mt-1">{remediation.blocked_count}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Awaiting Validation</div>
                                    <div className="text-2xl font-bold text-sky-400 mt-1">{remediation.awaiting_validation}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: ASSESSMENTS */}
                    {activeTab === "assessments" && assessments && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-sky-400" />
                                Assessment & Control Effectiveness
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Completed Assessments</div>
                                    <div className="text-2xl font-bold text-emerald-400 mt-1">{assessments.assessments_completed}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">In Progress</div>
                                    <div className="text-2xl font-bold text-sky-400 mt-1">{assessments.assessments_in_progress}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Compliance Rate</div>
                                    <div className="text-2xl font-bold text-teal-400 mt-1">
                                        {assessments.compliance_score_pct !== null ? `${assessments.compliance_score_pct}%` : "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: NEGATIVE-SPACE */}
                    {activeTab === "negative-space" && negativeSpace && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <EyeOff className="h-5 w-5 text-violet-400" />
                                Negative-Space Telemetry & Detection Coverage
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Coverage Gaps</div>
                                    <div className="text-2xl font-bold text-rose-400 mt-1">{negativeSpace.coverage_gaps_count}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">High / Crit Signals</div>
                                    <div className="text-2xl font-bold text-violet-400 mt-1">{negativeSpace.high_critical_signals}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Telemetry Silences</div>
                                    <div className="text-2xl font-bold text-amber-400 mt-1">{negativeSpace.telemetry_silence_count}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Unmonitored Assets</div>
                                    <div className="text-2xl font-bold text-sky-400 mt-1">{negativeSpace.unmonitored_assets_count}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: SUPERVISION */}
                    {activeTab === "supervision" && supervision && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Gavel className="h-5 w-5 text-indigo-400" />
                                Supervisory Authority Cases & Regulatory Escalations
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Open Cases</div>
                                    <div className="text-2xl font-bold text-white mt-1">{supervision.open_cases}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Critical Escalations</div>
                                    <div className="text-2xl font-bold text-rose-400 mt-1">{supervision.critical_escalations}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Pending Decisions</div>
                                    <div className="text-2xl font-bold text-amber-400 mt-1">{supervision.pending_decisions}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-xs text-slate-400">Under Monitoring</div>
                                    <div className="text-2xl font-bold text-sky-400 mt-1">{supervision.cases_under_monitoring}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. REAL HISTORICAL TRENDS SECTION */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-teal-400" />
                                Historical Posture & Exposure Trajectory
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Empirically derived trend trajectory based strictly on verifiable timestamped records.
                            </p>
                        </div>

                        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 self-start">
                            {[7, 30, 90].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setTrendDays(d)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                                        trendDays === d
                                            ? "bg-slate-800 text-emerald-400 shadow-sm"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {d} Days
                                </button>
                            ))}
                        </div>
                    </div>

                    {trends?.has_data ? (
                        <div className="space-y-4">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-slate-950/60 uppercase text-[10px] text-slate-400 tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-4">Timestamp</th>
                                            <th className="py-2.5 px-4">Posture Score</th>
                                            <th className="py-2.5 px-4">Open Findings</th>
                                            <th className="py-2.5 px-4">Critical Risks</th>
                                            <th className="py-2.5 px-4">Open Remediations</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {trends.points.map((pt, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30">
                                                <td className="py-2.5 px-4 font-mono text-slate-400">{pt.timestamp}</td>
                                                <td className="py-2.5 px-4 font-bold text-emerald-400">{pt.posture_score ?? "N/A"}</td>
                                                <td className="py-2.5 px-4">{pt.open_findings}</td>
                                                <td className="py-2.5 px-4 text-rose-400 font-semibold">{pt.critical_risks}</td>
                                                <td className="py-2.5 px-4">{pt.open_remediations}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center space-y-2">
                            <Clock className="h-7 w-7 text-slate-500 mx-auto" />
                            <div className="text-sm font-semibold text-slate-300">
                                Insufficient historical data
                            </div>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                Historical trend lines require at least two distinct time intervals of operational telemetry. SAT-SA never synthesizes artificial trend curves; historical points will naturally emerge as operational data accumulates over time.
                            </p>
                        </div>
                    )}
                </div>

                {/* 5. COMPARATIVE BREAKDOWN (ENTERPRISE / SECTOR SCOPE) */}
                {comparison && (
                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-6">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-sky-400" />
                                Multi-Entity Security Posture Comparison
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Cross-entity comparative benchmarking within effective scope ({comparison.effective_scope}).
                            </p>
                        </div>

                        {comparison.organizations && comparison.organizations.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Organizations ({comparison.organizations.length})
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-950/60 uppercase text-[10px] text-slate-400 tracking-wider">
                                            <tr>
                                                <th className="py-2.5 px-4">Organization</th>
                                                <th className="py-2.5 px-4">Sector</th>
                                                <th className="py-2.5 px-4">Posture Score</th>
                                                <th className="py-2.5 px-4">Open Findings</th>
                                                <th className="py-2.5 px-4">Critical Risks</th>
                                                <th className="py-2.5 px-4">Overdue Remediations</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {comparison.organizations.map((org) => (
                                                <tr key={org.id} className="hover:bg-slate-800/30">
                                                    <td className="py-2.5 px-4 font-medium text-white">{org.name}</td>
                                                    <td className="py-2.5 px-4 text-slate-400">{org.sector_name || "—"}</td>
                                                    <td className="py-2.5 px-4 font-bold text-emerald-400">{org.posture_score ?? "Unavailable"}</td>
                                                    <td className="py-2.5 px-4">{org.open_findings}</td>
                                                    <td className="py-2.5 px-4 text-rose-400 font-semibold">{org.critical_risks}</td>
                                                    <td className="py-2.5 px-4 text-amber-400">{org.overdue_remediations}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
