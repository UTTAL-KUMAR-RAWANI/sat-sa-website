"use client";

import React, { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import {
    negativeSpaceApi,
    NegativeSpaceAssessmentDetail,
    NegativeSpaceSignal,
} from "@/lib/api/negative-space";
import {
    ArrowLeft,
    EyeOff,
    Search,
    Filter,
    RefreshCw,
    ShieldAlert,
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    Sliders,
} from "lucide-react";

export default function AssessmentSignalsListPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const assessmentId = resolvedParams.id;
    const router = useRouter();
    const { user } = useAuth();

    const [assessment, setAssessment] = useState<NegativeSpaceAssessmentDetail | null>(null);
    const [signals, setSignals] = useState<NegativeSpaceSignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [asmt, sigs] = await Promise.all([
                negativeSpaceApi.getAssessment(assessmentId),
                negativeSpaceApi.listSignals({ assessment_id: assessmentId, limit: 100 }),
            ]);
            setAssessment(asmt);
            setSignals(sigs.items);
        } catch (err: any) {
            console.error("Failed to load signals:", err);
            setError(err.message || "Failed to load signals");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [assessmentId]);

    const filtered = useMemo(() => {
        return signals.filter((s) => {
            const matchesSearch =
                searchTerm === "" ||
                s.business_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.gap_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.source && s.source.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCat = categoryFilter === "ALL" || s.category === categoryFilter;
            const matchesSev = severityFilter === "ALL" || s.severity === severityFilter;
            const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
            return matchesSearch && matchesCat && matchesSev && matchesStatus;
        });
    }, [signals, searchTerm, categoryFilter, severityFilter, statusFilter]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-start gap-4">
                    <Link
                        href={`/negative-space/${assessmentId}`}
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition mt-1"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold text-sm">
                                {assessment?.business_id || "Assessment"}
                            </span>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-300 font-medium text-sm">Signals Registry</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
                            Negative-Space Signals Review Queue
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Human review workspace for detected monitoring blind spots and absent security telemetry
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search signals by keyword or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                </div>

                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50"
                >
                    <option value="ALL">All Categories</option>
                    <option value="MONITORING_BLIND_SPOT">Monitoring Blind Spot</option>
                    <option value="TELEMETRY_SILENCE">Telemetry Silence</option>
                    <option value="AUTHENTICATION_DEFICIT">Authentication Deficit</option>
                    <option value="ALERT_DEFICIT">Alert Deficit</option>
                    <option value="CONTROL_ABSENCE">Control Absence</option>
                    <option value="COVERAGE_DEGRADATION">Coverage Degradation</option>
                </select>

                <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50"
                >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50"
                >
                    <option value="ALL">All Statuses</option>
                    <option value="DETECTED">Detected</option>
                    <option value="REVIEWING">Reviewing</option>
                    <option value="VALIDATED">Validated</option>
                    <option value="DISMISSED">Dismissed</option>
                    <option value="CONVERTED_TO_FINDING">Converted to Finding</option>
                </select>
            </div>

            {/* Signals Table */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold">Signal ID</th>
                                <th className="px-5 py-3.5 font-semibold">Category & Semantics</th>
                                <th className="px-5 py-3.5 font-semibold">Magnitude</th>
                                <th className="px-5 py-3.5 font-semibold">Severity</th>
                                <th className="px-5 py-3.5 font-semibold">Confidence</th>
                                <th className="px-5 py-3.5 font-semibold">Data Quality</th>
                                <th className="px-5 py-3.5 font-semibold">Status</th>
                                <th className="px-5 py-3.5 font-semibold text-right">Workspace</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                                        Loading signals...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                                        No signals found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((s) => (
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
                                        </td>
                                        <td className="px-5 py-4 font-mono font-bold text-white">
                                            {s.gap_percentage.toFixed(0)}%
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    s.severity === "CRITICAL"
                                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                                        : s.severity === "HIGH"
                                                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                }`}
                                            >
                                                {s.severity}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs font-medium text-slate-300">
                                            {s.confidence}
                                        </td>
                                        <td className="px-5 py-4">
                                            {s.data_quality_concern ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Concern
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500">Verified</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <Link
                                                href={`/negative-space/signals/${s.id}`}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 transition"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Review Workspace
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
        </div>
    );
}
