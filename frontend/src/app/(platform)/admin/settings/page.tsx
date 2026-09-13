"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminSettings,
    updateAdminSetting,
    SystemSettingItem,
} from "@/lib/api/admin";
import { Settings, Save, X, AlertCircle, Shield, Bell, Database, Lock } from "lucide-react";

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<SystemSettingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminSettings();
            setSettings(data);
            const vals: Record<string, string> = {};
            data.forEach((s) => {
                vals[s.key] = s.value;
            });
            setEditValues(vals);
        } catch (err: any) {
            setError(err.message || "Failed to load system configuration");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (key: string) => {
        setSavingKey(key);
        setError(null);
        try {
            await updateAdminSetting(key, editValues[key] || "");
            setSuccessMessage(`Configuration '${key}' updated and audited`);
            loadData();
        } catch (err: any) {
            setError(err.message || "Failed to save configuration");
        } finally {
            setSavingKey(null);
        }
    };

    // Group settings by category
    const grouped = settings.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
    }, {} as Record<string, SystemSettingItem[]>);

    const categoryIcons: Record<string, React.ReactNode> = {
        Platform: <Settings className="h-4 w-4 text-emerald-400" />,
        Security: <Lock className="h-4 w-4 text-rose-400" />,
        Notifications: <Bell className="h-4 w-4 text-amber-400" />,
        Retention: <Database className="h-4 w-4 text-blue-400" />,
        System: <Shield className="h-4 w-4 text-teal-400" />,
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">System Governance Policies</h2>
                    <p className="text-xs text-slate-400">Environment parameters, retention rules, and platform controls</p>
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

            {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                    Loading configuration catalog...
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(grouped).map(([category, items]) => (
                        <div key={category} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                            <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-slate-800">
                                {categoryIcons[category] || <Settings className="h-4 w-4 text-slate-400" />}
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                    {category} Configuration
                                </h3>
                            </div>

                            <div className="space-y-4">
                                {items.map((item) => {
                                    const isDirty = editValues[item.key] !== item.value;
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80"
                                        >
                                            <div className="max-w-md">
                                                <div className="font-mono text-xs font-semibold text-emerald-400">
                                                    {item.key}
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    {item.description || "System runtime control"}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editValues[item.key] ?? ""}
                                                    onChange={(e) =>
                                                        setEditValues({
                                                            ...editValues,
                                                            [item.key]: e.target.value,
                                                        })
                                                    }
                                                    disabled={item.is_secret}
                                                    className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
                                                />
                                                <button
                                                    onClick={() => handleSave(item.key)}
                                                    disabled={!isDirty || savingKey === item.key}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                                >
                                                    <Save className="h-3.5 w-3.5" />
                                                    {savingKey === item.key ? "Saving..." : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
