"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { secopsApi, CSE } from "@/lib/api/secops";
import {
    Activity,
    Search,
    Plus,
    Building2,
    User as UserIcon,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    FileSearch,
    Paperclip
} from "lucide-react";

export default function CSEListPage() {
    const [cses, setCses] = useState<CSE[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [severityFilter, setSeverityFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");

    // Create Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createSeverity, setCreateSeverity] = useState("MEDIUM");
    const [createPriority, setCreatePriority] = useState("P3");
    const [createSource, setCreateSource] = useState("MANUAL");
    const [creating, setCreating] = useState(false);

    const loadCSEs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await secopsApi.listCSEs({
                search: search || undefined,
                status: statusFilter || undefined,
                severity: severityFilter || undefined,
                priority: priorityFilter || undefined,
                page,
                limit: 20
            });
            setCses(data.items);
            setTotal(data.total);
        } catch (err: any) {
            setError(err.message || "Failed to load Cyber Security Events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCSEs();
    }, [page, statusFilter, severityFilter, priorityFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadCSEs();
    };

    const handleCreateCSE = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await secopsApi.createCSE({
                title: createTitle,
                description: createDesc,
                severity: createSeverity,
                priority: createPriority,
                source: createSource
            });
            setShowCreateModal(false);
            setCreateTitle("");
            setCreateDesc("");
            loadCSEs();
        } catch (err: any) {
            alert(err.message || "Error creating CSE");
        } finally {
            setCreating(false);
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity.toUpperCase()) {
            case "CRITICAL":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            case "HIGH":
                return "bg-orange-500/10 text-orange-400 border-orange-500/30";
            case "MEDIUM":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            default:
                return "bg-slate-500/10 text-slate-400 border-slate-500/30";
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case "NEW":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            case "TRIAGED":
                return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
            case "INVESTIGATING":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "ESCALATED":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            case "FINDING_IDENTIFIED":
                return "bg-purple-500/10 text-purple-400 border-purple-500/30";
            case "UNDER_REVIEW":
                return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
            case "RESOLVED":
            case "CLOSED":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            default:
                return "bg-slate-500/10 text-slate-400 border-slate-500/30";
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <Activity className="h-7 w-7 text-emerald-400" />
                        Cyber Security Events (CSE)
                    </h1>
                    <p className="text-sm text-slate-400">
                        Operational incident tickets, multi-phase investigation workspaces, and supervisory escalations.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={loadCSEs}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Create CSE
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-sm">
                <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by title, ID, or description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="NEW">New</option>
                            <option value="TRIAGED">Triaged</option>
                            <option value="INVESTIGATING">Investigating</option>
                            <option value="ESCALATED">Escalated</option>
                            <option value="FINDING_IDENTIFIED">Finding Identified</option>
                            <option value="REMEDIATION_REQUIRED">Remediation Required</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                        </select>

                        <select
                            value={severityFilter}
                            onChange={(e) => {
                                setSeverityFilter(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                        >
                            <option value="">All Severities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) => {
                                setPriorityFilter(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                        >
                            <option value="">All Priorities</option>
                            <option value="P1">P1 - Urgent</option>
                            <option value="P2">P2 - High</option>
                            <option value="P3">P3 - Standard</option>
                            <option value="P4">P4 - Low</option>
                        </select>

                        <button
                            type="submit"
                            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                        >
                            Search
                        </button>
                    </div>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* CSE Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">CSE ID</th>
                                <th className="px-4 py-3">Incident Title</th>
                                <th className="px-4 py-3">Severity / Priority</th>
                                <th className="px-4 py-3">Lifecycle Status</th>
                                <th className="px-4 py-3">Organization / Sector</th>
                                <th className="px-4 py-3">Assigned Lead</th>
                                <th className="px-4 py-3">Investigations</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                            <span>Loading incident records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : cses.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                                        No Cyber Security Events found matching the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                cses.map((cse) => (
                                    <tr key={cse.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5 font-mono text-emerald-400 font-medium">
                                            <Link href={`/cse/${cse.id}`} className="hover:underline">
                                                {cse.business_id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-semibold text-white max-w-xs truncate">
                                                <Link href={`/cse/${cse.id}`} className="hover:text-emerald-300 transition-colors">
                                                    {cse.title}
                                                </Link>
                                            </div>
                                            {cse.originating_alert_business_id && (
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    Origin: {cse.originating_alert_business_id}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${getSeverityBadge(cse.severity)}`}>
                                                    {cse.severity}
                                                </span>
                                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                                                    {cse.priority}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(cse.status)}`}>
                                                {cse.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                                                <span>{cse.organization_name || "Enterprise"}</span>
                                            </div>
                                            {cse.sector_name && (
                                                <div className="text-[10px] text-slate-500 pl-5">
                                                    {cse.sector_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                                                <span>{cse.assigned_to_name || "Unassigned"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <FileSearch className="h-3 w-3 text-slate-500" />
                                                    {cse.investigation_count}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Paperclip className="h-3 w-3 text-slate-500" />
                                                    {cse.evidence_count}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                                            {new Date(cse.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <Link
                                                href={`/cse/${cse.id}`}
                                                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                            >
                                                Workspace
                                                <ChevronRight className="h-3 w-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
                    <div>
                        Showing <span className="text-white font-medium">{cses.length}</span> of{" "}
                        <span className="text-white font-medium">{total}</span> total CSE tickets
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={cses.length < 20}
                            className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Create CSE Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-1">Create Cyber Security Event</h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Instantiate a new security event case for investigation and supervision tracking.
                        </p>

                        <form onSubmit={handleCreateCSE} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Event Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    placeholder="e.g. Critical API Gateway credential exposure"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Executive Summary / Description</label>
                                <textarea
                                    rows={3}
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    placeholder="Describe scope, impacted assets, and preliminary observations..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
                                    <select
                                        value={createSeverity}
                                        onChange={(e) => setCreateSeverity(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={createPriority}
                                        onChange={(e) => setCreatePriority(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="P1">P1 - Urgent</option>
                                        <option value="P2">P2 - High</option>
                                        <option value="P3">P3 - Standard</option>
                                        <option value="P4">P4 - Low</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Source</label>
                                    <input
                                        type="text"
                                        value={createSource}
                                        onChange={(e) => setCreateSource(e.target.value)}
                                        placeholder="ALERT, MANUAL..."
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {creating ? "Creating..." : "Instantiate CSE"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
