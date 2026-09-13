"use client";

import React, { useEffect, useState } from "react";
import { auditApi, AuditLogItem } from "@/lib/api/audit";
import {
    FileText,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Download,
    Search,
    RefreshCw,
    X,
    Shield,
    Calendar,
    User as UserIcon,
    Globe,
    FileCode,
    CheckCircle2,
} from "lucide-react";

export default function AdminAuditLogsPage() {
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [actionFilter, setActionFilter] = useState("");
    const [resourceFilter, setResourceFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const pageSize = 20;
    const [error, setError] = useState<string | null>(null);

    // Selected item for detail inspection drawer
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await auditApi.list({
                action: actionFilter || undefined,
                resource_type: resourceFilter || undefined,
                date_from: fromDate ? new Date(fromDate).toISOString() : undefined,
                date_to: toDate ? new Date(toDate).toISOString() : undefined,
                page: page + 1,
                limit: pageSize,
            });
            setLogs(data.items);
            setTotal(data.total);
        } catch (err: any) {
            setError(err.message || "Failed to query audit repository");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [actionFilter, resourceFilter, fromDate, toDate, page]);

    const handleExportCSV = async () => {
        try {
            setExporting(true);
            const blob = await auditApi.exportCSV({
                action: actionFilter || undefined,
                resource_type: resourceFilter || undefined,
                date_from: fromDate ? new Date(fromDate).toISOString() : undefined,
                date_to: toDate ? new Date(toDate).toISOString() : undefined,
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            setError(err.message || "Failed to export audit logs");
        } finally {
            setExporting(false);
        }
    };

    // Client-side text search over current page items
    const filteredLogs = logs.filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const actorName = l.actor?.name || l.actor?.username || "";
        const actorEmail = l.actor?.email || "";
        return (
            actorName.toLowerCase().includes(q) ||
            actorEmail.toLowerCase().includes(q) ||
            (l.action && l.action.toLowerCase().includes(q)) ||
            (l.resource_type && l.resource_type.toLowerCase().includes(q)) ||
            (l.business_reference && l.business_reference.toLowerCase().includes(q)) ||
            (l.reason && l.reason.toLowerCase().includes(q))
        );
    });

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Shield className="h-4 w-4" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white">
                            Immutable Platform Audit Repository
                        </h1>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Cryptographically sequenced, sanitized trail of all supervisory operations and security events
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <button
                        onClick={handleExportCSV}
                        disabled={exporting}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>{exporting ? "Exporting CSV..." : "Export CSV"}</span>
                    </button>
                    <button
                        onClick={loadData}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Total:</span>
                        <span className="font-mono font-bold text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
                            {total}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search actor, ref, reason..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                </div>

                {/* Action Filter */}
                <select
                    value={actionFilter}
                    onChange={(e) => {
                        setActionFilter(e.target.value);
                        setPage(0);
                    }}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Actions</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                    <option value="ASSIGN">ASSIGN</option>
                    <option value="APPROVE">APPROVE</option>
                    <option value="REJECT">REJECT</option>
                    <option value="ESCALATE">ESCALATE</option>
                    <option value="VALIDATE">VALIDATE</option>
                    <option value="EXPORT">EXPORT</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGOUT">LOGOUT</option>
                    <option value="USER_CREATED">USER_CREATED</option>
                    <option value="PERMISSION_DENIED">PERMISSION_DENIED</option>
                    <option value="SCOPE_DENIED">SCOPE_DENIED</option>
                </select>

                {/* Resource Filter */}
                <select
                    value={resourceFilter}
                    onChange={(e) => {
                        setResourceFilter(e.target.value);
                        setPage(0);
                    }}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Resource Types</option>
                    <option value="CSE">CSE Exposure</option>
                    <option value="FINDING">Finding</option>
                    <option value="ASSESSMENT">Assessment</option>
                    <option value="RISK">Risk</option>
                    <option value="REMEDIATION">Remediation</option>
                    <option value="SUPERVISORY_CASE">Supervisory Case</option>
                    <option value="DATASET">Dataset</option>
                    <option value="NEGATIVE_SPACE_ASSESSMENT">Negative Space</option>
                    <option value="User">User</option>
                    <option value="Role">Role</option>
                    <option value="AUDIT_LOGS">Audit Logs</option>
                </select>

                {/* From Date */}
                <div>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                            setFromDate(e.target.value);
                            setPage(0);
                        }}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                        title="From Date"
                    />
                </div>

                {/* To Date */}
                <div>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => {
                            setToDate(e.target.value);
                            setPage(0);
                        }}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                        title="To Date"
                    />
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {loading ? (
                    <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                        Querying immutable audit logs...
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FileText className="h-8 w-8 text-slate-600 mb-2" />
                        <p className="text-sm font-medium text-slate-300">No audit records found</p>
                        <p className="text-xs text-slate-500">No events matched the selected filter criteria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                                    <th className="p-3.5 font-medium">Timestamp</th>
                                    <th className="p-3.5 font-medium">Actor</th>
                                    <th className="p-3.5 font-medium">Action</th>
                                    <th className="p-3.5 font-medium">Resource Target</th>
                                    <th className="p-3.5 font-medium">Business Reference / Reason</th>
                                    <th className="p-3.5 font-medium text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {filteredLogs.map((l) => {
                                    const isSecurityAlert =
                                        l.action.includes("DENIED") ||
                                        l.action.includes("REJECTED") ||
                                        l.action.includes("DEACTIVATED");
                                    const isHighlightAction =
                                        l.action === "EXPORT" || l.action === "ESCALATE" || l.action === "APPROVE";

                                    return (
                                        <tr
                                            key={l.id}
                                            onClick={() => setSelectedLog(l)}
                                            className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                        >
                                            <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                                {new Date(l.created_at).toLocaleString()}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                                    {l.actor?.name || l.actor?.username || "System"}
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    {l.actor?.email || "system@sat-sa.local"}
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                <span
                                                    className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${
                                                        isSecurityAlert
                                                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                            : isHighlightAction
                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                            : "bg-slate-800 text-emerald-400 border-slate-700"
                                                    }`}
                                                >
                                                    {l.action}
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="text-slate-200 font-medium">{l.resource_type}</div>
                                                {l.resource_id && (
                                                    <div className="font-mono text-[10px] text-slate-500 truncate max-w-[130px]">
                                                        {l.resource_id}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3.5">
                                                {l.business_reference && (
                                                    <span className="inline-block font-mono text-[11px] font-semibold text-emerald-400 mr-2">
                                                        {l.business_reference}
                                                    </span>
                                                )}
                                                {l.reason ? (
                                                    <span className="text-slate-400 text-xs">{l.reason}</span>
                                                ) : (
                                                    <span className="text-slate-500 text-[11px]">—</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLog(l);
                                                    }}
                                                    className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors"
                                                >
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3.5 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
                        <span>
                            Page {page + 1} of {totalPages} ({total} entries)
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={page + 1 >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Inspection Side-Drawer / Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
                    <div className="h-full w-full max-w-2xl border-l border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-y-auto space-y-6">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-500/20">
                                        {selectedLog.action}
                                    </span>
                                    <h2 className="text-base font-bold text-white">
                                        {selectedLog.business_reference || selectedLog.resource_type}
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-400 font-mono mt-1">
                                    Event ID: {selectedLog.id}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Event Context Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <UserIcon className="h-3.5 w-3.5" />
                                    <span>Actor</span>
                                </div>
                                <div className="text-xs font-bold text-white">
                                    {selectedLog.actor?.name || selectedLog.actor?.username || "System"}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                    {selectedLog.actor?.email || "system@sat-sa.local"}
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Timestamp</span>
                                </div>
                                <div className="text-xs font-bold text-white">
                                    {new Date(selectedLog.created_at).toLocaleString()}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                    {selectedLog.created_at}
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span>Network & Client Context</span>
                                </div>
                                <div className="text-xs text-slate-200 font-mono">
                                    IP: {selectedLog.metadata_json?.ip_address || "Internal / Platform"}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate" title={selectedLog.metadata_json?.user_agent || "None"}>
                                    UA: {selectedLog.metadata_json?.user_agent || "API / Platform Agent"}
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span>Target Resource</span>
                                </div>
                                <div className="text-xs font-bold text-white">
                                    {selectedLog.resource_type}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                    ID: {selectedLog.resource_id || "N/A"}
                                </div>
                            </div>
                        </div>

                        {/* Reason Note */}
                        {selectedLog.reason && (
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                                <div className="text-xs font-semibold text-emerald-400">Operational Reason:</div>
                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    {selectedLog.reason}
                                </p>
                            </div>
                        )}

                        {/* State Changes Diff View */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <FileCode className="h-4 w-4 text-emerald-400" />
                                State Change Diff (Sanitized)
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Old State */}
                                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                    <div className="text-xs font-semibold text-rose-400 mb-2">Previous State:</div>
                                    {selectedLog.old_value ? (
                                        <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto max-h-60">
                                            {typeof selectedLog.old_value === "object"
                                                ? JSON.stringify(selectedLog.old_value, null, 2)
                                                : selectedLog.old_value}
                                        </pre>
                                    ) : (
                                        <div className="text-xs text-slate-500 italic">None (initial creation)</div>
                                    )}
                                </div>

                                {/* New State */}
                                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                    <div className="text-xs font-semibold text-emerald-400 mb-2">New State:</div>
                                    {selectedLog.new_value ? (
                                        <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto max-h-60">
                                            {typeof selectedLog.new_value === "object"
                                                ? JSON.stringify(selectedLog.new_value, null, 2)
                                                : selectedLog.new_value}
                                        </pre>
                                    ) : (
                                        <div className="text-xs text-slate-500 italic">None (no state modification)</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Metadata JSON */}
                        {selectedLog.metadata_json && Object.keys(selectedLog.metadata_json).length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                    Extended Metadata
                                </h3>
                                <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
                                    {JSON.stringify(selectedLog.metadata_json, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
