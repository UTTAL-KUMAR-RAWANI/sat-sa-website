"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import { datasetsApi, DatasetItem, AnalyticsSummary } from "@/lib/api/datasets";
import {
    Database,
    Upload,
    Search,
    Filter,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    FileText,
    ArrowUpRight,
    TrendingUp,
    Shield,
    BarChart3,
    Trash2,
} from "lucide-react";

export default function DatasetsRegistryPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [datasets, setDatasets] = useState<DatasetItem[]>([]);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [fileTypeFilter, setFileTypeFilter] = useState("ALL");

    const canUpload = user ? hasPermission(user, Permissions.DATASET_UPLOAD) || hasPermission(user, Permissions.DATASET_CREATE) : false;
    const canDelete = user ? hasPermission(user, Permissions.DATASET_DELETE) : false;

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [datasetsData, summaryData] = await Promise.all([
                datasetsApi.getDatasets({ limit: 100 }),
                datasetsApi.getAnalyticsSummary().catch(() => null),
            ]);
            setDatasets(datasetsData);
            if (summaryData) setSummary(summaryData);
        } catch (err: any) {
            console.error("Failed to load datasets:", err);
            setError(err.message || "Failed to load datasets");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredDatasets = useMemo(() => {
        return datasets.filter((ds) => {
            const matchesSearch =
                searchTerm === "" ||
                ds.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ds.business_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ds.file_name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === "ALL" || ds.status === statusFilter;
            const matchesType = fileTypeFilter === "ALL" || ds.file_type === fileTypeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [datasets, searchTerm, statusFilter, fileTypeFilter]);

    const handleDelete = async (e: React.MouseEvent, id: string, businessId: string) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete dataset ${businessId}? This will remove associated events.`)) {
            return;
        }
        try {
            await datasetsApi.deleteDataset(id);
            setDatasets((prev) => prev.filter((d) => d.id !== id));
        } catch (err: any) {
            alert(`Failed to delete dataset: ${err.message}`);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "IMPORTED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Imported
                    </span>
                );
            case "READY_TO_IMPORT":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready to Import
                    </span>
                );
            case "IMPORTING":
            case "VALIDATING":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {status}
                    </span>
                );
            case "MAPPING_REQUIRED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Filter className="w-3.5 h-3.5" />
                        Mapping Required
                    </span>
                );
            case "MAPPED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mapped
                    </span>
                );
            case "FAILED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Failed
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

    const getQualityBadge = (score?: number | null, rating?: string | null) => {
        if (score === null || score === undefined) {
            return <span className="text-xs text-slate-500 font-mono">Pending</span>;
        }

        let color = "text-rose-400 bg-rose-500/10 border-rose-500/20";
        if (score >= 85) color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        else if (score >= 70) color = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
        else if (score >= 50) color = "text-amber-400 bg-amber-500/10 border-amber-500/20";

        return (
            <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
                    {score.toFixed(1)}%
                </span>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{rating || ""}</span>
            </div>
        );
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
                        <Database className="w-3.5 h-3.5" />
                        <span>Platform Telemetry & Ingestion</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                        Datasets & Security Event Telemetry
                        <span className="text-xs font-mono py-0.5 px-2 bg-slate-800 border border-slate-700 rounded-full text-slate-300 font-normal">
                            Step 13 Ingestion Pipeline
                        </span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Authoritative ingestion pipeline: File upload, type inference, schema mapping, deterministic 4-pillar validation, and canonical SecurityEvent ingestion.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
                        title="Refresh Registry"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>

                    {canUpload && (
                        <Link
                            href="/datasets/upload"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-cyan-900/20 transition"
                        >
                            <Upload className="w-4 h-4" />
                            Upload Dataset
                        </Link>
                    )}
                </div>
            </div>

            {/* Metrics Overview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium uppercase tracking-wider">Total Datasets</span>
                        <Database className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                        {summary?.total_datasets ?? datasets.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <span>Active telemetry packages</span>
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium uppercase tracking-wider">Imported & Ingested</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                        {summary?.imported_datasets ?? datasets.filter((d) => d.status === "IMPORTED").length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Ready for correlation & analytics
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium uppercase tracking-wider">Security Events</span>
                        <Shield className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-blue-400">
                        {summary?.total_events?.toLocaleString() ?? 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Canonical event instances in database
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-medium uppercase tracking-wider">Analytics Runs</span>
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-indigo-400">
                        {summary?.total_analytics_runs ?? 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Deterministic distributions completed
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    <span>{error}</span>
                </div>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search name, ID, or file..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition font-mono"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="UPLOADED">UPLOADED</option>
                            <option value="MAPPING_REQUIRED">MAPPING_REQUIRED</option>
                            <option value="MAPPED">MAPPED</option>
                            <option value="READY_TO_IMPORT">READY_TO_IMPORT</option>
                            <option value="IMPORTING">IMPORTING</option>
                            <option value="IMPORTED">IMPORTED</option>
                            <option value="FAILED">FAILED</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Type:</span>
                        <select
                            value={fileTypeFilter}
                            onChange={(e) => setFileTypeFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition font-mono"
                        >
                            <option value="ALL">All Types</option>
                            <option value="CSV">CSV</option>
                            <option value="JSON">JSON</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Datasets Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/60 text-xs font-mono uppercase text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="py-3 px-4">Dataset ID</th>
                                <th className="py-3 px-4">Name & Source</th>
                                <th className="py-3 px-4">Records</th>
                                <th className="py-3 px-4">File Info</th>
                                <th className="py-3 px-4">Quality Score</th>
                                <th className="py-3 px-4">Pipeline Status</th>
                                <th className="py-3 px-4">Uploaded By</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-sans">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                                        <span>Loading datasets...</span>
                                    </td>
                                </tr>
                            ) : filteredDatasets.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <FileText className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                                        <p className="text-base font-medium text-slate-300">No datasets found</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {searchTerm || statusFilter !== "ALL" || fileTypeFilter !== "ALL"
                                                ? "Try adjusting your search criteria or filters."
                                                : "Upload your first CSV or JSON dataset to initiate the ingestion pipeline."}
                                        </p>
                                        {canUpload && (
                                            <Link
                                                href="/datasets/upload"
                                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                Upload Dataset Now
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredDatasets.map((ds) => (
                                    <tr
                                        key={ds.id}
                                        onClick={() => router.push(`/datasets/${ds.id}`)}
                                        className="hover:bg-slate-800/40 cursor-pointer transition group"
                                    >
                                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">
                                            {ds.business_id}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-medium text-slate-200">{ds.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span>{ds.source_type}</span>
                                                {ds.organization_name && <span>• {ds.organization_name}</span>}
                                                {ds.related_cse_business_id && (
                                                    <span className="text-amber-400">
                                                        • CSE: {ds.related_cse_business_id}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                            <div>{ds.record_count.toLocaleString()} rows</div>
                                            {ds.valid_record_count > 0 && (
                                                <div className="text-[11px] text-emerald-400">
                                                    {ds.valid_record_count.toLocaleString()} valid
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                                            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 mr-1.5">
                                                {ds.file_type}
                                            </span>
                                            <span>{formatFileSize(ds.file_size)}</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {getQualityBadge(ds.quality_score, ds.quality_rating)}
                                        </td>
                                        <td className="py-3.5 px-4">{getStatusBadge(ds.status)}</td>
                                        <td className="py-3.5 px-4 text-xs text-slate-400">
                                            <div>{ds.uploaded_by_name || "Analyst"}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {new Date(ds.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Link
                                                    href={`/datasets/${ds.id}`}
                                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
                                                    title="View Dossier"
                                                >
                                                    <ArrowUpRight className="w-4 h-4" />
                                                </Link>
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => handleDelete(e, ds.id, ds.business_id)}
                                                        className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition"
                                                        title="Delete Dataset"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
