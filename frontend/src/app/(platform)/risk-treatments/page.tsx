"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    risksApi,
    RiskTreatmentItem,
    RiskTreatmentStrategy,
    RiskTreatmentStatus,
} from "@/lib/api/risks";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    ShieldAlert,
    Search,
    RefreshCw,
    Sliders,
    Layers,
    Target,
    Activity,
    CheckCircle2,
    Clock,
    User as UserIcon,
    AlertCircle,
    ArrowUpRight,
    ExternalLink,
    Filter,
} from "lucide-react";

export default function RiskTreatmentsPage() {
    const { user } = useAuth();
    const [treatments, setTreatments] = useState<RiskTreatmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [strategyFilter, setStrategyFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    // Status update modal
    const [selectedTreatment, setSelectedTreatment] = useState<RiskTreatmentItem | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<RiskTreatmentStatus>("IN_PROGRESS");
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);

    const canUpdateTreatment = hasPermission(user, Permissions.RISK_TREATMENT_UPDATE) || hasPermission(user, Permissions.RISK_TREAT);

    const loadTreatments = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await risksApi.getTreatments({
                strategy: strategyFilter || undefined,
                status: statusFilter || undefined,
            });
            setTreatments(data);
        } catch (err: any) {
            setError(err.message || "Failed to load risk treatments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTreatments();
    }, [strategyFilter, statusFilter]);

    const handleUpdateStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTreatment) return;

        setIsUpdating(true);
        try {
            await risksApi.updateTreatment(selectedTreatment.id, {
                status: updatingStatus,
            });
            setUpdateModalOpen(false);
            setSelectedTreatment(null);
            loadTreatments();
        } catch (err: any) {
            window.alert(err.message || "Failed to update treatment status");
        } finally {
            setIsUpdating(false);
        }
    };

    // Filtered items by search text
    const filteredTreatments = treatments.filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            t.business_id.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q)) ||
            (t.owner_name && t.owner_name.toLowerCase().includes(q))
        );
    });

    const getStrategyBadge = (strat: RiskTreatmentStrategy) => {
        switch (strat) {
            case "MITIGATE":
                return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
            case "ACCEPT":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "TRANSFER":
                return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "AVOID":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            default:
                return "bg-slate-700 text-slate-300 border-slate-600";
        }
    };

    const getStatusBadge = (st: RiskTreatmentStatus) => {
        switch (st) {
            case "COMPLETED":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            case "IN_PROGRESS":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "PLANNED":
                return "bg-slate-700 text-slate-300 border-slate-600";
            case "CANCELLED":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            default:
                return "bg-slate-800 text-slate-400 border-slate-700";
        }
    };

    // Stats calculations
    const totalCount = treatments.length;
    const inProgressCount = treatments.filter((t) => t.status === "IN_PROGRESS").length;
    const completedCount = treatments.filter((t) => t.status === "COMPLETED").length;
    const mitigateCount = treatments.filter((t) => t.strategy === "MITIGATE").length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Sub-navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        Risk & GRC Governance
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Risk Treatments Registry</h1>
                    <p className="text-sm text-slate-400">
                        Track remediation strategies, mitigation execution plans, and treatment ownership across all enterprise risks.
                    </p>
                </div>

                {/* Sub-nav switcher */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                    <Link
                        href="/risks"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Risk Register
                    </Link>
                    <Link
                        href="/risk-treatments"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 shadow-sm"
                    >
                        Treatments
                    </Link>
                    <Link
                        href="/risk-exceptions"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Exceptions
                    </Link>
                </div>
            </div>

            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Total Treatments</span>
                        <Layers className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Across all registered risks</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-cyan-400">
                        <span>Mitigate Strategies</span>
                        <Target className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">{mitigateCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Direct controls enhancement</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-amber-400">
                        <span>Active / In Progress</span>
                        <Activity className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{inProgressCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Under active implementation</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-emerald-400">
                        <span>Completed</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Residual controls verified</div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search treatments, IDs, owners..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filter:</span>
                    </div>

                    <select
                        value={strategyFilter}
                        onChange={(e) => setStrategyFilter(e.target.value)}
                        className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">All Strategies</option>
                        <option value="MITIGATE">Mitigate</option>
                        <option value="ACCEPT">Accept</option>
                        <option value="TRANSFER">Transfer</option>
                        <option value="AVOID">Avoid</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="PLANNED">Planned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    <button
                        onClick={loadTreatments}
                        disabled={loading}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Refresh Treatments"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Treatments Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                        <span className="text-xs">Loading treatment registry...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-400 flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6" />
                        <span className="text-xs">{error}</span>
                    </div>
                ) : filteredTreatments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                        <Layers className="w-8 h-8 text-slate-600" />
                        <span className="text-sm font-medium text-slate-400">No risk treatments found</span>
                        <span className="text-xs text-slate-500">
                            Treatments can be created from any risk detail page under Treatment Decision.
                        </span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                                    <th className="py-3 px-4 font-semibold">Treatment ID</th>
                                    <th className="py-3 px-4 font-semibold">Title & Description</th>
                                    <th className="py-3 px-4 font-semibold">Strategy</th>
                                    <th className="py-3 px-4 font-semibold">Status</th>
                                    <th className="py-3 px-4 font-semibold">Assigned Owner</th>
                                    <th className="py-3 px-4 font-semibold">Target Date</th>
                                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredTreatments.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                                            {t.business_id}
                                        </td>
                                        <td className="py-3 px-4 max-w-sm">
                                            <div className="font-semibold text-slate-100 line-clamp-1">{t.title}</div>
                                            <div className="text-slate-400 text-xs line-clamp-1 mt-0.5">{t.description}</div>
                                            {t.mitigation_actions && (
                                                <div className="text-[11px] text-cyan-400/80 mt-1 font-mono line-clamp-1">
                                                    Action: {t.mitigation_actions}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStrategyBadge(t.strategy)}`}>
                                                {t.strategy}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadge(t.status)}`}>
                                                {t.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <UserIcon className="w-3 h-3 text-slate-500" />
                                                <span>{t.owner_name || "Unassigned"}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                                            {t.target_date ? (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-500" />
                                                    <span>{new Date(t.target_date).toLocaleDateString()}</span>
                                                </div>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                {canUpdateTreatment && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTreatment(t);
                                                            setUpdatingStatus(t.status);
                                                            setUpdateModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors border border-slate-700"
                                                    >
                                                        Update Status
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/risks/${t.risk_id}`}
                                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-xs transition-colors border border-amber-500/30 flex items-center gap-1"
                                                >
                                                    View Risk <ArrowUpRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Status Update Modal */}
            {updateModalOpen && selectedTreatment && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-100">Update Treatment Status</h3>
                                <p className="text-xs text-slate-400">{selectedTreatment.business_id} — {selectedTreatment.title}</p>
                            </div>
                            <button
                                onClick={() => setUpdateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdateStatus} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Execution Status
                                </label>
                                <select
                                    value={updatingStatus}
                                    onChange={(e) => setUpdatingStatus(e.target.value as RiskTreatmentStatus)}
                                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="PLANNED">PLANNED (Action sequenced)</option>
                                    <option value="IN_PROGRESS">IN_PROGRESS (Implementation underway)</option>
                                    <option value="COMPLETED">COMPLETED (Controls verified)</option>
                                    <option value="CANCELLED">CANCELLED (Treatment discontinued)</option>
                                </select>
                            </div>

                            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1">
                                <div className="text-slate-400 font-semibold">Strategy: <span className="text-slate-200">{selectedTreatment.strategy}</span></div>
                                <div className="text-slate-400">Target Date: <span className="text-slate-200">{selectedTreatment.target_date ? new Date(selectedTreatment.target_date).toLocaleDateString() : "None"}</span></div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setUpdateModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    {isUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    Save Status
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
