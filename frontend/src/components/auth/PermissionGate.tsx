"use client";

import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/rbac/permissions";

interface PermissionGateProps {
    permission?: string;
    permissions?: string[];
    all?: boolean;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export default function PermissionGate({
    permission,
    permissions,
    all = false,
    fallback = null,
    children,
}: PermissionGateProps) {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (permission) {
        if (!hasPermission(user, permission)) {
            return <>{fallback}</>;
        }
    }

    if (permissions && permissions.length > 0) {
        const allowed = all
            ? hasAllPermissions(user, permissions)
            : hasAnyPermission(user, permissions);

        if (!allowed) {
            return <>{fallback}</>;
        }
    }

    return <>{children}</>;
}
