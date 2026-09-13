"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasPermission, hasAnyPermission } from "@/lib/rbac/permissions";
import { ShieldAlert, ArrowLeft } from "lucide-react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredPermission?: string;
    requiredPermissions?: string[];
}

export default function ProtectedRoute({
    children,
    requiredPermission,
    requiredPermissions,
}: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace("/login");
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                    <span className="text-sm font-medium">Verifying authorization...</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    // Permission check
    let isAuthorized = true;
    let missingCheck = "";

    if (requiredPermission && !hasPermission(user, requiredPermission)) {
        isAuthorized = false;
        missingCheck = requiredPermission;
    } else if (
        requiredPermissions &&
        requiredPermissions.length > 0 &&
        !hasAnyPermission(user, requiredPermissions)
    ) {
        isAuthorized = false;
        missingCheck = requiredPermissions.join(" or ");
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
                <div className="max-w-md w-full rounded-2xl border border-rose-900/40 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Access Denied (403)</h2>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        Your assigned roles and security scope do not authorize access to this section.
                    </p>
                    {missingCheck && (
                        <div className="mb-6 rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs text-slate-400 font-mono">
                            Required privilege: <span className="text-rose-400">{missingCheck}</span>
                        </div>
                    )}
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors border border-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Return to Platform Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
