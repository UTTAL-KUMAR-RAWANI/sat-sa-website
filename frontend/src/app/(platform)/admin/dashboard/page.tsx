"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAdminDashboard, DashboardStats } from "@/lib/api/admin";
import {
    Users,
    Shield,
    Briefcase,
    UserCheck,
    Activity,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
} from "lucide-react";

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminDashboard();
            setStats(data);
        } catch (err: any) {
            setError(err.message || "Failed to load administrative metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                    <span className="text-xs text-slate-400 font-medium">Gathering administrative telemetry...</span>
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-rose-400 mb-1">Administrative Error</h3>
                <p className="text-xs text-slate-300 mb-4">{error || "Unable to retrieve dashboard metrics"}</p>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Platform Health & Telemetry</h2>
                    <p className="text-xs text-slate-400">Real-time state of the SAT-SA foundation</p>
                </div>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Users Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-400">Total Users</span>
                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-white">{stats.total_users}</span>
                        <span className="text-xs text-emerald-400 font-medium">({stats.active_users} active)</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                        <span>Inactive: {stats.inactive_users}</span>
                        <Link href="/admin/users" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">
                            Directory <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* Organizations Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-400">Supervised Entities</span>
                        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                            <Briefcase className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-white">{stats.total_organizations}</span>
                        <span className="text-xs text-slate-400">Across {stats.total_sectors} Sectors</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                        <span>{stats.total_departments} Departments</span>
                        <Link href="/admin/organizations" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">
                            Manage <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* Access Requests Card */}
                <div className={`rounded-xl border p-4 ${
                    stats.pending_access_requests > 0
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-slate-800 bg-slate-900/60"
                }`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-400">Pending Requests</span>
                        <div className={`rounded-lg p-2 border ${
                            stats.pending_access_requests > 0
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                            <UserCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-extrabold ${
                            stats.pending_access_requests > 0 ? "text-amber-400" : "text-white"
                        }`}>
                            {stats.pending_access_requests}
                        </span>
                        <span className="text-xs text-slate-400">Awaiting Decision</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                        <span>Role & Org requests</span>
                        <Link href="/admin/access-requests" className="text-amber-400 hover:underline inline-flex items-center gap-0.5">
                            Review <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* System Diagnostics Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-400">Platform Core</span>
                        <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20">
                            <Activity className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="text-lg font-bold text-white">{stats.system_status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                        <span>PostgreSQL Connected</span>
                        <Link href="/admin/system-status" className="text-teal-400 hover:underline inline-flex items-center gap-0.5">
                            Diagnostics <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Recent Actions & Quick Links */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Administrative Actions Table */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-white">Recent Administrative Events</h3>
                            <p className="text-[11px] text-slate-400">Latest immutable actions recorded in PostgreSQL</p>
                        </div>
                        <Link
                            href="/admin/audit-logs"
                            className="text-xs font-medium text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                            Full Audit Trail <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {stats.recent_audit_actions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500">
                            No administrative audit records logged yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-2 font-medium">Timestamp</th>
                                        <th className="pb-2 font-medium">Actor</th>
                                        <th className="pb-2 font-medium">Action</th>
                                        <th className="pb-2 font-medium">Target</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                    {stats.recent_audit_actions.map((act) => (
                                        <tr key={act.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-2.5 text-slate-400 font-mono text-[11px]">
                                                {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : "-"}
                                            </td>
                                            <td className="py-2.5 font-medium text-white">{act.actor_email}</td>
                                            <td className="py-2.5">
                                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 border border-slate-700">
                                                    {act.action}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-slate-400">{act.resource_type}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Quick Governance Links */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white">Governance Shortcuts</h3>
                    <div className="space-y-2">
                        <Link
                            href="/admin/users"
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                        >
                            <div className="flex items-center gap-2.5">
                                <Users className="h-4 w-4 text-blue-400" />
                                <span className="text-xs font-medium text-slate-200">Provision New User</span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors" />
                        </Link>

                        <Link
                            href="/admin/roles"
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                        >
                            <div className="flex items-center gap-2.5">
                                <Shield className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs font-medium text-slate-200">Manage 13 Roles</span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors" />
                        </Link>

                        <Link
                            href="/admin/settings"
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                        >
                            <div className="flex items-center gap-2.5">
                                <Activity className="h-4 w-4 text-teal-400" />
                                <span className="text-xs font-medium text-slate-200">Configure Platform Policies</span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
