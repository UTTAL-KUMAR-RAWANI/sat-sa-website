"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Permissions } from "@/lib/rbac/permissions";
import {
    LayoutDashboard,
    Users,
    Shield,
    Key,
    Building2,
    Briefcase,
    Layers,
    UserCheck,
    FileText,
    Settings,
    Activity,
} from "lucide-react";

interface AdminNavItem {
    title: string;
    href: string;
    icon: React.ReactNode;
}

const adminNavItems: AdminNavItem[] = [
    { title: "Overview", href: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { title: "Users", href: "/admin/users", icon: <Users className="h-4 w-4" /> },
    { title: "Roles", href: "/admin/roles", icon: <Shield className="h-4 w-4" /> },
    { title: "Permissions", href: "/admin/permissions", icon: <Key className="h-4 w-4" /> },
    { title: "Departments", href: "/admin/departments", icon: <Building2 className="h-4 w-4" /> },
    { title: "Organizations", href: "/admin/organizations", icon: <Briefcase className="h-4 w-4" /> },
    { title: "Sectors", href: "/admin/sectors", icon: <Layers className="h-4 w-4" /> },
    { title: "Access Requests", href: "/admin/access-requests", icon: <UserCheck className="h-4 w-4" /> },
    { title: "Audit Trail", href: "/admin/audit-logs", icon: <FileText className="h-4 w-4" /> },
    { title: "Settings", href: "/admin/settings", icon: <Settings className="h-4 w-4" /> },
    { title: "Diagnostics", href: "/admin/system-status", icon: <Activity className="h-4 w-4" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <ProtectedRoute requiredPermissions={[Permissions.USERS_MANAGE, Permissions.SYSTEM_STATUS_READ]}>
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
                                Platform Administration
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
                            CSE Administrator Console
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Central identity, governance, and infrastructure configuration
                        </p>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 scrollbar-none">
                    {adminNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                                    isActive
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                                }`}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Admin Page Content */}
                <div className="pt-2">{children}</div>
            </div>
        </ProtectedRoute>
    );
}
