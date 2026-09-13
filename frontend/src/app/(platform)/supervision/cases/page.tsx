'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    supervisionApi,
    SupervisoryCaseItem,
} from '@/lib/api/supervision';
import {
    Gavel,
    Search,
    Filter,
    Plus,
    X,
    Clock,
    AlertTriangle,
    Shield,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';

export default function SupervisoryCasesListPage() {
    const [cases, setCases] = useState<SupervisoryCaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
    const [triggerFilter, setTriggerFilter] = useState<string>('ALL');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Create Modal Form
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
    const [newTrigger, setNewTrigger] = useState('MANUAL_ESCALATION');
    const [newDueDate, setNewDueDate] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    const loadCases = async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = {};
            if (search) params.search = search;
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (priorityFilter !== 'ALL') params.priority = priorityFilter;
            if (triggerFilter !== 'ALL') params.trigger_type = triggerFilter;

            const data = await supervisionApi.getCases(params);
            setCases(data);
        } catch (err) {
            console.error('Failed to load supervisory cases:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCases();
    }, [statusFilter, priorityFilter, triggerFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadCases();
    };

    const handleCreateCase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            setCreateError('Case title is required.');
            return;
        }

        try {
            setCreateLoading(true);
            setCreateError(null);
            await supervisionApi.createCase({
                title: newTitle,
                description: newDesc,
                priority: newPriority,
                trigger_type: newTrigger,
                due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
            });
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewDesc('');
            await loadCases();
        } catch (err: any) {
            setCreateError(err?.response?.data?.detail || 'Failed to create supervisory case.');
        } finally {
            setCreateLoading(false);
        }
    };

    const statusPills = [
        'ALL',
        'OPEN',
        'ASSIGNED',
        'UNDER_REVIEW',
        'RECOMMENDATION_READY',
        'AUTHORITY_REVIEW',
        'ACTION_REQUIRED',
        'MONITORING',
        'CLOSED',
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm">
                            <Gavel className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Supervisory Cases Dossier</h1>
                            <p className="text-xs text-slate-400">
                                Official registry of sectoral cyber supervisory oversight files, investigations, and authority determinations
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Initiate Case</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by Case ID (SUP-2026-XXXXX), title, or keywords..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                    </form>

                    <div className="flex items-center space-x-3 w-full md:w-auto">
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="ALL">All Priorities</option>
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                        </select>

                        <select
                            value={triggerFilter}
                            onChange={(e) => setTriggerFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="ALL">All Triggers</option>
                            <option value="CRITICAL_CSE">Critical CSE</option>
                            <option value="CRITICAL_RISK">Critical Risk</option>
                            <option value="OVERDUE_REMEDIATION">Overdue Remediation</option>
                            <option value="MANUAL_ESCALATION">Manual Escalation</option>
                            <option value="HIGH_FINDING">High Finding</option>
                        </select>

                        <button
                            onClick={() => { setSearch(''); setStatusFilter('ALL'); setPriorityFilter('ALL'); setTriggerFilter('ALL'); }}
                            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Status Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                    {statusPills.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                statusFilter === s
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            {s.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cases Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400">Loading cases dossier...</div>
                ) : cases.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                        <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
                        <div className="text-sm font-semibold text-slate-300">No supervisory cases found</div>
                        <div className="text-xs text-slate-500">Try adjusting your filters or initiate a new supervisory case.</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-700/60">
                                <tr>
                                    <th className="px-4 py-3">Case ID</th>
                                    <th className="px-4 py-3">Title & Source Context</th>
                                    <th className="px-4 py-3">Trigger</th>
                                    <th className="px-4 py-3">Priority</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Assigned Analyst</th>
                                    <th className="px-4 py-3">Sector</th>
                                    <th className="px-4 py-3">Due Date</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {cases.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3.5 font-mono font-semibold text-amber-400 whitespace-nowrap">
                                            <Link href={`/supervision/cases/${c.id}`} className="hover:underline">
                                                {c.business_id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3.5 max-w-sm">
                                            <Link href={`/supervision/cases/${c.id}`} className="font-semibold text-white hover:text-amber-400 transition-colors line-clamp-1">
                                                {c.title}
                                            </Link>
                                            <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-400">
                                                {c.source_cse_business_id && (
                                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-sky-400">
                                                        CSE: {c.source_cse_business_id}
                                                    </span>
                                                )}
                                                {c.source_finding_business_id && (
                                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-amber-400">
                                                        FND: {c.source_finding_business_id}
                                                    </span>
                                                )}
                                                {c.source_risk_business_id && (
                                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-rose-400">
                                                        RSK: {c.source_risk_business_id}
                                                    </span>
                                                )}
                                                {c.source_remediation_business_id && (
                                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400">
                                                        REM: {c.source_remediation_business_id}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                                                {c.trigger_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                c.priority === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                                c.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                'bg-slate-700/50 text-slate-300'
                                            }`}>
                                                {c.priority}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                c.status === 'ACTION_REQUIRED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse' :
                                                c.status === 'AUTHORITY_REVIEW' || c.status === 'DECISION_REQUIRED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                c.status === 'RECOMMENDATION_READY' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                                                c.status === 'MONITORING' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' :
                                                c.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                                'bg-slate-800 text-slate-300 border border-slate-700'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                                            {c.assigned_analyst_name || <span className="text-slate-500 italic">Unassigned</span>}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                                            {c.sector_name || 'All Sectors'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                                            {c.due_date ? new Date(c.due_date).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                            <Link
                                                href={`/supervision/cases/${c.id}`}
                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded text-[11px] font-semibold transition-colors"
                                            >
                                                Open Dossier
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Initiate Case Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
                            <h3 className="text-lg font-bold text-white tracking-wide">Initiate Supervisory Case</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCase} className="p-6 space-y-4">
                            {createError && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                                    {createError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Case Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="e.g. Critical Ransomware Lateral Movement Across Banking Sector"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Description & Scope</label>
                                <textarea
                                    rows={3}
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    placeholder="Detail the systemic risk, entities impacted, and supervisory objective..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={newPriority}
                                        onChange={(e: any) => setNewPriority(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="CRITICAL">CRITICAL</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Trigger Classification</label>
                                    <select
                                        value={newTrigger}
                                        onChange={(e) => setNewTrigger(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="MANUAL_ESCALATION">Manual Escalation</option>
                                        <option value="CRITICAL_CSE">Critical CSE</option>
                                        <option value="CRITICAL_RISK">Critical Risk</option>
                                        <option value="OVERDUE_REMEDIATION">Overdue Remediation</option>
                                        <option value="HIGH_FINDING">High Finding</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Resolution Date</label>
                                <input
                                    type="date"
                                    value={newDueDate}
                                    onChange={(e) => setNewDueDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    disabled={createLoading}
                                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20"
                                >
                                    {createLoading ? 'Initiating...' : 'Create Supervisory Dossier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
