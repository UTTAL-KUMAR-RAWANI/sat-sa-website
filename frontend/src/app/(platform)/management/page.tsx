"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    ExecutiveApi,
    ManagementSummaryResponse,
    ExecutiveRiskOverview,
    ExecutiveRemediationOverview,
    AttentionRequiredItem,
    ExecutiveTrendsResponse,
    ExecutiveComparisonResponse,
} from "@/lib/api/executive";
import {
    Briefcase,
    Shield,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    TrendingUp,
    Download,
    RefreshCw,
    Building2,
    ArrowUpRight,
    Wrench,
    FileWarning,
    AlertCircle,
    ChevronRight,
    Layers,
    Info,
} from "lucide-react";

export default function ManagementDashboardPage() {
    const { user } = useAuth();

    const [summary, setSummary] = useState<ManagementSummaryResponse | null>(null);
    const [risks, setRisks] = useState<ExecutiveRiskOverview | null>(null);
    const [remediation, setRemediation] = useState<ExecutiveRemediationOverview | null>(null);
    const [issues, setIssues] = useState<AttentionRequiredItem[]>([]);
    const [trends, setTrends] = useState<ExecutiveTrendsResponse | null>(null);
    const [comparison, setComparison] = useState<ExecutiveComparisonResponse | null>(null);

    const [trendDays, setTrendDays] = useState<number>(30);
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
                remData,
                issueData,
                trendData,
                compData,
            ] = await Promise.all([
                ExecutiveApi.getManagementSummary(),
                ExecutiveApi.getManagementRisks(),
                ExecutiveApi.getManagementRemediation(),
                ExecutiveApi.getManagementIssues(),
                ExecutiveApi.getManagementTrends(days),
                ExecutiveApi.getComparison().catch(() => null),
            ]);

            setSummary(sumData);
            setRisks(riskData);
            setRemediation(remData);
            setIssues(issueData);
            setTrends(trendData);
            setComparison(compData);
        } catch (err: any) {
            console.error("Failed to load Management dashboard data:", err);
            setError(err.message || "Failed to load senior management risk data");
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
            a.download = `sat_sa_management_briefing_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setSuccessMessage("Management briefing CSV exported and audit logged successfully.");
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            setError(err.message || "Export failed.");
        } finally {
            setExporting(false);
        }
    };

    const getRiskRatingBadge = (rating: string) => {
        switch (rating?.toUpperCase()) {
            case "CRITICAL":
                return {
                    label: "Critical Business Risk",
                    color: "bg-rose-500/20 text-rose-400 border-rose-500/40",
                    border: "border-rose-800/80",
                };
            case "HIGH":
                return {
                    label: "High Business Risk",
                    color: "bg-amber-500/20 text-amber-400 border-amber-500/40",
                    border: "border-amber-800/80",
                };
            case "MODERATE":
                return {
                    label: "Moderate Business Risk",
                    color: "bg-teal-500/20 text-teal-400 border-teal-500/40",
                    border: "border-teal-800/80",
                };
            case "LOW":
            default:
                return {
                    label: "Low Strategic Risk",
                    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                    border: "border-emerald-800/80",
                };
        }
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return "text-slate-500";
        if (score >= 85) return "text-emerald-400";
        if (score >= 70) return "text-teal-400";
        if (score >= 50) return "text-amber-400";
        return "text-rose-500";
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
                            <span className="text-sky-400 font-medium">Strategic Governance</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-white">Senior Management</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                            <Briefcase className="h-7 w-7 text-sky-400" />
                            Senior Management & Board Risk Dashboard
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
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-slate-950 rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                                <Download className="h-3.5 w-3.5" />
                                {exporting ? "Exporting..." : "Export Briefing CSV"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                {error && (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-rose-200">Management Query Error</p>
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
                {/* 1. HERO: BUSINESS RISK EXPOSURE & STRATEGIC RATING */}
                {summary && (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Business Risk Rating Banner */}
                            <div className="lg:col-span-4 p-6 bg-slate-950/70 rounded-xl border border-slate-800/80 text-center space-y-3">
                                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                                    Overall Business Risk Rating
                                </span>
                                <div className="text-3xl font-black text-white tracking-tight">
                                    {summary.business_risk_rating}
                                </div>
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getRiskRatingBadge(summary.business_risk_rating).color}`}>
                                    {getRiskRatingBadge(summary.business_risk_rating).label}
                                </div>

                                <div className="pt-4 border-t border-slate-800/60 mt-4">
                                    <div className="text-xs text-slate-400 mb-1">Underlying Security Posture</div>
                                    <div className={`text-3xl font-extrabold ${getScoreColor(summary.posture.overall_score)}`}>
                                        {summary.posture.is_available ? `${summary.posture.overall_score} / 100` : "Unavailable"}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        {summary.posture.explanation}
                                    </div>
                                </div>
                            </div>

                            {/* Strategic Risk Overview Cards */}
                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold uppercase">Critical Risks</span>
                                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                                    </div>
                                    <div className="text-3xl font-black text-rose-400">
                                        {summary.critical_risks_count}
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {summary.high_risks_count} high-severity operational risks also active
                                    </p>
                                </div>

                                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold uppercase">Remediation Velocity</span>
                                        <Wrench className="h-4 w-4 text-teal-400" />
                                    </div>
                                    <div className="text-3xl font-black text-teal-400">
                                        {summary.remediation_completion_pct}%
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {summary.overdue_remediations_count} items overdue past SLA commitments
                                    </p>
                                </div>

                                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold uppercase">Regulatory Escalations</span>
                                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <div className="text-3xl font-black text-amber-400">
                                        {summary.critical_escalations_count}
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Escalations requiring supervisory authority oversight
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. MAJOR ISSUES MATRIX (ACTION QUEUE FOR SENIOR LEADERSHIP) */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Major Strategic Issues Requiring Executive Awareness
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {issues.length} Items
                            </span>
                        </div>
                        <span className="text-xs text-slate-400">
                            High-impact blockers, SLA breaches, and supervisory escalations
                        </span>
                    </div>

                    {issues.length > 0 ? (
                        <div className="divide-y divide-slate-800/80">
                            {issues.map((item) => (
                                <div
                                    key={`${item.item_type}-${item.id}`}
                                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 px-3 rounded-lg transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border shrink-0 mt-0.5 ${
                                                item.severity === "CRITICAL"
                                                    ? "bg-rose-500/20 text-rose-300 border-rose-600/40"
                                                    : "bg-amber-500/20 text-amber-300 border-amber-600/40"
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
                                                {item.owner && ` • Owner: ${item.owner}`}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={item.action_url}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline shrink-0"
                                    >
                                        Review Details
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                            No major strategic blockers or severe supervisory issues currently pending leadership intervention.
                        </div>
                    )}
                </div>

                {/* 3. BUSINESS RISK BY CATEGORY & REMEDIATION PIPELINE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Strategic Risk Category Breakdown */}
                    {risks && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-rose-400" />
                                    Risk Exposure by Business Domain
                                </h3>
                                <Link href="/risks" className="text-xs text-sky-400 hover:underline">
                                    Full Risk Register &rarr;
                                </Link>
                            </div>

                            <div className="space-y-2.5">
                                {Object.entries(risks.by_category).length > 0 ? (
                                    Object.entries(risks.by_category).map(([cat, count]) => (
                                        <div key={cat} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-200">{cat}</span>
                                            <span className="font-bold text-white px-2.5 py-0.5 rounded-full bg-slate-800">
                                                {count} {count === 1 ? "Risk" : "Risks"}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-500 text-xs">
                                        No active categorized risks in scope.
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center text-xs">
                                <div>
                                    <span className="text-slate-400">Under Treatment</span>
                                    <div className="text-base font-bold text-teal-400 mt-0.5">{risks.requiring_treatment}</div>
                                </div>
                                <div>
                                    <span className="text-slate-400">Accepted Risks</span>
                                    <div className="text-base font-bold text-amber-400 mt-0.5">{risks.accepted_risks}</div>
                                </div>
                                <div>
                                    <span className="text-slate-400">Exceptions</span>
                                    <div className="text-base font-bold text-sky-400 mt-0.5">{risks.open_exceptions}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Strategic Remediation Velocity */}
                    {remediation && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Wrench className="h-5 w-5 text-teal-400" />
                                    Remediation Execution Velocity
                                </h3>
                                <Link href="/remediations" className="text-xs text-sky-400 hover:underline">
                                    Remediation Pipeline &rarr;
                                </Link>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-300">Overall SLA Completion Rate</span>
                                    <span className="font-bold text-teal-400">{remediation.completion_rate_pct}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-teal-500 to-sky-400 h-full rounded-full transition-all"
                                        style={{ width: `${remediation.completion_rate_pct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400">Overdue SLA</span>
                                    <div className="text-xl font-bold text-rose-400 mt-1">{remediation.overdue_count}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400">Blocked Items</span>
                                    <div className="text-xl font-bold text-amber-400 mt-1">{remediation.blocked_count}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-slate-400">Awaiting Validation</span>
                                    <div className="text-xl font-bold text-sky-400 mt-1">{remediation.awaiting_validation}</div>
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
                                <TrendingUp className="h-5 w-5 text-sky-400" />
                                Strategic Risk Trajectory
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Empirically observed exposure metrics over {trendDays} days.
                            </p>
                        </div>

                        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 self-start">
                            {[7, 30, 90].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setTrendDays(d)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                                        trendDays === d
                                            ? "bg-slate-800 text-sky-400 shadow-sm"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {d} Days
                                </button>
                            ))}
                        </div>
                    </div>

                    {trends?.has_data ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/60 uppercase text-[10px] text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-4">Period</th>
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
                                            <td className="py-2.5 px-4 font-bold text-sky-400">{pt.posture_score ?? "N/A"}</td>
                                            <td className="py-2.5 px-4">{pt.open_findings}</td>
                                            <td className="py-2.5 px-4 text-rose-400 font-semibold">{pt.critical_risks}</td>
                                            <td className="py-2.5 px-4">{pt.open_remediations}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center space-y-2">
                            <Clock className="h-7 w-7 text-slate-500 mx-auto" />
                            <div className="text-sm font-semibold text-slate-300">
                                Insufficient historical data
                            </div>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                Historical trend lines require at least two distinct time intervals of operational telemetry. SAT-SA never synthesizes artificial trend curves; real historical trajectories emerge automatically as operational telemetry accumulates.
                            </p>
                        </div>
                    )}
                </div>

                {/* 5. MULTI-ENTITY BENCHMARKING (ENTERPRISE / SECTOR SCOPE) */}
                {comparison && comparison.organizations && comparison.organizations.length > 0 && (
                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-sky-400" />
                                Business Entity Posture Benchmarks
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Enterprise-wide overview of supervised organizations and sectors.
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/60 uppercase text-[10px] text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-4">Entity</th>
                                        <th className="py-2.5 px-4">Sector</th>
                                        <th className="py-2.5 px-4">Posture Score</th>
                                        <th className="py-2.5 px-4">Critical Risks</th>
                                        <th className="py-2.5 px-4">Overdue Remediations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {comparison.organizations.map((org) => (
                                        <tr key={org.id} className="hover:bg-slate-800/30">
                                            <td className="py-2.5 px-4 font-semibold text-white">{org.name}</td>
                                            <td className="py-2.5 px-4 text-slate-400">{org.sector_name || "—"}</td>
                                            <td className="py-2.5 px-4 font-bold text-sky-400">{org.posture_score ?? "Unavailable"}</td>
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
        </div>
    );
}
