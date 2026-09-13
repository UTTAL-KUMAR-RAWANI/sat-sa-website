"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminUsers,
    createAdminUser,
    updateAdminUser,
    toggleUserActive,
    fetchAdminRoles,
    fetchAdminDepartments,
    fetchAdminOrganizations,
    fetchAdminSectors,
    AdminUser,
    AdminRole,
    DepartmentItem,
    OrganizationItem,
    SectorItem,
} from "@/lib/api/admin";
import {
    Users,
    Search,
    Plus,
    UserX,
    UserCheck,
    Edit,
    AlertCircle,
    Check,
    X,
    Building2,
} from "lucide-react";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [departments, setDepartments] = useState<DepartmentItem[]>([]);
    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [sectors, setSectors] = useState<SectorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDept, setSelectedDept] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

    // Form inputs
    const [formUsername, setFormUsername] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [formPassword, setFormPassword] = useState("");
    const [formFirstName, setFormFirstName] = useState("");
    const [formLastName, setFormLastName] = useState("");
    const [formDeptId, setFormDeptId] = useState("");
    const [formOrgId, setFormOrgId] = useState("");
    const [formSectorId, setFormSectorId] = useState("");
    const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminUsers({
                query: searchQuery || undefined,
                department_id: selectedDept || undefined,
            });
            setUsers(data);
        } catch (err: any) {
            setError(err.message || "Failed to load user directory");
        } finally {
            setLoading(false);
        }
    };

    const loadLookups = async () => {
        try {
            const [rolesData, deptsData, orgsData, secsData] = await Promise.all([
                fetchAdminRoles(),
                fetchAdminDepartments(),
                fetchAdminOrganizations(),
                fetchAdminSectors(),
            ]);
            setRoles(rolesData);
            setDepartments(deptsData);
            setOrganizations(orgsData);
            setSectors(secsData);
        } catch {
            // non-blocking
        }
    };

    useEffect(() => {
        loadUsers();
        loadLookups();
    }, [selectedDept]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadUsers();
    };

    const handleToggleStatus = async (user: AdminUser) => {
        const action = user.is_active ? "deactivate" : "activate";
        if (!confirm(`Are you sure you want to ${action} user '${user.username}'?`)) return;

        try {
            await toggleUserActive(user.id, !user.is_active);
            setSuccessMessage(`User '${user.username}' successfully ${user.is_active ? "deactivated" : "activated"}`);
            loadUsers();
        } catch (err: any) {
            setError(err.message || "Failed to update user status");
        }
    };

    const handleOpenCreate = () => {
        setFormUsername("");
        setFormEmail("");
        setFormPassword("");
        setFormFirstName("");
        setFormLastName("");
        setFormDeptId("");
        setFormOrgId("");
        setFormSectorId("");
        setFormRoleIds([]);
        setShowCreateModal(true);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await createAdminUser({
                username: formUsername,
                email: formEmail,
                password: formPassword,
                first_name: formFirstName || undefined,
                last_name: formLastName || undefined,
                department_id: formDeptId || undefined,
                organization_id: formOrgId || undefined,
                sector_id: formSectorId || undefined,
                role_ids: formRoleIds,
            });
            setShowCreateModal(false);
            setSuccessMessage(`User '${formUsername}' provisioned successfully`);
            loadUsers();
        } catch (err: any) {
            setError(err.message || "Failed to provision user");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = (user: AdminUser) => {
        setEditingUser(user);
        setFormFirstName(user.first_name || "");
        setFormLastName(user.last_name || "");
        setFormEmail(user.email);
        setFormDeptId(user.department_id || "");
        setFormOrgId(user.organization_id || "");
        setFormSectorId(user.sector_id || "");

        // Find role IDs from role names
        const assignedRoleIds = roles
            .filter((r) => user.roles.includes(r.name))
            .map((r) => r.id);
        setFormRoleIds(assignedRoleIds);
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setSubmitting(true);
        setError(null);
        try {
            await updateAdminUser(editingUser.id, {
                first_name: formFirstName,
                last_name: formLastName,
                email: formEmail,
                department_id: formDeptId || null,
                organization_id: formOrgId || null,
                sector_id: formSectorId || null,
                role_ids: formRoleIds,
            });
            setShowEditModal(false);
            setSuccessMessage(`User '${editingUser.username}' updated successfully`);
            loadUsers();
        } catch (err: any) {
            setError(err.message || "Failed to update user");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white">User Directory & Governance</h2>
                    <p className="text-xs text-slate-400">Manage accounts, department alignments, and assigned security roles</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Provision User
                </button>
            </div>

            {/* Notification messages */}
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

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form onSubmit={handleSearch} className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, username, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                </form>
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {loading ? (
                    <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                        Loading directory...
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="h-8 w-8 text-slate-600 mb-2" />
                        <p className="text-sm font-medium text-slate-300">No users found</p>
                        <p className="text-xs text-slate-500">Try adjusting your search criteria or provision a new user.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                                    <th className="p-3.5 font-medium">User / Identity</th>
                                    <th className="p-3.5 font-medium">Department</th>
                                    <th className="p-3.5 font-medium">Assigned Roles</th>
                                    <th className="p-3.5 font-medium">Scope</th>
                                    <th className="p-3.5 font-medium">Status</th>
                                    <th className="p-3.5 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-semibold text-white">
                                                {u.first_name ? `${u.first_name} ${u.last_name || ""}` : u.username}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="inline-flex items-center gap-1.5 text-slate-300">
                                                <Building2 className="h-3 w-3 text-slate-500" />
                                                {u.department_name || "Unassigned"}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex flex-wrap gap-1">
                                                {u.roles.length > 0 ? (
                                                    u.roles.map((r) => (
                                                        <span key={r} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-slate-700">
                                                            {r}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">No roles</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3.5 capitalize text-slate-400">{u.scope}</td>
                                        <td className="p-3.5">
                                            {u.is_active ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                                    <Check className="h-2.5 w-2.5" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                                                    <X className="h-2.5 w-2.5" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-right space-x-2">
                                            <button
                                                onClick={() => handleOpenEdit(u)}
                                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                className={`p-1.5 rounded-lg border transition-colors ${
                                                    u.is_active
                                                        ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                }`}
                                                title={u.is_active ? "Deactivate User" : "Activate User"}
                                            >
                                                {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Provision User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                            <h3 className="text-base font-bold text-white">Provision New User</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">Username *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formUsername}
                                        onChange={(e) => setFormUsername(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Initial Password *</label>
                                <input
                                    type="password"
                                    required
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={formFirstName}
                                        onChange={(e) => setFormFirstName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={formLastName}
                                        onChange={(e) => setFormLastName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Department</label>
                                <select
                                    value={formDeptId}
                                    onChange={(e) => setFormDeptId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">Select Department</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">Organization</label>
                                    <select
                                        value={formOrgId}
                                        onChange={(e) => setFormOrgId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Select Organization</option>
                                        {organizations.map((o) => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Sector</label>
                                    <select
                                        value={formSectorId}
                                        onChange={(e) => setFormSectorId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Select Sector</option>
                                        {sectors.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1.5">Assign Roles</label>
                                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950">
                                    {roles.map((r) => {
                                        const checked = formRoleIds.includes(r.id);
                                        return (
                                            <label key={r.id} className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer hover:text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setFormRoleIds([...formRoleIds, r.id]);
                                                        else setFormRoleIds(formRoleIds.filter((id) => id !== r.id));
                                                    }}
                                                    className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                                                />
                                                <span>{r.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                    {submitting ? "Provisioning..." : "Provision User"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-white">Edit User: {editingUser.username}</h3>
                                <p className="text-xs text-slate-400">Update alignment and role permissions</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={formFirstName}
                                        onChange={(e) => setFormFirstName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={formLastName}
                                        onChange={(e) => setFormLastName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formEmail}
                                    onChange={(e) => setFormEmail(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Department</label>
                                <select
                                    value={formDeptId}
                                    onChange={(e) => setFormDeptId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">Select Department</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">Organization</label>
                                    <select
                                        value={formOrgId}
                                        onChange={(e) => setFormOrgId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Select Organization</option>
                                        {organizations.map((o) => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Sector</label>
                                    <select
                                        value={formSectorId}
                                        onChange={(e) => setFormSectorId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">Select Sector</option>
                                        {sectors.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1.5">Roles</label>
                                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950">
                                    {roles.map((r) => {
                                        const checked = formRoleIds.includes(r.id);
                                        return (
                                            <label key={r.id} className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer hover:text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setFormRoleIds([...formRoleIds, r.id]);
                                                        else setFormRoleIds(formRoleIds.filter((id) => id !== r.id));
                                                    }}
                                                    className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                                                />
                                                <span>{r.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-3 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                    {submitting ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
