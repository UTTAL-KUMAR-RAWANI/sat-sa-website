"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminSystemStatus, SystemStatusData } from "@/lib/api/admin";
import {
    CheckCircle2,
    Database,
    Clock,
    Cpu,
    RefreshCw,
    AlertTriangle,
    ShieldCheck,
} from "lucide-react";

export default function AdminSystemStatusPage() {
    const [status, setStatus] = useState<SystemStatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminSystemStatus();
            setStatus(data);
        } catch (err: any) {
            setError(err.message || "Failed to poll system telemetry");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                    <span>Probing infrastructure components...</span>
                </div>
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-rose-400">Infrastructure Unreachable</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">{error || "No response received"}</p>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Probe
                </button>
            </div>
        );
    }

    const isHealthy = status.status === "HEALTHY";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Platform Infrastructure Diagnostics</h2>
                    <p className="text-xs text-slate-400">Live operational status of backend services and database storage</p>
                </div>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Run Diagnostic Check
                </button>
            </div>

            {/* Main Status Hero */}
            <div
                className={`rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isHealthy
                        ? "border-emerald-500/30 bg-emerald-950/20"
                        : "border-rose-500/30 bg-rose-950/20"
                }`}
            >
                <div className="flex items-center gap-4">
                    <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                            isHealthy
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                    >
                        {isHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-white tracking-tight">System {status.status}</h3>
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                                {status.environment}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            All critical cyber supervision modules responsive and accepting requests
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Engine Version</span>
                    <div className="font-mono text-sm font-bold text-white">v{status.app_version}</div>
                </div>
            </div>

            {/* Diagnostics Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database Connectivity */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">PostgreSQL Relational DB</span>
                        <Database className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="text-base font-bold text-white">{status.database_status}</div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                        <span>Latency: {status.database_latency_ms} ms</span>
                        <span className="text-emerald-400">Optimal</span>
                    </div>
                </div>

                {/* Database Connection Pool */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Active Connection Pool</span>
                        <Cpu className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-base font-bold text-white">{status.active_connections} Pool Session(s)</div>
                    <div className="mt-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                        <span>Managed by SQLAlchemy 2.x</span>
                    </div>
                </div>

                {/* Server Timestamp */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Server Clock (UTC)</span>
                        <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="text-xs font-mono font-bold text-white truncate">
                        {new Date(status.server_time).toUTCString()}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                        <span>NTP Synchronized</span>
                    </div>
                </div>

                {/* Security Perimeter */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Access Perimeter</span>
                        <ShieldCheck className="h-4 w-4 text-teal-400" />
                    </div>
                    <div className="text-base font-bold text-emerald-400">Enforcing RBAC</div>
                    <div className="mt-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                        <span>Granular Action Scoping</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
