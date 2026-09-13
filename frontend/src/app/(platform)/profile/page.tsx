"use client";

import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
    User as UserIcon,
    Shield,
    Building2,
    Layers,
    Lock,
    Key,
    Briefcase,
    Mail,
    CheckCircle2,
    Calendar,
} from "lucide-react";

export default function ProfilePage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                Loading user profile...
            </div>
        );
    }

    const primaryRole = user.roles?.[0] || "User";
    const userPermissions = user.permissions || [];

    // Group permissions by prefix for clean visual presentation
    const groupedPermissions = userPermissions.reduce((acc, perm) => {
        const prefix = perm.split(".")[0] || "general";
        if (!acc[prefix]) acc[prefix] = [];
        acc[prefix].push(perm);
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Profile Header Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold text-2xl shadow-lg shadow-emerald-500/20">
                        {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
                    </div>

                    <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                {user.first_name ? `${user.first_name} ${user.last_name || ""}` : user.username}
                            </h1>
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                                {primaryRole}
                            </span>
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 border border-slate-700 capitalize">
                                {user.scope || "org"} Scope
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                            User ID: {user.id}
                        </p>
                    </div>
                </div>

                {/* Identity Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            <span>Email</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200 font-mono truncate">
                            {user.email}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>Department</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200">
                            {user.department || "Platform Oversight"}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>Tenant Organization</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200">
                            {user.organization_id ? "Assigned Organization" : "Global System Authority"}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Layers className="h-3.5 w-3.5" />
                            <span>Critical Sector</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200">
                            {user.sector_id ? "Assigned Sector" : "Multi-Sector Supervision"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Assigned Roles Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span>Assigned Security Roles</span>
                </h2>

                <div className="flex flex-wrap gap-2">
                    {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                            <div
                                key={role}
                                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-xs font-semibold text-slate-200">{role}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-slate-500">No roles assigned.</div>
                    )}
                </div>
            </div>

            {/* Granted RBAC Permissions Grid */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <Key className="h-4 w-4 text-emerald-400" />
                            <span>Authoritative Permissions ({userPermissions.length})</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Fine-grained capabilities granted by assigned role associations
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div
                            key={category}
                            className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-2.5"
                        >
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span>{category}</span>
                                <span className="text-[10px] text-slate-500 font-normal ml-auto">
                                    {perms.length} perms
                                </span>
                            </h3>

                            <ul className="space-y-1.5">
                                {perms.map((p) => (
                                    <li key={p} className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500/80 shrink-0" />
                                        <span className="truncate" title={p}>{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
