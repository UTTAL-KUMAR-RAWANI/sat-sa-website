"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    findingsApi,
    Finding,
    FindingStats,
    FindingSeverity,
    FindingPriority,
    FindingSourceType,
} from "@/lib/api/findings";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    FileWarning,
    Search,
    Plus,
    Building2,
    User as UserIcon,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    Clock,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Wrench,
    Filter,
} from "lucide-react";

export default function FindingsListPage() {
    const { user } = useAuth();
    const [findings, setFindings] = useState<Finding[]>([]);
    const [stats, setStats] = useState<FindingStats | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [sourceTypeFilter, setSourceTypeFilter] = useState("");

    // Create Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createSeverity, setCreateSeverity] = useState<FindingSeverity>("MEDIUM");
    const [createPriority, setCreatePriority] = useState<FindingPriority>("MEDIUM");
    const [createClassification, setCreateClassification] = useState("Security");
    const [createSourceType, setCreateSourceType] = useState<FindingSourceType>("SUPERVISORY_REVIEW");
    const [createDueDate, setCreateDueDate] = useState("");
    const [creating, setCreating] = useState(false);

    const canCreate = hasPermission(user, Permissions.FINDING_CREATE);

    const loadFindings = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await findingsApi.getFindings({
                search: search || undefined,
                status: statusFilter || undefined,
                severity: severityFilter || undefined,
                priority: priorityFilter || undefined,
                source_type: sourceTypeFilter || undefined,
                page,
                page_size: 20,
            });
            setFindings(data.items);
            setTotal(data.total);
        } catch (err: any) {
            setError(err.message || "Failed to load findings directory");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const s = await findingsApi.getFindingStats();
            setStats(s);
        } catch (err) {
            console.error("Failed to load finding statistics", err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        loadFindings();
    }, [page, statusFilter, severityFilter, priorityFilter, sourceTypeFilter]);

    useEffect(() => {
        loadStats();
    }, []);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadFindings();
    };

    const handleCreateFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await findingsApi.createFinding({
                title: createTitle,
                description: createDesc,
                severity: createSeverity,
                priority: createPriority,
                classification: createClassification,
                source_type: createSourceType,
                due_date: createDueDate ? new Date(createDueDate).toISOString() : undefined,
            });
            setShowCreateModal(false);
            setCreateTitle("");
            setCreateDesc("");
            setCreateDueDate("");
            loadFindings();
            loadStats();
        } catch (err: any) {
            window.alert(err.message || "Error creating finding");
        } finally {
            setCreating(false);
        }
    };

    const getSeverityBadge = (sev: string) => {
        switch (sev.toUpperCase()) {
            case "CRITICAL":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            case "HIGH":
                return "bg-orange-500/10 text-orange-400 border-orange-500/30";
            case "MEDIUM":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "LOW":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            default:
                return "bg-slate-500/10 text-slate-400 border-slate-500/30";
        }
    };

    const getPriorityBadge = (prio: string) => {
        switch (prio.toUpperCase()) {
            case "URGENT":
                return "text-rose-400 bg-rose-950/40 border-rose-800/50";
            case "HIGH":
                return "text-orange-400 bg-orange-950/40 border-orange-800/50";
            case "MEDIUM":
                return "text-amber-400 bg-amber-950/40 border-amber-800/50";
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                            <FileWarning className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                                Findings Management
                            </h1>
                            <p className="text-sm text-slate-400">
                                Centralized repository of confirmed vulnerabilities, supervisory observations, and control deficiencies.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            loadFindings();
                            loadStats();
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-sm font-medium transition-colors"
                        title="Refresh Findings"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>

                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-semibold rounded-lg text-sm shadow-lg shadow-amber-500/10 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            New Finding
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard / KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Total</span>
                    <span className="text-2xl font-bold text-slate-100 mt-1 block">
                        {statsLoading ? "..." : stats?.total ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-rose-900/40 p-3 rounded-xl">
                    <span className="text-xs font-medium text-rose-400 uppercase tracking-wider block">Critical</span>
                    <span className="text-2xl font-bold text-rose-400 mt-1 block">
                        {statsLoading ? "..." : stats?.critical ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-orange-900/40 p-3 rounded-xl">
                    <span className="text-xs font-medium text-orange-400 uppercase tracking-wider block">High</span>
                    <span className="text-2xl font-bold text-orange-400 mt-1 block">
                        {statsLoading ? "..." : stats?.high ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-blue-900/40 p-3 rounded-xl">
                    <span className="text-xs font-medium text-blue-400 uppercase tracking-wider block">Under Review</span>
                    <span className="text-2xl font-bold text-blue-400 mt-1 block">
                        {statsLoading ? "..." : stats?.under_review ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-emerald-900/40 p-3 rounded-xl">
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider block">Confirmed</span>
                    <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                        {statsLoading ? "..." : stats?.confirmed ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-purple-900/40 p-3 rounded-xl">
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-wider block">Remediation Req</span>
                    <span className="text-2xl font-bold text-purple-400 mt-1 block">
                        {statsLoading ? "..." : stats?.remediation_required ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-rose-500/50 bg-rose-950/20 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">Overdue</span>
                        <Clock className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    </div>
                    <span className="text-2xl font-bold text-rose-400 mt-1 block">
                        {statsLoading ? "..." : stats?.overdue ?? 0}
                    </span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Closed</span>
                    <span className="text-2xl font-bold text-slate-300 mt-1 block">
                        {statsLoading ? "..." : stats?.closed ?? 0}
                    </span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search ID, title, classification..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
                    />
                </form>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
                        <Filter className="w-3.5 h-3.5" />
                        Filters:
                    </div>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                        <option value="">Status: All</option>
                        <option value="IDENTIFIED">Identified</option>
                        <option value="DRAFT">Draft</option>
                        <option value="SUBMITTED">Submitted</option>
                        <option value="REVIEW">Review</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="REMEDIATION_REQUIRED">Remediation Required</option>
                        <option value="CLOSED">Closed</option>
                        <option value="REJECTED">Rejected</option>
                    </select>

                    {/* Severity filter */}
                    <select
                        value={severityFilter}
                        onChange={(e) => {
                            setSeverityFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                        <option value="">Severity: All</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="INFORMATIONAL">Informational</option>
                    </select>

                    {/* Priority filter */}
                    <select
                        value={priorityFilter}
                        onChange={(e) => {
                            setPriorityFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                        <option value="">Priority: All</option>
                        <option value="URGENT">Urgent</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>

                    {/* Source filter */}
                    <select
                        value={sourceTypeFilter}
                        onChange={(e) => {
                            setSourceTypeFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                        <option value="">Source: All</option>
                        <option value="CSE">CSE</option>
                        <option value="INVESTIGATION">Investigation</option>
                        <option value="ASSESSMENT">Assessment</option>
                        <option value="AUDIT">Audit</option>
                        <option value="SUPERVISORY_REVIEW">Supervisory Review</option>
                        <option value="RISK_ANALYSIS">Risk Analysis</option>
                        <option value="NEGATIVE_SPACE">Negative Space</option>
                    </select>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider font-semibold">
                            <tr>
                                <th className="py-3 px-4">Finding ID</th>
                                <th className="py-3 px-4">Title & Classification</th>
                                <th className="py-3 px-4">Severity / Priority</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Source</th>
                                <th className="py-3 px-4">Organization</th>
                                <th className="py-3 px-4">Owner / Due</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                                            <span>Loading findings repository...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : findings.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        No findings match the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                findings.map((f) => (
                                    <tr key={f.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="py-3.5 px-4 font-mono font-semibold text-amber-400">
                                            <Link href={`/findings/${f.id}`} className="hover:underline">
                                                {f.business_id}
                                            </Link>
                                        </td>
                                        <td className="py-3.5 px-4 max-w-sm">
                                            <Link href={`/findings/${f.id}`} className="font-medium text-slate-200 hover:text-amber-400 line-clamp-1">
                                                {f.title}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-slate-400">{f.classification}</span>
                                                {f.remediation_required && (
                                                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                                                        Remediation Req
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(f.severity)}`}>
                                                    {f.severity}
                                                </span>
                                                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getPriorityBadge(f.priority)}`}>
                                                    {f.priority}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusBadge(f.status)}`}>
                                                {f.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="text-xs text-slate-300 font-medium">{f.source_type}</div>
                                            {f.investigation_business_id && (
                                                <Link href={`/investigations/${f.investigation_id}`} className="text-[11px] text-sky-400 hover:underline block font-mono">
                                                    {f.investigation_business_id}
                                                </Link>
                                            )}
                                            {f.cse_business_id && !f.investigation_business_id && (
                                                <Link href={`/cse/${f.cse_id}`} className="text-[11px] text-sky-400 hover:underline block font-mono">
                                                    {f.cse_business_id}
                                                </Link>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{f.organization_name || "Enterprise"}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 ml-5">{f.sector_name || "Cross-Sector"}</div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{f.assigned_to_name || "Unassigned"}</span>
                                            </div>
                                            {f.due_date ? (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className={`text-[11px] ${f.is_overdue ? "text-rose-400 font-bold flex items-center gap-0.5" : "text-slate-400"}`}>
                                                        {f.is_overdue && <Clock className="w-3 h-3 text-rose-400 animate-pulse" />}
                                                        {new Date(f.due_date).toLocaleDateString()}
                                                    </span>
                                                    {f.is_overdue && (
                                                        <span className="text-[9px] px-1 bg-rose-500/20 text-rose-300 rounded border border-rose-500/40">
                                                            OVERDUE
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-500">No due date</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <Link
                                                href={`/findings/${f.id}`}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
                                            >
                                                Details
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-slate-950/80 border-t border-slate-800 p-4 flex items-center justify-between text-xs text-slate-400">
                    <div>
                        Showing <span className="font-semibold text-slate-200">{findings.length}</span> of{" "}
                        <span className="font-semibold text-slate-200">{total}</span> findings
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-200 border border-slate-800 rounded"
                        >
                            Previous
                        </button>
                        <span className="px-2 font-mono text-slate-300">Page {page}</span>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={findings.length < 20}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-200 border border-slate-800 rounded"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Finding Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <FileWarning className="w-5 h-5 text-amber-500" />
                                Identify New Finding
                            </h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm"
                            >
                                Cancel
                            </button>
                        </div>

                        <form onSubmit={handleCreateFinding} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Finding Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Unrestricted Outbound C2 Traffic via Perimeter Firewall"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Description & Technical Observations
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Detail observed vulnerabilities, indicators of compromise, or non-compliance..."
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Severity
                                    </label>
                                    <select
                                        value={createSeverity}
                                        onChange={(e) => setCreateSeverity(e.target.value as FindingSeverity)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                        <option value="CRITICAL">CRITICAL</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                        <option value="INFORMATIONAL">INFORMATIONAL</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={createPriority}
                                        onChange={(e) => setCreatePriority(e.target.value as FindingPriority)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                        <option value="URGENT">URGENT</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Source Type
                                    </label>
                                    <select
                                        value={createSourceType}
                                        onChange={(e) => setCreateSourceType(e.target.value as FindingSourceType)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                        <option value="SUPERVISORY_REVIEW">Supervisory Review</option>
                                        <option value="CSE">Cyber Security Event (CSE)</option>
                                        <option value="INVESTIGATION">Investigation</option>
                                        <option value="ASSESSMENT">Assessment</option>
                                        <option value="AUDIT">Audit</option>
                                        <option value="RISK_ANALYSIS">Risk Analysis</option>
                                        <option value="NEGATIVE_SPACE">Negative Space</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Classification
                                    </label>
                                    <select
                                        value={createClassification}
                                        onChange={(e) => setCreateClassification(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                        <option value="Security">Security</option>
                                        <option value="Control Deficiency">Control Deficiency</option>
                                        <option value="Compliance">Compliance</option>
                                        <option value="Operational">Operational</option>
                                        <option value="Supervisory">Supervisory</option>
                                        <option value="Threat">Threat</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Target Resolution Due Date
                                </label>
                                <input
                                    type="date"
                                    value={createDueDate}
                                    onChange={(e) => setCreateDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {creating ? "Creating..." : "Save Finding"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
