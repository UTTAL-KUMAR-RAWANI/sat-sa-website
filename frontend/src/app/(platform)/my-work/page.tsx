"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    CheckSquare,
    Clock,
    AlertTriangle,
    ShieldAlert,
    FileCheck,
    Search,
    ChevronRight,
    ExternalLink,
    Filter,
    RefreshCw,
    Calendar,
    Briefcase,
    Activity,
} from "lucide-react";
import { myWorkApi, WorkItem, MyWorkSummaryResponse } from "@/lib/api/my-work";

export default function MyWorkPage() {
    const [summary, setSummary] = useState<MyWorkSummaryResponse | null>(null);
    const [items, setItems] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"all" | "needs_review" | "overdue" | "critical" | "assigned">("all");
    const [resourceFilter, setResourceFilter] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryRes, itemsRes] = await Promise.all([
                myWorkApi.getSummary(),
                myWorkApi.getMyWork(activeTab),
            ]);
            setSummary(summaryRes);
            setItems(itemsRes.items);
        } catch (err) {
            console.error("Failed to load My Work data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const filteredItems = items.filter((item) => {
        if (resourceFilter && item.item_type.toLowerCase() !== resourceFilter.toLowerCase()) {
            return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.title.toLowerCase().includes(q) ||
            item.business_id.toLowerCase().includes(q) ||
            item.item_type.toLowerCase().includes(q) ||
            item.status.toLowerCase().includes(q)
        );
    });

    const getSeverityBadge = (sev: string | null) => {
        if (!sev) return null;
        const s = sev.toUpperCase();
        if (s.includes("CRITICAL") || s.includes("EXTREME") || s.includes("HIGH") || s.includes("P1") || s.includes("P2")) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                    <ShieldAlert className="h-2.5 w-2.5" /> {sev}
                </span>
            );
        }
        if (s.includes("MEDIUM") || s.includes("MODERATE") || s.includes("P3")) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="h-2.5 w-2.5" /> {sev}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700">
                {sev}
            </span>
        );
    };

    const getCategoryPill = (item: WorkItem) => {
        if (item.is_overdue) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/40">
                    <Clock className="h-2.5 w-2.5" /> OVERDUE
                </span>
            );
        }
        if (item.needs_review) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/40">
                    <FileCheck className="h-2.5 w-2.5" /> NEEDS REVIEW
                </span>
            );
        }
        if (item.is_critical) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 border border-purple-500/40">
                    <ShieldAlert className="h-2.5 w-2.5" /> CRITICAL EXPOSURE
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                ASSIGNED WORK
            </span>
        );
    };

    const formatDueDate = (dateStr: string | null | undefined, isOverdue: boolean) => {
        if (!dateStr) return <span className="text-slate-500 text-[11px]">No Due Date</span>;
        const d = new Date(dateStr);
        return (
            <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-500" />
                <span className={`text-[11px] font-mono ${isOverdue ? "text-rose-400 font-bold" : "text-slate-400"}`}>
                    {d.toLocaleDateString()}
                </span>
                {isOverdue && (
                    <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-400 border border-rose-500/30">
                        LATE
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckSquare className="h-4 w-4" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white">My Work & Attention Center</h1>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Consolidated task queue, review pipeline, and prioritized supervisory workload
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors w-fit"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Refresh Queue</span>
                </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                    onClick={() => setActiveTab("needs_review")}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        activeTab === "needs_review"
                            ? "border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Needs Review
                        </span>
                        <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
                            <FileCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {summary ? summary.needs_review_count : "—"}
                        </span>
                        <span className="text-[11px] text-slate-400">awaiting decision</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("overdue")}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        activeTab === "overdue"
                            ? "border-rose-500/50 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Overdue
                        </span>
                        <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400">
                            <Clock className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {summary ? summary.overdue_count : "—"}
                        </span>
                        <span className="text-[11px] text-rose-400 font-medium">past SLA / due date</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("critical")}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        activeTab === "critical"
                            ? "border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Critical Exposures
                        </span>
                        <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
                            <ShieldAlert className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {summary ? summary.critical_count : "—"}
                        </span>
                        <span className="text-[11px] text-slate-400">critical severity</span>
                    </div>
                </div>

                <div
                    onClick={() => setActiveTab("assigned")}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        activeTab === "assigned"
                            ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            My Assigned Work
                        </span>
                        <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                            <Briefcase className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {summary ? summary.total_assigned : "—"}
                        </span>
                        <span className="text-[11px] text-slate-400">active tasks</span>
                    </div>
                </div>
            </div>

            {/* Filter and Tab Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                {/* Bucket Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                    <button
                        onClick={() => setActiveTab("all")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === "all"
                                ? "bg-slate-800 text-white shadow"
                                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                    >
                        All Work Items ({summary ? (summary.total_assigned + summary.needs_review_count) : 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("needs_review")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === "needs_review"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                    >
                        Needs Review ({summary ? summary.needs_review_count : 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("overdue")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === "overdue"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                    >
                        Overdue ({summary ? summary.overdue_count : 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("critical")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === "critical"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                    >
                        Critical Exposures ({summary ? summary.critical_count : 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("assigned")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === "assigned"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                    >
                        Assigned ({summary ? summary.total_assigned : 0})
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Filter queue..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-44 sm:w-56 rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    <select
                        value={resourceFilter}
                        onChange={(e) => setResourceFilter(e.target.value)}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">All Types</option>
                        <option value="CSE">CSE Exposure</option>
                        <option value="Finding">Finding</option>
                        <option value="Assessment">Assessment</option>
                        <option value="Risk">Risk</option>
                        <option value="Remediation">Remediation</option>
                        <option value="SupervisoryCase">Supervisory Case</option>
                    </select>
                </div>
            </div>

            {/* Work Item List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {loading ? (
                    <div className="flex h-56 items-center justify-center text-xs text-slate-400">
                        Aggregating work queue...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <CheckSquare className="h-10 w-10 text-slate-600 mb-3" />
                        <h3 className="text-sm font-semibold text-slate-300">No Action Items in this Queue</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                            You have no pending items matching the selected attention filter. Everything is up to date!
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/80">
                        {filteredItems.map((item) => (
                            <Link
                                key={item.id}
                                href={item.action_url}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 transition-colors hover:bg-slate-850/60"
                            >
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {getCategoryPill(item)}
                                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                            {item.business_id}
                                        </span>
                                        <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                                            {item.item_type}
                                        </span>
                                        {getSeverityBadge(item.severity)}
                                    </div>
                                    <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                        {item.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                        <div>
                                            Status:{" "}
                                            <span className="font-mono text-slate-200 uppercase font-semibold">
                                                {item.status}
                                            </span>
                                        </div>
                                        <span>•</span>
                                        <div>
                                            Role: <span className="text-slate-300">{item.role_relationship}</span>
                                        </div>
                                        <span>•</span>
                                        {formatDueDate(item.due_date, item.is_overdue)}
                                        <span>•</span>
                                        <span className="text-[11px] text-slate-500">
                                            Created {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">
                                    <span className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors">
                                        <span>Open</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
