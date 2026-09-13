'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    supervisionApi,
    EscalationItem,
} from '@/lib/api/supervision';
import {
    ShieldAlert,
    RefreshCw,
    Search,
    CheckCircle2,
    Clock,
    AlertTriangle,
    UserCheck,
    Check,
    X,
    ExternalLink,
} from 'lucide-react';

export default function EscalationsQueuePage() {
    const [escalations, setEscalations] = useState<EscalationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [scanRunning, setScanRunning] = useState(false);
    const [scanMessage, setScanMessage] = useState<string | null>(null);

    const loadEscalations = async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = {};
            if (search) params.search = search;
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (levelFilter !== 'ALL') params.level = levelFilter;
            if (severityFilter !== 'ALL') params.severity = severityFilter;

            const data = await supervisionApi.getEscalations(params);
            setEscalations(data);
        } catch (err) {
            console.error('Failed to load escalations queue:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEscalations();
    }, [statusFilter, levelFilter, severityFilter]);

    const handleAcknowledge = async (id: string) => {
        try {
            await supervisionApi.acknowledgeEscalation(id);
            await loadEscalations();
        } catch (err: any) {
            alert('Failed to acknowledge escalation: ' + (err?.response?.data?.detail || err.message));
        }
    };

    const handleResolve = async (id: string) => {
        const resolution = prompt('Provide formal escalation resolution summary:');
        if (!resolution) return;
        try {
            await supervisionApi.resolveEscalation(id, { resolution });
            await loadEscalations();
        } catch (err: any) {
            alert('Failed to resolve escalation: ' + (err?.response?.data?.detail || err.message));
        }
    };

    const handleClose = async (id: string) => {
        if (!confirm('Are you sure you want to close this escalation?')) return;
        try {
            await supervisionApi.closeEscalation(id);
            await loadEscalations();
        } catch (err: any) {
            alert('Failed to close escalation: ' + (err?.response?.data?.detail || err.message));
        }
    };

    const handleTriggerScan = async () => {
        try {
            setScanRunning(true);
            setScanMessage(null);
            const res = await supervisionApi.triggerAutoScan();
            setScanMessage(`Scan complete: ${res.triggered_count} auto-escalation(s) triggered.`);
            await loadEscalations();
        } catch (err: any) {
            setScanMessage('Scan failed: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setScanRunning(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Escalations Triage Queue</h1>
                            <p className="text-xs text-slate-400">
                                Real-time monitoring of operational escalations, SLA breaches, and critical event triggers
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleTriggerScan}
                        disabled={scanRunning}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanRunning ? 'animate-spin' : ''}`} />
                        <span>{scanRunning ? 'Evaluating...' : 'Run Automated Trigger Scan'}</span>
                    </button>
                </div>
            </div>

            {/* Scan Message */}
            {scanMessage && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{scanMessage}</span>
                    </div>
                    <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadEscalations()}
                            placeholder="Search by Escalation ID (ESC-2026-XXXXX) or reason..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="flex items-center space-x-3 w-full md:w-auto">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="OPEN">OPEN</option>
                            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                            <option value="IN_REVIEW">IN REVIEW</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="CLOSED">CLOSED</option>
                        </select>

                        <select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="ALL">All Levels</option>
                            <option value="LEVEL_1">Level 1 - Operational</option>
                            <option value="LEVEL_2">Level 2 - Supervisory</option>
                            <option value="LEVEL_3">Level 3 - Authority</option>
                        </select>

                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="ALL">All Severities</option>
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                        </select>

                        <button
                            onClick={() => { setSearch(''); setStatusFilter('ALL'); setLevelFilter('ALL'); setSeverityFilter('ALL'); }}
                            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Escalations Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400">Loading escalations queue...</div>
                ) : escalations.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                        <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                        <div className="text-sm font-semibold text-slate-300">No active escalations</div>
                        <div className="text-xs text-slate-500">All supervisory escalation tickets are resolved or clear.</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-700/60">
                                <tr>
                                    <th className="px-4 py-3">Escalation ID</th>
                                    <th className="px-4 py-3">Source & Reason</th>
                                    <th className="px-4 py-3">Severity</th>
                                    <th className="px-4 py-3">Tier Level</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Escalated By</th>
                                    <th className="px-4 py-3">Supervisory Case</th>
                                    <th className="px-4 py-3">Age</th>
                                    <th className="px-4 py-3 text-right">Triage Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {escalations.map((e) => (
                                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3.5 font-mono font-semibold text-rose-400 whitespace-nowrap">
                                            {e.business_id}
                                        </td>
                                        <td className="px-4 py-3.5 max-w-sm">
                                            <div className="font-semibold text-slate-100 line-clamp-1">{e.reason}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                Resource: <span className="text-amber-400 font-mono">{e.resource_type}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                e.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                                e.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                'bg-slate-700 text-slate-300'
                                            }`}>
                                                {e.severity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                {e.level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                e.status === 'OPEN' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse' :
                                                e.status === 'ACKNOWLEDGED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                e.status === 'IN_REVIEW' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' :
                                                e.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                                'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                                            {e.escalated_by_name || 'System Auto-Trigger'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                                            {e.supervisory_case_id ? (
                                                <Link
                                                    href={`/supervision/cases/${e.supervisory_case_id}`}
                                                    className="text-amber-400 hover:underline flex items-center space-x-1"
                                                >
                                                    <span>{e.supervisory_case_business_id || 'Case Dossier'}</span>
                                                    <ExternalLink className="w-3 h-3 text-amber-400" />
                                                </Link>
                                            ) : (
                                                <span className="text-slate-500 italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-[11px] text-slate-400">
                                            {new Date(e.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                                            {e.status === 'OPEN' && (
                                                <button
                                                    onClick={() => handleAcknowledge(e.id)}
                                                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[11px] font-semibold border border-amber-500/40"
                                                >
                                                    Acknowledge
                                                </button>
                                            )}
                                            {['OPEN', 'ACKNOWLEDGED', 'IN_REVIEW'].includes(e.status) && (
                                                <button
                                                    onClick={() => handleResolve(e.id)}
                                                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[11px] font-semibold border border-emerald-500/40"
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                            {e.status === 'RESOLVED' && (
                                                <button
                                                    onClick={() => handleClose(e.id)}
                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold"
                                                >
                                                    Close
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
