"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminDepartments,
    createAdminDepartment,
    DepartmentItem,
} from "@/lib/api/admin";
import { Building2, Plus, Users, X, AlertCircle } from "lucide-react";

export default function AdminDepartmentsPage() {
    const [departments, setDepartments] = useState<DepartmentItem[]>([]);
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
            const data = await fetchAdminDepartments();
            setDepartments(data);
        } catch (err: any) {
            setError(err.message || "Failed to load departments");
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
            await createAdminDepartment({ name, description });
            setShowModal(false);
            setName("");
            setDescription("");
            setSuccessMessage("Department successfully established");
            loadData();
        } catch (err: any) {
            setError(err.message || "Failed to create department");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Department Architecture</h2>
                    <p className="text-xs text-slate-400">Core organizational divisions governing role allocation</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    New Department
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
                    Loading departments...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {departments.map((d) => (
                        <div
                            key={d.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                        >
                            <div>
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-sm font-bold text-white">{d.name}</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-4">{d.description || "Core platform operational unit."}</p>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                                <span className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-blue-400" />
                                    {d.user_count} personnel
                                </span>
                                <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Department Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-base font-bold text-white">Establish Department</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 mb-1">Department Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="e.g., Threat Intelligence"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="Purpose and mandate of the department..."
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
                                    {submitting ? "Establishing..." : "Establish Department"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
