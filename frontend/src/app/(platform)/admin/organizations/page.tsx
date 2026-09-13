"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminOrganizations,
    createAdminOrganization,
    OrganizationItem,
} from "@/lib/api/admin";
import { Briefcase, Plus, Users, Layers, X, AlertCircle } from "lucide-react";

export default function AdminOrganizationsPage() {
    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminOrganizations();
            setOrganizations(data);
        } catch (err: any) {
            setError(err.message || "Failed to load organizations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await createAdminOrganization({ name, description });
            setShowModal(false);
            setName("");
            setDescription("");
            setSuccessMessage(`Organization '${name}' created successfully`);
            loadData();
        } catch (err: any) {
            setError(err.message || "Failed to create organization");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Supervised Entities & Organizations</h2>
                    <p className="text-xs text-slate-400">Regulated institutions and enterprise entities under SAT-SA supervision</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Add Organization
                </button>
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

            {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                    Loading organizations...
                </div>
            ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                                <th className="p-3.5 font-medium">Organization Name</th>
                                <th className="p-3.5 font-medium">Description</th>
                                <th className="p-3.5 font-medium">Aligned Sectors</th>
                                <th className="p-3.5 font-medium">Enrolled Personnel</th>
                                <th className="p-3.5 font-medium text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {organizations.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                                        <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 border border-emerald-500/20">
                                            <Briefcase className="h-3.5 w-3.5" />
                                        </div>
                                        <span>{org.name}</span>
                                    </td>
                                    <td className="p-3.5 text-slate-400 max-w-xs truncate">{org.description || "Regulated institution"}</td>
                                    <td className="p-3.5">
                                        <span className="inline-flex items-center gap-1 text-slate-300">
                                            <Layers className="h-3 w-3 text-emerald-400" />
                                            {org.sector_count} sectors
                                        </span>
                                    </td>
                                    <td className="p-3.5">
                                        <span className="inline-flex items-center gap-1 text-slate-300">
                                            <Users className="h-3 w-3 text-blue-400" />
                                            {org.user_count} users
                                        </span>
                                    </td>
                                    <td className="p-3.5 text-right">
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                            Active
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Organization Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-base font-bold text-white">Enroll Supervised Entity</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 mb-1">Organization Legal Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="e.g., Apex Financial Reserve"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="Entity regulatory classification..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-3 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                    {submitting ? "Enrolling..." : "Enroll Entity"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
