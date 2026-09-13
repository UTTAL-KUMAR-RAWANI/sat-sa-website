"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminRoles,
    fetchAdminPermissions,
    updateRolePermissions,
    AdminRole,
    GroupedPermissions,
} from "@/lib/api/admin";
import {
    Key,
    X,
    Users,
    AlertCircle,
    Sliders,
} from "lucide-react";

export default function AdminRolesPage() {
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Permissions editor modal
    const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
    const [activePermNames, setActivePermNames] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [rolesData, permsData] = await Promise.all([
                fetchAdminRoles(),
                fetchAdminPermissions(),
            ]);
            setRoles(rolesData);
            setGroupedPermissions(permsData);
        } catch (err: any) {
            setError(err.message || "Failed to load roles and permissions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenPermissionEditor = (role: AdminRole) => {
        setSelectedRole(role);
        setActivePermNames([...role.permissions]);
    };

    const togglePermission = (permName: string) => {
        if (activePermNames.includes(permName)) {
            setActivePermNames(activePermNames.filter((p) => p !== permName));
        } else {
            setActivePermNames([...activePermNames, permName]);
        }
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;
        setSaving(true);
        setError(null);
        try {
            await updateRolePermissions(selectedRole.id, activePermNames);
            setSuccessMessage(`Permissions updated for '${selectedRole.name}'`);
            setSelectedRole(null);
            loadData();
        } catch (err: any) {
            setError(err.message || "Failed to update permissions");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Authoritative Roles & Privileges</h2>
                    <p className="text-xs text-slate-400">13 Governance roles with department scopes and granted permissions</p>
                </div>
            </div>

            {successMessage && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)}><X className="h-4 w-4" /></button>
                </div>
            )}
            {error && (
                <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                </div>
            )}

            {/* Roles Grid */}
            {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                    Loading role specifications...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roles.map((r) => (
                        <div
                            key={r.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="text-sm font-bold text-white">{r.name}</h3>
                                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20 capitalize whitespace-nowrap">
                                        {r.scope_type} Scope
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mb-4 line-clamp-2">{r.description || "No description provided."}</p>

                                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4 pt-3 border-t border-slate-800/80">
                                    <div className="flex items-center gap-1.5">
                                        <Key className="h-3.5 w-3.5 text-emerald-400" />
                                        <span>{r.permission_count} privileges</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-blue-400" />
                                        <span>{r.assigned_users_count} users</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleOpenPermissionEditor(r)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                <Sliders className="h-3.5 w-3.5 text-slate-400" />
                                Configure Permissions
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Role Permissions Editor Modal */}
            {selectedRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-white">
                                    Permissions for: <span className="text-emerald-400">{selectedRole.name}</span>
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Select the capabilities granted to accounts holding this role
                                </p>
                            </div>
                            <button onClick={() => setSelectedRole(null)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Grouped Permission Checklist */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs pr-1">
                            {groupedPermissions.map((group) => (
                                <div key={group.category} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-800/60">
                                        {group.category}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {group.permissions.map((p) => {
                                            const isChecked = activePermNames.includes(p.name);
                                            return (
                                                <label
                                                    key={p.id}
                                                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                                                        isChecked
                                                            ? "border-emerald-500/30 bg-emerald-500/5 text-white"
                                                            : "border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-slate-200"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => togglePermission(p.name)}
                                                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-[11px] font-medium">{p.name}</span>
                                                        {p.description && (
                                                            <span className="text-[10px] text-slate-500">{p.description}</span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                            <span className="text-xs text-slate-400">
                                {activePermNames.length} permissions assigned
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole(null)}
                                    className="px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePermissions}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold"
                                >
                                    {saving ? "Saving Changes..." : "Save Role Permissions"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
