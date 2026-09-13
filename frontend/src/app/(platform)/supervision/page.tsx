'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    supervisionApi,
    SupervisionSummary,
    SupervisoryCaseItem,
    EscalationItem,
} from '@/lib/api/supervision';
import {
    Gavel,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Flame,
    ArrowUpRight,
    RefreshCw,
    Play,
    Plus,
    Filter,
    FileText,
    ExternalLink,
} from 'lucide-react';

export default function SupervisionDashboardPage() {
    const [summary, setSummary] = useState<SupervisionSummary | null>(null);
    const [priorityCases, setPriorityCases] = useState<SupervisoryCaseItem[]>([]);
    const [criticalEscalations, setCriticalEscalations] = useState<EscalationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanRunning, setScanRunning] = useState(false);
    const [scanMessage, setScanMessage] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const [sumData, casesData, escData] = await Promise.all([
                supervisionApi.getSummary(),
                supervisionApi.getCases({ limit: 8 }),
                supervisionApi.getEscalations({ severity: 'CRITICAL', limit: 5 }),
            ]);
            setSummary(sumData);
            setPriorityCases(casesData);
            setCriticalEscalations(escData);
        } catch (err) {
            console.error('Failed to load supervision dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRunAutoScan = async () => {
        try {
            setScanRunning(true);
            setScanMessage(null);
            const res = await supervisionApi.triggerAutoScan();
            setScanMessage(`Scan complete: ${res.triggered_count} auto-escalation(s) triggered.`);
            await loadData();
        } catch (err: any) {
            setScanMessage('Scan failed: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setScanRunning(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            {/* Header with Sub-Nav and Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
                            <Gavel className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Supervisory Authority & Oversight</h1>
                            <p className="text-xs text-slate-400">
                                Cross-sector cyber threat governance, critical escalation triage, and authoritative directives
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleRunAutoScan}
                        disabled={scanRunning}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanRunning ? 'animate-spin' : ''}`} />
                        <span>{scanRunning ? 'Scanning...' : 'Trigger Auto-Escalation Scan'}</span>
                    </button>
                    <Link
                        href="/supervision/cases"
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>View All Cases</span>
                    </Link>
                </div>
            </div>

            {/* Notification Banner if scan ran */}
            {scanMessage && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{scanMessage}</span>
                    </div>
                    <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
            )}

            {/* Secondary Navigation Strip */}
            <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-2">
                <Link
                    href="/supervision"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"
                >
                    Supervisory Overview
                </Link>
                <Link
                    href="/supervision/cases"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                    Case Dossiers ({summary?.open_cases ?? 0})
                </Link>
                <Link
                    href="/supervision/escalations"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                    Escalations Queue ({summary?.critical_escalations ?? 0})
                </Link>
                <Link
                    href="/supervision/decisions"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                    Authority Decisions ({summary?.cases_awaiting_authority ?? 0})
                </Link>
            </div>

            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Open Cases</div>
                    <div className="text-2xl font-bold text-white mt-1">{summary?.open_cases ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Active supervision</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-rose-500/30 rounded-xl">
                    <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Critical Esc.</div>
                    <div className="text-2xl font-bold text-rose-400 mt-1">{summary?.critical_escalations ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Unresolved Level 3</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Awaiting Auth.</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{summary?.cases_awaiting_authority ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Decision queue</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Monitoring</div>
                    <div className="text-2xl font-bold text-indigo-400 mt-1">{summary?.cases_under_monitoring ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Post-decision track</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High Findings</div>
                    <div className="text-2xl font-bold text-slate-200 mt-1">{summary?.high_risk_findings ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Scoped open findings</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Critical Risks</div>
                    <div className="text-2xl font-bold text-slate-200 mt-1">{summary?.critical_risks ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Score &ge; 17/25</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Overdue Rem.</div>
                    <div className="text-2xl font-bold text-amber-500 mt-1">{summary?.overdue_remediations ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">SLA breaches</div>
                </div>

                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Decisions</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{summary?.pending_decisions ?? 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Formal records</div>
                </div>
            </div>

            {/* Main Content Grid: Priority Queue & Escalations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Priority Cases Queue (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Flame className="w-4 h-4 text-amber-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                                Priority Supervisory Queue
                            </h2>
                        </div>
                        <Link href="/supervision/cases" className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1">
                            <span>View registry</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-xs text-slate-400">Loading cases...</div>
                        ) : priorityCases.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">No active supervisory cases.</div>
                        ) : (
                            <div className="divide-y divide-slate-800/60">
                                {priorityCases.map((c) => (
                                    <Link
                                        key={c.id}
                                        href={`/supervision/cases/${c.id}`}
                                        className="block p-4 hover:bg-slate-800/40 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-mono text-xs font-semibold text-amber-400">
                                                        {c.business_id}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        c.priority === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                                        c.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                        'bg-slate-700/50 text-slate-300'
                                                    }`}>
                                                        {c.priority}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                                                        {c.trigger_type}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
                                                    {c.title}
                                                </div>
                                                <div className="text-xs text-slate-400 line-clamp-1">
                                                    {c.description || 'No description provided'}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0 space-y-1.5">
                                                <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                    c.status === 'ACTION_REQUIRED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse' :
                                                    c.status === 'AUTHORITY_REVIEW' || c.status === 'DECISION_REQUIRED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                                    c.status === 'MONITORING' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' :
                                                    c.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                                    'bg-slate-800 text-slate-300 border border-slate-700'
                                                }`}>
                                                    {c.status}
                                                </span>
                                                <div className="text-[10px] text-slate-500">
                                                    {c.assigned_analyst_name ? `Analyst: ${c.assigned_analyst_name}` : 'Unassigned'}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Critical Escalations Strip (1 col) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                                Critical Escalations
                            </h2>
                        </div>
                        <Link href="/supervision/escalations" className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1">
                            <span>Queue</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden p-4 space-y-3">
                        {criticalEscalations.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                                No unresolved critical escalations.
                            </div>
                        ) : (
                            criticalEscalations.map((e) => (
                                <div
                                    key={e.id}
                                    className="p-3 bg-slate-800/40 border border-rose-500/20 rounded-lg space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-semibold text-rose-400">{e.business_id}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                            {e.level}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-200 font-medium line-clamp-2">
                                        {e.reason}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-700/50">
                                        <span>Source: {e.resource_type}</span>
                                        <span className="font-medium text-amber-400">{e.status}</span>
                                    </div>
                                </div>
                            ))
                        )}

                        <div className="pt-2">
                            <Link
                                href="/supervision/escalations"
                                className="w-full block py-2 text-center text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Open Escalation Triage Desk
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
