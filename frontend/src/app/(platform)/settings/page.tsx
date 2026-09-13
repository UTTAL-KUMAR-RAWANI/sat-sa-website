"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    Settings,
    Bell,
    Monitor,
    Shield,
    ExternalLink,
    Check,
    Sliders,
    Lock,
    Globe,
    Server,
} from "lucide-react";

export default function SettingsPage() {
    const { user } = useAuth();
    const [density, setDensity] = useState<"standard" | "compact">("standard");
    const [notifySound, setNotifySound] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [savedMsg, setSavedMsg] = useState(false);

    const handleSave = () => {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2500);
    };

    const canManageSystemSettings =
        hasPermission(user, Permissions.SYSTEM_SETTINGS_MANAGE) ||
        hasPermission(user, Permissions.SYSTEM_STATUS_READ);

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <Settings className="h-5 w-5 text-emerald-400" />
                        <span>Platform & Display Preferences</span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Configure client-side telemetry preferences and local supervisory workstation settings
                    </p>
                </div>
            </div>

            {/* Display & Density Settings */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-emerald-400" />
                    <span>Interface Layout Density</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                        onClick={() => setDensity("standard")}
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            density === "standard"
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                                : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white">Standard Density</span>
                            {density === "standard" && <Check className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-400">
                            Optimal comfortable spacing for high-resolution monitors and supervisory review workflows.
                        </p>
                    </div>

                    <div
                        onClick={() => setDensity("compact")}
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            density === "compact"
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                                : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white">High Information Density</span>
                            {density === "compact" && <Check className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-400">
                            Tighter row spacing and compact padding suited for SOC surveillance and high-throughput triage.
                        </p>
                    </div>
                </div>
            </div>

            {/* Telemetry & Notifications Preferences */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Bell className="h-4 w-4 text-emerald-400" />
                    <span>Notification & Live Telemetry Options</span>
                </h2>

                <div className="divide-y divide-slate-800">
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <div className="text-xs font-semibold text-white">Background Telemetry Polling</div>
                            <div className="text-[11px] text-slate-400">
                                Automatically query active unread badges and incident queues every 30 seconds
                            </div>
                        </div>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                                autoRefresh ? "bg-emerald-600" : "bg-slate-800"
                            }`}
                        >
                            <div
                                className={`h-5 w-5 rounded-full bg-white transition-transform ${
                                    autoRefresh ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-3">
                        <div>
                            <div className="text-xs font-semibold text-white">Audible Alert for Critical Incidents</div>
                            <div className="text-[11px] text-slate-400">
                                Play subtle alert tone when an incident escalates to P1 / CRITICAL severity
                            </div>
                        </div>
                        <button
                            onClick={() => setNotifySound(!notifySound)}
                            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                                notifySound ? "bg-emerald-600" : "bg-slate-800"
                            }`}
                        >
                            <div
                                className={`h-5 w-5 rounded-full bg-white transition-transform ${
                                    notifySound ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                    {savedMsg && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" /> Preferences stored locally.
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        className="ml-auto rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
                    >
                        Save Preferences
                    </button>
                </div>
            </div>

            {/* Platform & Administrative Environment */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <Server className="h-4 w-4 text-emerald-400" />
                            <span>System Architecture & Deployment Info</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Active node specifications and supervisory governance parameters
                        </p>
                    </div>

                    {canManageSystemSettings && (
                        <Link
                            href="/admin/settings"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                            <Sliders className="h-3.5 w-3.5" />
                            <span>Manage Global System Settings</span>
                            <ExternalLink className="h-3 w-3 ml-0.5" />
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                        <span className="text-slate-400 block text-[11px]">Platform Core:</span>
                        <span className="text-white font-mono font-bold">SAT-SA Enterprise v2.4</span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                        <span className="text-slate-400 block text-[11px]">Database Architecture:</span>
                        <span className="text-white font-mono font-bold">PostgreSQL 16 + Alembic</span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                        <span className="text-slate-400 block text-[11px]">Audit Sequencer:</span>
                        <span className="text-emerald-400 font-mono font-bold">SHA-256 Immutable</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
