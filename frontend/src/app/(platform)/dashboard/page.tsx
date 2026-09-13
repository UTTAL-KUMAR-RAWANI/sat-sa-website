"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { myWorkApi, MyWorkSummaryResponse, WorkItem } from "@/lib/api/my-work";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import SeverityBadge from "@/components/common/SeverityBadge";
import EmptyState from "@/components/common/EmptyState";
import { KpiGridSkeleton } from "@/components/common/LoadingSkeleton";
import { Permissions, hasPermission, hasAnyPermission } from "@/lib/rbac/permissions";
import {
    Shield,
    Activity,
    ShieldAlert,
    Clock,
    FileCheck,
    Briefcase,
    ChevronRight,
    ArrowRight,
    FileWarning,
    Wrench,
    Gavel,
    Database,
    ShieldCheck,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";

export default function DashboardPage() {
    const { user } = useAuth();
    const [summary, setSummary] = useState<MyWorkSummaryResponse | null>(null);
    const [urgentItems, setUrgentItems] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [summaryRes, workRes] = await Promise.all([
                myWorkApi.getSummary(),
                myWorkApi.getMyWork("needs_review"),
            ]);
            setSummary(summaryRes);
            setUrgentItems(workRes.items.slice(0, 5));
        } catch (err) {
            console.error("Failed to load dashboard metrics", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const primaryRole = user?.roles?.[0] || "Operator";
    const department = user?.department || "Platform Supervision";
    const scope = user?.scope || "Organization";

    return (
        <div className="space-y-8">
            {/* Header Greeting & Context */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                            Supervisory Operations Dashboard
                        </h1>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Welcome back, <span className="font-semibold text-slate-200">{user?.first_name || user?.username}</span>. Live regulatory oversight & exposure telemetry.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadDashboardData}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                        title="Refresh metrics"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>

                    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            {primaryRole}
                        </span>
                        <span className="text-slate-400 text-[11px] capitalize">{scope} Scope</span>
                    </div>
                </div>
            </div>

            {/* Top Operational KPI Grid */}
            {loading ? (
                <KpiGridSkeleton count={4} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        title="Needs Review"
                        value={summary ? summary.needs_review_count : 0}
                        subtitle="Awaiting Sign-Off"
                        caption="Assessments & cases ready for evaluation"
                        icon={<FileCheck className="h-4 w-4 text-amber-400" />}
                        variant="warning"
                        href="/my-work"
                    />

                    <KpiCard
                        title="Overdue Items"
                        value={summary ? summary.overdue_count : 0}
                        subtitle="Past Target SLA"
                        caption="Remediations & cases requiring escalation"
                        icon={<Clock className="h-4 w-4 text-rose-400" />}
                        variant="danger"
                        href="/my-work"
                    />

                    <KpiCard
                        title="Critical Exposures"
                        value={summary ? summary.critical_count : 0}
                        subtitle="Critical / High"
                        caption="Severe risks & high impact findings"
                        icon={<ShieldAlert className="h-4 w-4 text-purple-400" />}
                        variant="purple"
                        href="/my-work"
                    />

                    <KpiCard
                        title="Assigned Tasks"
                        value={summary ? summary.total_assigned : 0}
                        subtitle="Active Workload"
                        caption="Total items assigned to your profile"
                        icon={<Briefcase className="h-4 w-4 text-emerald-400" />}
                        variant="accent"
                        href="/my-work"
                    />
                </div>
            )}

            {/* Two-Column Layout: Attention Queue vs Quick Module Launchers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Actionable Attention Items */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-amber-400" />
                                <span>Immediate Attention Queue</span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                Work items awaiting your review, approval, or decision
                            </p>
                        </div>
                        <Link
                            href="/my-work"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <span>Open My Work</span>
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                        {loading ? (
                            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                                Loading attention queue...
                            </div>
                        ) : urgentItems.length === 0 ? (
                            <div className="p-8 text-center">
                                <EmptyState
                                    icon={<Shield className="h-8 w-8 text-emerald-400" />}
                                    title="Queue Fully Caught Up"
                                    description="No urgent reviews or approval bottlenecks pending your sign-off."
                                    actionLabel="Inspect Full Workload"
                                    actionHref="/my-work"
                                />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/80">
                                {urgentItems.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={item.action_url}
                                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 transition-colors hover:bg-slate-800/40"
                                    >
                                        <div className="space-y-1.5 flex-1 pr-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    {item.business_id}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                                    {item.item_type}
                                                </span>
                                                <SeverityBadge severity={item.severity} />
                                            </div>
                                            <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                                {item.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                <span>Status: <strong className="text-slate-200">{item.status}</strong></span>
                                                <span>•</span>
                                                <span>Role: {item.role_relationship}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
                                            <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                                                <span>Review</span>
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Workflow Quick Launchers */}
                <div className="space-y-4">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            Core Modules
                        </h2>
                        <p className="text-xs text-slate-400">
                            Authorized supervisory workflow entries
                        </p>
                    </div>

                    <div className="space-y-2.5">
                        {hasPermission(user, Permissions.CSE_READ) && (
                            <Link
                                href="/cse"
                                className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20 group-hover:text-white transition-colors">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                            CSE Exposures
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Cyber Security Incidents & Events
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                            </Link>
                        )}

                        {hasPermission(user, Permissions.FINDING_READ) && (
                            <Link
                                href="/findings"
                                className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20 group-hover:text-white transition-colors">
                                        <FileWarning className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                            Findings Register
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Deficiencies & Vulnerability Findings
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                            </Link>
                        )}

                        {hasPermission(user, Permissions.REMEDIATION_READ) && (
                            <Link
                                href="/remediations"
                                className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20 group-hover:text-white transition-colors">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                            Remediation Tracker
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Corrective Actions & Validation
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                            </Link>
                        )}

                        {hasPermission(user, Permissions.SUPERVISION_READ) && (
                            <Link
                                href="/supervision"
                                className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 group-hover:text-white transition-colors">
                                        <Gavel className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                            Supervisory Cases
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Regulatory Enforcement & Decisions
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                            </Link>
                        )}

                        {hasPermission(user, Permissions.EXECUTIVE_CISO_READ) && (
                            <Link
                                href="/ciso"
                                className="group flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 hover:border-emerald-500/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400 border border-emerald-500/30">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                                            CISO Leadership
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Security Posture & Gap Analysis
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-emerald-400" />
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
