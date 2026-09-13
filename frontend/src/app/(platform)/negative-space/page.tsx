"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    negativeSpaceApi,
    NegativeSpaceAssessment,
    NegativeSpaceSignal,
    NegativeSpaceKPIs,
} from "@/lib/api/negative-space";
import {
    EyeOff,
    Plus,
    Search,
    Filter,
    RefreshCw,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    Play,
    FileText,
    TrendingDown,
    Activity,
    Layers,
    Info,
    ExternalLink,
} from "lucide-react";

export default function NegativeSpaceRegistryPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [kpis, setKpis] = useState<NegativeSpaceKPIs | null>(null);
    const [assessments, setAssessments] = useState<NegativeSpaceAssessment[]>([]);
    const [signals, setSignals] = useState<NegativeSpaceSignal[]>([]);
    const [activeTab, setActiveTab] = useState<"assessments" | "signals">("assessments");
    const [loading, setLoading] = useState(true);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    const canCreate = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_CREATE) : false;
    const canRun = user ? hasPermission(user, Permissions.NEGATIVE_SPACE_RUN) : false;

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [kpiData, asmtsData, sigsData] = await Promise.all([
                negativeSpaceApi.getKPIs().catch(() => null),
                negativeSpaceApi.listAssessments({ limit: 50 }),
                negativeSpaceApi.listSignals({ limit: 50 }),
            ]);
            if (kpiData) setKpis(kpiData);
            setAssessments(asmtsData.items);
            setSignals(sigsData.items);
        } catch (err: any) {
            console.error("Failed to load negative-space data:", err);
            setError(err.message || "Failed to load negative-space assessment data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRunAssessment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            setRunningId(id);
            await negativeSpaceApi.runAssessment(id);
            await fetchData();
        } catch (err: any) {
            alert(err.message || "Assessment run failed");
        } finally {
            setRunningId(null);
        }
    };

    const filteredAssessments = useMemo(() => {
        return assessments.filter((a) => {
            const matchesSearch =
                searchTerm === "" ||
                a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.business_id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [assessments, searchTerm, statusFilter]);

    const filteredSignals = useMemo(() => {
        return signals.filter((s) => {
            const matchesSearch =
                searchTerm === "" ||
                s.business_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.gap_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.source && s.source.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
            const matchesCat = categoryFilter === "ALL" || s.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCat;
        });
    }, [signals, searchTerm, statusFilter, categoryFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                    </span>
                );
            case "REVIEW_REQUIRED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Review Required
                    </span>
                );
            case "RUNNING":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Running
                    </span>
                );
            case "CONFIGURED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Layers className="w-3.5 h-3.5" />
                        Configured
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <Clock className="w-3.5 h-3.5" />
                        {status}
                    </span>
                );
        }
    };

    const getSignalStatusBadge = (status: string) => {
        switch (status) {
            case "VALIDATED":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Validated Gap
                    </span>
                );
            case "CONVERTED_TO_FINDING":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Converted to Finding
                    </span>
                );
            case "DISMISSED":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Dismissed
                    </span>
                );
            case "REVIEWING":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Reviewing
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Detected
                    </span>
                );
        }
    };

    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case "CRITICAL":
                return (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        CRITICAL
                    </span>
                );
            case "HIGH":
                return (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        HIGH
                    </span>
                );
            case "MEDIUM":
                return (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        MEDIUM
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        LOW
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                            <EyeOff className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-white">Negative-Space Assessment</h1>
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                                    Step 14 Platform Core
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                                Supervisory Gap, Missing Telemetry, and Detection Blind Spot Intelligence
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    {canCreate && (
                        <Link
                            href="/negative-space/new"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition shadow-lg shadow-cyan-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            New Assessment
                        </Link>
                    )}
                </div>
            </div>

            {/* Core Principle Callout Banner */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 mt-0.5">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-cyan-300">
                            Guiding Principle: “What should have been observed, but was not observed?”
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Detects missing alerts, silent sources, logging dropouts, and control failures by comparing expected baseline activity against observed telemetry. Absence is classified as a detection gap—never an unconfirmed threat.
                        </p>
                    </div>
                </div>
                <div className="text-xs text-slate-500 font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800 shrink-0">
                    7 Deterministic Rules Active
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Total Assessments</span>
                    <p className="text-2xl font-bold text-white mt-1">{kpis?.total_assessments ?? assessments.length}</p>
                    <span className="text-[11px] text-slate-500 mt-1 block">Configured specifications</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Signals Detected</span>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{kpis?.total_signals ?? signals.length}</p>
                    <span className="text-[11px] text-cyan-500/80 mt-1 block">Negative-space signals</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                    <span className="text-xs font-medium text-rose-300">High / Critical Gaps</span>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{kpis?.high_critical_signals ?? 0}</p>
                    <span className="text-[11px] text-rose-400/70 mt-1 block">Severe coverage deficits</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Validated Signals</span>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{kpis?.validated_signals ?? 0}</p>
                    <span className="text-[11px] text-amber-500/80 mt-1 block">Confirmed gaps</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Converted to Findings</span>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{kpis?.converted_to_findings ?? 0}</p>
                    <span className="text-[11px] text-purple-400/80 mt-1 block">In formal remediation</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">Data Quality Alerts</span>
                    <p className="text-2xl font-bold text-slate-300 mt-1">{kpis?.data_quality_concerns ?? 0}</p>
                    <span className="text-[11px] text-slate-500 mt-1 block">Ingestion safety guards</span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Tabs & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab("assessments")}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                            activeTab === "assessments"
                                ? "border-cyan-400 text-cyan-400"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Assessments Registry ({assessments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("signals")}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                            activeTab === "signals"
                                ? "border-cyan-400 text-cyan-400"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        Negative-Space Signals ({signals.length})
                    </button>
                </div>

                {/* Filter / Search Bar */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by ID or keywords..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-1.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-64"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="DRAFT">Draft</option>
                        <option value="CONFIGURED">Configured</option>
                        <option value="RUNNING">Running</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REVIEW_REQUIRED">Review Required</option>
                    </select>

                    {activeTab === "signals" && (
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="ALL">All Categories</option>
                            <option value="MONITORING_BLIND_SPOT">Monitoring Blind Spot</option>
                            <option value="TELEMETRY_SILENCE">Telemetry Silence</option>
                            <option value="AUTHENTICATION_DEFICIT">Authentication Deficit</option>
                            <option value="ALERT_DEFICIT">Alert Deficit</option>
                            <option value="CONTROL_ABSENCE">Control Absence</option>
                            <option value="COVERAGE_DEGRADATION">Coverage Degradation</option>
                        </select>
                    )}
                </div>
            </div>

            {/* TAB 1: ASSESSMENTS TABLE */}
            {activeTab === "assessments" && (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Assessment ID</th>
                                    <th className="px-5 py-3.5 font-semibold">Name & Type</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold">Signals Detected</th>
                                    <th className="px-5 py-3.5 font-semibold">Missed Threats</th>
                                    <th className="px-5 py-3.5 font-semibold">Completed</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                                            Loading negative-space assessments...
                                        </td>
                                    </tr>
                                ) : filteredAssessments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                                            No negative-space assessments found matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAssessments.map((a) => (
                                        <tr
                                            key={a.id}
                                            onClick={() => router.push(`/negative-space/${a.id}`)}
                                            className="hover:bg-slate-800/40 transition cursor-pointer"
                                        >
                                            <td className="px-5 py-4 font-mono font-bold text-cyan-400">
                                                {a.business_id}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-white">{a.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{a.assessment_type}</div>
                                            </td>
                                            <td className="px-5 py-4">{getStatusBadge(a.status)}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white">{a.signal_count}</span>
                                                    <span className="text-xs text-slate-400">signals</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`font-semibold ${a.potential_missed_threat_count > 0 ? "text-rose-400" : "text-slate-400"}`}>
                                                    {a.potential_missed_threat_count} potential
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                                                {a.completed_at ? new Date(a.completed_at).toLocaleString() : "Pending run"}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    {canRun && (
                                                        <button
                                                            onClick={(e) => handleRunAssessment(a.id, e)}
                                                            disabled={runningId === a.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 transition disabled:opacity-50"
                                                        >
                                                            {runningId === a.id ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Play className="w-3.5 h-3.5" />
                                                            )}
                                                            Run
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/negative-space/${a.id}`}
                                                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                                                        title="View Assessment Dossier"
                                                    >
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: SIGNALS TABLE */}
            {activeTab === "signals" && (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Signal ID</th>
                                    <th className="px-5 py-3.5 font-semibold">Category & Description</th>
                                    <th className="px-5 py-3.5 font-semibold">Gap %</th>
                                    <th className="px-5 py-3.5 font-semibold">Severity</th>
                                    <th className="px-5 py-3.5 font-semibold">Confidence</th>
                                    <th className="px-5 py-3.5 font-semibold">Safety Guard</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                                            Loading negative-space signals...
                                        </td>
                                    </tr>
                                ) : filteredSignals.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                                            No negative-space signals detected matching filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSignals.map((s) => (
                                        <tr
                                            key={s.id}
                                            onClick={() => router.push(`/negative-space/signals/${s.id}`)}
                                            className="hover:bg-slate-800/40 transition cursor-pointer"
                                        >
                                            <td className="px-5 py-4 font-mono font-bold text-cyan-400">
                                                {s.business_id}
                                            </td>
                                            <td className="px-5 py-4 max-w-md">
                                                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                                    {s.category.replace(/_/g, " ")}
                                                </div>
                                                <div className="text-sm text-slate-200 line-clamp-2 mt-0.5">
                                                    {s.gap_description}
                                                </div>
                                                {s.source && (
                                                    <span className="inline-block mt-1 text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                                        Source: {s.source}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 bg-slate-800 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full ${
                                                                s.gap_percentage >= 80
                                                                    ? "bg-rose-500"
                                                                    : s.gap_percentage >= 50
                                                                    ? "bg-amber-500"
                                                                    : "bg-cyan-500"
                                                            }`}
                                                            style={{ width: `${Math.min(s.gap_percentage, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs font-bold text-white">
                                                        {s.gap_percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">{getSeverityBadge(s.severity)}</td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs text-slate-300 font-medium">
                                                    {s.confidence}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {s.data_quality_concern ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Data Quality Alert
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-500">Verified Quality</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">{getSignalStatusBadge(s.status)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/negative-space/signals/${s.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Review
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
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
        </div>
    );
}
