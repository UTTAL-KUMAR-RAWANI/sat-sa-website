"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    datasetsApi,
    DatasetItem,
    DatasetImportItem,
    SecurityEventItem,
    AnalyticsRunItem,
} from "@/lib/api/datasets";
import {
    Database,
    ArrowLeft,
    Shield,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Layers,
    Table,
    BarChart3,
    Activity,
    FileText,
    RefreshCw,
    Download,
    Play,
    Eye,
    Hash,
    Calendar,
    User as UserIcon,
    Server,
    ExternalLink,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
} from "recharts";

interface PageProps {
    params: Promise<{ id: string }>;
}

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#eab308",
    LOW: "#3b82f6",
    INFORMATIONAL: "#94a3b8",
};

const CHART_COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export default function DatasetDetailPage({ params }: PageProps) {
    const resolvedParams = use(params);
    const datasetId = resolvedParams.id;
    const router = useRouter();
    const { user } = useAuth();

    // Active Tab: overview, schema, preview, validation, imports, events, analytics
    const [activeTab, setActiveTab] = useState<
        "overview" | "schema" | "preview" | "validation" | "imports" | "events" | "analytics"
    >("overview");

    const [dataset, setDataset] = useState<DatasetItem | null>(null);
    const [imports, setImports] = useState<DatasetImportItem[]>([]);
    const [events, setEvents] = useState<SecurityEventItem[]>([]);
    const [previewData, setPreviewData] = useState<any>(null);
    const [analytics, setAnalytics] = useState<AnalyticsRunItem["results_summary"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Event Viewer modal
    const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null);

    // Analytics running state
    const [runningAnalytics, setRunningAnalytics] = useState(false);

    const canImport = user ? hasPermission(user, Permissions.DATASET_IMPORT) : false;
    const canRunAnalytics = user ? hasPermission(user, Permissions.ANALYTICS_RUN) : false;

    const loadDatasetData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await datasetsApi.getDataset(datasetId);
            setDataset(data);

            // Fetch imports and events in parallel
            const [importsData, eventsData, analyticsData] = await Promise.all([
                datasetsApi.getDatasetImports(datasetId).catch(() => []),
                datasetsApi.getDatasetEvents(datasetId, { limit: 100 }).catch(() => []),
                datasetsApi.getDatasetAnalytics(datasetId).catch(() => null),
            ]);

            setImports(importsData);
            setEvents(eventsData);
            if (analyticsData) setAnalytics(analyticsData);
        } catch (err: any) {
            console.error("Failed to load dataset dossier:", err);
            setError(err.message || "Failed to load dataset details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (datasetId) {
            loadDatasetData();
        }
    }, [datasetId]);

    // Lazy load preview data when tab clicked
    const loadPreview = async () => {
        if (previewData || !datasetId) return;
        try {
            const res = await datasetsApi.previewDataset(datasetId, 25);
            setPreviewData(res);
        } catch (err: any) {
            console.error("Preview failed:", err);
        }
    };

    const handleTabChange = (tab: typeof activeTab) => {
        setActiveTab(tab);
        if (tab === "preview") loadPreview();
    };

    const handleTriggerAnalytics = async () => {
        if (!datasetId) return;
        setRunningAnalytics(true);
        try {
            const run = await datasetsApi.runAnalytics({
                dataset_id: datasetId,
                analysis_type: "SECURITY_SUMMARY",
            });
            if (run.results_summary) {
                setAnalytics(run.results_summary);
            }
        } catch (err: any) {
            alert(`Failed to run analytics: ${err.message}`);
        } finally {
            setRunningAnalytics(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                    <p className="text-sm font-mono text-slate-400">Loading dataset dossier...</p>
                </div>
            </div>
        );
    }

    if (error || !dataset) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
                <div className="max-w-xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 text-center">
                    <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                    <h2 className="text-lg font-bold text-white">Dataset Not Found or Inaccessible</h2>
                    <p className="text-sm text-slate-400">{error || "The requested dataset could not be retrieved."}</p>
                    <Link
                        href="/datasets"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Registry
                    </Link>
                </div>
            </div>
        );
    }

    // Chart Data Transformations
    const severityChartData = analytics?.severity_distribution
        ? Object.entries(analytics.severity_distribution).map(([name, value]) => ({
              name,
              value,
              color: SEVERITY_COLORS[name] || "#94a3b8",
          }))
        : [];

    const eventTypeChartData = analytics?.event_type_distribution
        ? Object.entries(analytics.event_type_distribution)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([name, count]) => ({ name, count }))
        : [];

    const timeSeriesData = analytics?.time_series || [];

    const topIpsData = analytics?.top_source_ips || [];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
                        <Link href="/datasets" className="hover:underline flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5" /> Datasets
                        </Link>
                        <span>/</span>
                        <span>{dataset.business_id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-white">{dataset.name}</h1>
                        <span className="text-xs font-mono py-0.5 px-2 bg-slate-800 border border-slate-700 rounded text-cyan-400">
                            {dataset.file_type}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Source: <span className="text-slate-300 font-medium">{dataset.source_type}</span> • File:{" "}
                        <span className="font-mono text-slate-300">{dataset.file_name}</span> • Ingested:{" "}
                        <span>{new Date(dataset.created_at).toLocaleString()}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {dataset.status === "READY_TO_IMPORT" && canImport && (
                        <button
                            onClick={async () => {
                                try {
                                    await datasetsApi.importDataset(dataset.id);
                                    loadDatasetData();
                                } catch (e: any) {
                                    alert(`Import failed: ${e.message}`);
                                }
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                        >
                            <Play className="w-4 h-4" /> Run Ingestion
                        </button>
                    )}

                    {canRunAnalytics && (
                        <button
                            onClick={handleTriggerAnalytics}
                            disabled={runningAnalytics}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${runningAnalytics ? "animate-spin" : ""}`} />
                            Recompute Analytics
                        </button>
                    )}
                </div>
            </div>

            {/* Quality and Status Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-xs font-mono uppercase text-slate-400 block mb-1">Pipeline State</span>
                    <div className="text-lg font-bold font-mono text-white flex items-center gap-2">
                        {dataset.status === "IMPORTED" ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Ingested & Active
                            </span>
                        ) : dataset.status === "READY_TO_IMPORT" ? (
                            <span className="text-cyan-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Ready to Ingest
                            </span>
                        ) : (
                            <span>{dataset.status}</span>
                        )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Authoritative lifecycle stage</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-xs font-mono uppercase text-slate-400 block mb-1">Data Quality Score</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono text-cyan-400">
                            {dataset.quality_score !== null && dataset.quality_score !== undefined
                                ? `${dataset.quality_score.toFixed(1)}%`
                                : "N/A"}
                        </span>
                        {dataset.quality_rating && (
                            <span className="text-xs font-mono font-bold uppercase text-slate-300">
                                ({dataset.quality_rating})
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">4-pillar deterministic score</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-xs font-mono uppercase text-slate-400 block mb-1">Total Records</span>
                    <div className="text-2xl font-bold font-mono text-white">
                        {dataset.record_count.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-emerald-400 mt-1 block">
                        {dataset.valid_record_count.toLocaleString()} valid • {dataset.invalid_record_count} invalid
                    </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-xs font-mono uppercase text-slate-400 block mb-1">Security Events</span>
                    <div className="text-2xl font-bold font-mono text-blue-400">
                        {events.length.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Canonical events in registry</span>
                </div>
            </div>

            {/* Dossier Tabs Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto text-sm font-medium">
                {[
                    { id: "overview", label: "Overview & Provenance", icon: FileText },
                    { id: "schema", label: "Schema & Fields", icon: Layers },
                    { id: "preview", label: "Raw Preview", icon: Eye },
                    { id: "validation", label: "Quality Assessment", icon: Shield },
                    { id: "imports", label: `Ingestion Runs (${imports.length})`, icon: Clock },
                    { id: "events", label: `Security Events (${events.length})`, icon: Database },
                    { id: "analytics", label: "Analytics & Telemetry", icon: BarChart3 },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-mono text-xs uppercase tracking-wider transition ${
                                isActive
                                    ? "border-cyan-500 text-cyan-400 bg-cyan-500/5 font-bold"
                                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: Overview */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                            <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                Ingestion Provenance & Metadata
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                <div>
                                    <span className="text-slate-500 block">Dataset Name</span>
                                    <span className="text-slate-200 font-sans font-medium text-sm">{dataset.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Telemetry Source</span>
                                    <span className="text-slate-200">{dataset.source_type}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Uploaded By</span>
                                    <span className="text-slate-200">{dataset.uploaded_by_name || "Analyst"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Target Organization</span>
                                    <span className="text-slate-200">{dataset.organization_name || "Enterprise"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Original Filename</span>
                                    <span className="text-slate-200">{dataset.file_name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">File Size</span>
                                    <span className="text-slate-200">
                                        {(dataset.file_size / (1024 * 1024)).toFixed(2)} MB
                                    </span>
                                </div>
                            </div>

                            {dataset.description && (
                                <div className="pt-3 border-t border-slate-800/80">
                                    <span className="text-xs font-mono text-slate-500 block mb-1">Description</span>
                                    <p className="text-sm text-slate-300">{dataset.description}</p>
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-800/80">
                                <span className="text-xs font-mono text-slate-500 block mb-1">
                                    Cryptographic File Hash (SHA-256)
                                </span>
                                <code className="text-xs font-mono text-slate-400 bg-slate-950 p-2 rounded block break-all border border-slate-800">
                                    {dataset.file_hash}
                                </code>
                            </div>
                        </div>

                        {/* Linked CSE */}
                        {dataset.related_cse_business_id && (
                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    <div>
                                        <div className="text-sm font-semibold text-white">Linked Cyber Security Event (CSE)</div>
                                        <div className="text-xs text-slate-400">
                                            Telemetry attached to investigation dossier {dataset.related_cse_business_id}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={`/cse`}
                                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-400 transition"
                                >
                                    View CSE →
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Quality Summary Column */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                            <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                Quality Scorecard
                            </h3>
                            {dataset.validation_summary ? (
                                <div className="space-y-3 font-mono text-xs">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-400">Validity (35% wt)</span>
                                            <span className="text-emerald-400 font-bold">
                                                {dataset.validation_summary.validity_pct}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-emerald-500 h-full rounded-full"
                                                style={{ width: `${dataset.validation_summary.validity_pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-400">Completeness (30% wt)</span>
                                            <span className="text-cyan-400 font-bold">
                                                {dataset.validation_summary.completeness_pct}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-cyan-500 h-full rounded-full"
                                                style={{ width: `${dataset.validation_summary.completeness_pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-400">Conformity (20% wt)</span>
                                            <span className="text-blue-400 font-bold">
                                                {dataset.validation_summary.conformity_pct}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full"
                                                style={{ width: `${dataset.validation_summary.conformity_pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-400">Uniqueness (15% wt)</span>
                                            <span className="text-indigo-400 font-bold">
                                                {dataset.validation_summary.uniqueness_pct}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-indigo-500 h-full rounded-full"
                                                style={{ width: `${dataset.validation_summary.uniqueness_pct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Validation metrics pending.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Schema */}
            {activeTab === "schema" && (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                        Detected Schema & Canonical Field Mappings
                    </h3>

                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
                        <table className="w-full text-left text-xs font-mono text-slate-300">
                            <thead className="bg-slate-900/60 uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-2.5 px-4">Raw Column Name</th>
                                    <th className="py-2.5 px-4">Inferred Type</th>
                                    <th className="py-2.5 px-4">Null Count</th>
                                    <th className="py-2.5 px-4">Sample Values</th>
                                    <th className="py-2.5 px-4">Mapped Canonical Field</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {(dataset.detected_schema?.columns || []).map((col) => {
                                    const mappedField = dataset.column_mapping?.[col.column_name];
                                    return (
                                        <tr key={col.column_name} className="hover:bg-slate-900/40">
                                            <td className="py-2.5 px-4 font-bold text-slate-200">{col.column_name}</td>
                                            <td className="py-2.5 px-4">
                                                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400">
                                                    {col.inferred_type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-400">{col.null_count}</td>
                                            <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">
                                                {col.sample_values?.join(", ") || "-"}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                {mappedField ? (
                                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        {mappedField}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 italic">Unmapped</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: Preview */}
            {activeTab === "preview" && (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                        Raw Telemetry Sample Preview
                    </h3>

                    {previewData ? (
                        <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950/50">
                            <table className="w-full text-left text-xs font-mono text-slate-300">
                                <thead className="bg-slate-900/60 uppercase text-slate-400 border-b border-slate-800">
                                    <tr>
                                        {previewData.columns?.map((col: string) => (
                                            <th key={col} className="py-2 px-3 whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {previewData.sample_rows?.map((row: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-900/40">
                                            {previewData.columns?.map((col: string) => (
                                                <td key={col} className="py-2 px-3 whitespace-nowrap max-w-xs truncate">
                                                    {String(row[col] ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                            Loading preview records...
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: Validation */}
            {activeTab === "validation" && (
                <div className="space-y-6">
                    <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                        <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                            Authoritative 4-Pillar Validation Findings
                        </h3>
                        <p className="text-xs text-slate-400">
                            Every row is evaluated against strict IP format checks, ISO 8601 timestamps, schema conformity, and duplicates.
                        </p>

                        {dataset.validation_summary ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                                    <span className="text-xs font-mono text-slate-500 block">Total Checked</span>
                                    <span className="text-xl font-bold font-mono text-white">
                                        {dataset.validation_summary.total_records}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                                    <span className="text-xs font-mono text-slate-500 block">Valid Rows</span>
                                    <span className="text-xl font-bold font-mono text-emerald-400">
                                        {dataset.validation_summary.valid_records}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                                    <span className="text-xs font-mono text-slate-500 block">Invalid Rows</span>
                                    <span className="text-xl font-bold font-mono text-rose-400">
                                        {dataset.validation_summary.invalid_records}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                                    <span className="text-xs font-mono text-slate-500 block">Duplicate Rows</span>
                                    <span className="text-xl font-bold font-mono text-amber-400">
                                        {dataset.validation_summary.duplicate_records}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* TAB 5: Ingestion Runs */}
            {activeTab === "imports" && (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                        Ingestion Execution History
                    </h3>

                    {imports.length === 0 ? (
                        <p className="text-xs text-slate-500">No ingestion runs executed yet.</p>
                    ) : (
                        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
                            <table className="w-full text-left text-xs font-mono text-slate-300">
                                <thead className="bg-slate-900/60 uppercase text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-2.5 px-4">Run ID</th>
                                        <th className="py-2.5 px-4">Started At</th>
                                        <th className="py-2.5 px-4">Status</th>
                                        <th className="py-2.5 px-4">Processed</th>
                                        <th className="py-2.5 px-4">Imported</th>
                                        <th className="py-2.5 px-4">Rejected</th>
                                        <th className="py-2.5 px-4">Started By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {imports.map((imp) => (
                                        <tr key={imp.id} className="hover:bg-slate-900/40">
                                            <td className="py-2.5 px-4 font-bold text-cyan-400">{imp.business_id}</td>
                                            <td className="py-2.5 px-4 text-slate-400">
                                                {new Date(imp.started_at).toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        imp.status === "COMPLETED"
                                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                    }`}
                                                >
                                                    {imp.status}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-200">{imp.records_processed}</td>
                                            <td className="py-2.5 px-4 text-emerald-400 font-bold">{imp.records_imported}</td>
                                            <td className="py-2.5 px-4 text-rose-400">{imp.records_rejected}</td>
                                            <td className="py-2.5 px-4 text-slate-400">{imp.started_by_name || "Analyst"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: Security Events Table */}
            {activeTab === "events" && (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                Canonical Security Events Registry ({events.length})
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Normalized canonical events persisted from dataset. Click any row for raw payload viewer.
                            </p>
                        </div>
                    </div>

                    <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950/50">
                        <table className="w-full text-left text-xs font-mono text-slate-300">
                            <thead className="bg-slate-900/60 uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-2.5 px-3">Event Ref</th>
                                    <th className="py-2.5 px-3">Occurred At</th>
                                    <th className="py-2.5 px-3">Event Type</th>
                                    <th className="py-2.5 px-3">Severity</th>
                                    <th className="py-2.5 px-3">Source IP</th>
                                    <th className="py-2.5 px-3">Target IP</th>
                                    <th className="py-2.5 px-3">Asset ID</th>
                                    <th className="py-2.5 px-3">User</th>
                                    <th className="py-2.5 px-3">Action</th>
                                    <th className="py-2.5 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {events.map((evt) => (
                                    <tr
                                        key={evt.id}
                                        onClick={() => setSelectedEvent(evt)}
                                        className="hover:bg-slate-900/60 cursor-pointer transition"
                                    >
                                        <td className="py-2 px-3 font-bold text-cyan-400">{evt.business_id}</td>
                                        <td className="py-2 px-3 text-slate-400">
                                            {evt.occurred_at ? new Date(evt.occurred_at).toLocaleString() : "-"}
                                        </td>
                                        <td className="py-2 px-3 text-slate-200">{evt.event_type}</td>
                                        <td className="py-2 px-3">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    evt.severity === "CRITICAL"
                                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                        : evt.severity === "HIGH"
                                                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                                        : evt.severity === "MEDIUM"
                                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                }`}
                                            >
                                                {evt.severity}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-300">{evt.source_ip || "-"}</td>
                                        <td className="py-2 px-3 text-slate-300">{evt.destination_ip || "-"}</td>
                                        <td className="py-2 px-3 text-slate-400">{evt.asset_id || "-"}</td>
                                        <td className="py-2 px-3 text-slate-400">{evt.user_identifier || "-"}</td>
                                        <td className="py-2 px-3 text-slate-300">{evt.action || "-"}</td>
                                        <td className="py-2 px-3 text-slate-400">{evt.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 7: Analytics & Charts */}
            {activeTab === "analytics" && (
                <div className="space-y-6">
                    {analytics ? (
                        <>
                            {/* Distribution Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Severity Distribution Chart */}
                                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                        Severity Distribution
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={severityChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                                                <YAxis stroke="#64748b" fontSize={11} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "#020617",
                                                        borderColor: "#1e293b",
                                                        borderRadius: "0.5rem",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                    {severityChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Event Type Distribution */}
                                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                        Event Type Distribution (Top Categories)
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={eventTypeChartData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis type="number" stroke="#64748b" fontSize={11} />
                                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={110} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "#020617",
                                                        borderColor: "#1e293b",
                                                        borderRadius: "0.5rem",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Time-Series Ingestion Distribution */}
                            {timeSeriesData.length > 0 && (
                                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-4">
                                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                        Time Series Occurrence Trend
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={timeSeriesData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                                                <YAxis stroke="#64748b" fontSize={11} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "#020617",
                                                        borderColor: "#1e293b",
                                                        borderRadius: "0.5rem",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                                <Legend />
                                                <Line
                                                    type="monotone"
                                                    dataKey="total"
                                                    name="Total Events"
                                                    stroke="#06b6d4"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="critical"
                                                    name="Critical"
                                                    stroke="#ef4444"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="high"
                                                    name="High"
                                                    stroke="#f97316"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Top Entities Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
                                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                        Top Originating Source IPs
                                    </h3>
                                    <div className="space-y-2">
                                        {topIpsData.slice(0, 6).map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-2.5 rounded bg-slate-950/60 border border-slate-800 text-xs font-mono"
                                            >
                                                <span className="text-slate-300 font-bold">{item.ip}</span>
                                                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                                                    {item.count} events
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
                                    <h3 className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                                        Telemetry Summary Stats
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                        <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                                            <span className="text-slate-500 block">Unique Assets</span>
                                            <span className="text-lg font-bold text-white">
                                                {analytics.unique_assets}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                                            <span className="text-slate-500 block">Unique Users</span>
                                            <span className="text-lg font-bold text-white">
                                                {analytics.unique_users}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                                            <span className="text-slate-500 block">Unique Source IPs</span>
                                            <span className="text-lg font-bold text-cyan-400">
                                                {analytics.unique_source_ips}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded bg-slate-950/60 border border-slate-800">
                                            <span className="text-slate-500 block">Unique Target IPs</span>
                                            <span className="text-lg font-bold text-blue-400">
                                                {analytics.unique_destination_ips}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-16 text-center text-slate-500 space-y-3 border border-slate-800 rounded-xl bg-slate-900/20">
                            <BarChart3 className="w-8 h-8 mx-auto text-slate-600" />
                            <p className="text-sm text-slate-300">No analytics distributions computed yet.</p>
                            <button
                                onClick={handleTriggerAnalytics}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition"
                            >
                                Calculate Initial Analytics
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Event Detail Drawer / Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-cyan-400" />
                                <span className="text-base font-bold text-white font-mono">
                                    {selectedEvent.business_id}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                            <div>
                                <span className="text-slate-500 block">Event Type</span>
                                <span className="text-slate-200">{selectedEvent.event_type}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Severity</span>
                                <span className="text-slate-200">{selectedEvent.severity}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Occurred At</span>
                                <span className="text-slate-200">
                                    {selectedEvent.occurred_at
                                        ? new Date(selectedEvent.occurred_at).toLocaleString()
                                        : "N/A"}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Source IP</span>
                                <span className="text-slate-200">{selectedEvent.source_ip || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Destination IP</span>
                                <span className="text-slate-200">{selectedEvent.destination_ip || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Asset ID</span>
                                <span className="text-slate-200">{selectedEvent.asset_id || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">User Account</span>
                                <span className="text-slate-200">{selectedEvent.user_identifier || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Action / Status</span>
                                <span className="text-slate-200">
                                    {selectedEvent.action || "OBSERVED"} / {selectedEvent.status}
                                </span>
                            </div>
                        </div>

                        {selectedEvent.description && (
                            <div className="pt-2">
                                <span className="text-xs font-mono text-slate-500 block mb-1">Description</span>
                                <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                                    {selectedEvent.description}
                                </p>
                            </div>
                        )}

                        {selectedEvent.raw_metadata && (
                            <div className="pt-2">
                                <span className="text-xs font-mono text-slate-500 block mb-1">Raw Metadata Payload</span>
                                <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto max-h-48">
                                    {JSON.stringify(selectedEvent.raw_metadata, null, 2)}
                                </pre>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
