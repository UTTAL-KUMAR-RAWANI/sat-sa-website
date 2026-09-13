"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { secopsApi, Investigation } from "@/lib/api/secops";
import {
    Search,
    FileSearch,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    User as UserIcon,
    Paperclip,
    ExternalLink
} from "lucide-react";

export default function InvestigationsListPage() {
    const [investigations, setInvestigations] = useState<Investigation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const loadInvestigations = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await secopsApi.listInvestigations({
                search: search || undefined,
                status: statusFilter || undefined,
                page,
                limit: 20
            });
            setInvestigations(data.items);
            setTotal(data.total);
        } catch (err: any) {
            setError(err.message || "Failed to load investigations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvestigations();
    }, [page, statusFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadInvestigations();
    };

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case "OPEN":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            case "IN_PROGRESS":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            case "ESCALATED":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            case "CONCLUDED":
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
                        <FileSearch className="h-7 w-7 text-emerald-400" />
                        Security Investigations
                    </h1>
                    <p className="text-sm text-slate-400">
                        Active forensic inquiries, root-cause assessments, and technical findings repository.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={loadInvestigations}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
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
                            placeholder="Search investigations by title, ID, or narrative..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="ESCALATED">Escalated</option>
                            <option value="CONCLUDED">Concluded</option>
                            <option value="CLOSED">Closed</option>
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

            {/* Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Investigation ID</th>
                                <th className="px-4 py-3">Linked CSE</th>
                                <th className="px-4 py-3">Title & Summary</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Lead Analyst</th>
                                <th className="px-4 py-3">Evidence Artifacts</th>
                                <th className="px-4 py-3">Started</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                            <span>Loading investigation directories...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : investigations.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                        No security investigations found matching search criteria.
                                    </td>
                                </tr>
                            ) : (
                                investigations.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5 font-mono text-emerald-400 font-medium">
                                            <Link href={`/investigations/${inv.id}`} className="hover:underline">
                                                {inv.business_id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-xs">
                                            <Link href={`/cse/${inv.cse_id}`} className="text-slate-300 hover:text-emerald-400 flex items-center gap-1">
                                                {inv.cse_business_id || "Linked CSE"}
                                                <ExternalLink className="h-3 w-3 text-slate-500" />
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-semibold text-white max-w-xs truncate">
                                                <Link href={`/investigations/${inv.id}`} className="hover:text-emerald-300">
                                                    {inv.title}
                                                </Link>
                                            </div>
                                            {inv.description && (
                                                <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                                    {inv.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(inv.status)}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                                                <span>{inv.lead_analyst_name || "Unassigned"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="flex items-center gap-1 text-slate-400 font-mono text-xs">
                                                <Paperclip className="h-3 w-3 text-slate-500" />
                                                {inv.evidence_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                                            {inv.started_at ? new Date(inv.started_at).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <Link
                                                href={`/investigations/${inv.id}`}
                                                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                            >
                                                Inspect
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
                        Showing <span className="text-white font-medium">{investigations.length}</span> of{" "}
                        <span className="text-white font-medium">{total}</span> total investigations
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
                            disabled={investigations.length < 20}
                            className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
