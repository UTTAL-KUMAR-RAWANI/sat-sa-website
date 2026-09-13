"use client";

import React, { useEffect, useState } from "react";
import { fetchAdminPermissions, GroupedPermissions } from "@/lib/api/admin";
import { Key, Search } from "lucide-react";

export default function AdminPermissionsPage() {
    const [groups, setGroups] = useState<GroupedPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchAdminPermissions();
                setGroups(data);
            } catch {
                // error handled
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filteredGroups = groups.map((g) => ({
        ...g,
        permissions: g.permissions.filter(
            (p) =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
        ),
    })).filter((g) => g.permissions.length > 0);

    const totalCount = groups.reduce((acc, g) => acc + g.permissions.length, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white">Granular Privilege Registry</h2>
                    <p className="text-xs text-slate-400">
                        {totalCount} fine-grained actions governing data boundaries and module access
                    </p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search privileges..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                    Loading privilege registry...
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No matching permissions found.</div>
            ) : (
                <div className="space-y-4">
                    {filteredGroups.map((g) => (
                        <div key={g.category} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                    {g.category}
                                </h3>
                                <span className="text-[11px] text-slate-500">{g.permissions.length} actions</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {g.permissions.map((p) => (
                                    <div
                                        key={p.id}
                                        className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Key className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                            <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                                                {p.name}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 line-clamp-2">
                                            {p.description || "System privilege specification"}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
