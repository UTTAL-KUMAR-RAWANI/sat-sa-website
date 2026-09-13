'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    supervisionApi,
    SupervisoryDecisionItem,
} from '@/lib/api/supervision';
import {
    Gavel,
    RefreshCw,
    Search,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Shield,
    FileText,
    ExternalLink,
    Check,
    X,
    Filter,
} from 'lucide-react';

export default function SupervisoryDecisionsPage() {
    const [decisions, setDecisions] = useState<SupervisoryDecisionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [selectedDecision, setSelectedDecision] = useState<SupervisoryDecisionItem | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const loadDecisions = async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (typeFilter !== 'ALL') params.decision_type = typeFilter;

            const data = await supervisionApi.getDecisions(params);
            setDecisions(data);
        } catch (err) {
            console.error('Failed to load decisions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDecisions();
    }, [statusFilter, typeFilter]);

    const handleApprove = async (id: string) => {
        if (!confirm('Confirm formal approval and sign-off for this supervisory decision?')) return;
        try {
            setActionLoading(true);
            await supervisionApi.approveDecision(id);
            await loadDecisions();
            if (selectedDecision && selectedDecision.id === id) {
                const updated = await supervisionApi.getDecision(id);
                setSelectedDecision(updated);
            }
        } catch (err: any) {
            alert('Failed to approve decision: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const filteredDecisions = decisions.filter(d => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            d.business_id?.toLowerCase().includes(q) ||
            d.supervisory_case_business_id?.toLowerCase().includes(q) ||
            d.supervisory_case_title?.toLowerCase().includes(q) ||
            d.rationale?.toLowerCase().includes(q) ||
            d.decision_maker_name?.toLowerCase().includes(q)
        );
    });

    const getDecisionTypeBadge = (type: string) => {
        switch (type) {
            case 'REQUIRE_ACTION':
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'CONTINUE_MONITORING':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'CLOSE':
                return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'ESCALATE':
                return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
            case 'ACCEPT_RISK':
                return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
            case 'REQUEST_REVIEW':
                return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
            default:
                return 'bg-slate-800 text-slate-400 border border-slate-700';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
            case 'PENDING_APPROVAL':
                return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            case 'REJECTED':
                return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
            case 'ENACTED':
                return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
            default:
                return 'bg-slate-700 text-slate-300 border-slate-600';
        }
    };

    const totalCount = decisions.length;
    const pendingCount = decisions.filter(d => d.status === 'PENDING_APPROVAL').length;
    const approvedCount = decisions.filter(d => d.status === 'APPROVED' || d.status === 'ENACTED').length;
    const actionRequiredCount = decisions.filter(d => d.decision_type === 'REQUIRE_ACTION').length;

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Gavel className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Supervisory Decisions</h1>
                    </div>
                    <p className="text-sm text-slate-400">
                        Authoritative determinations, regulatory orders, and binding supervisory actions
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadDecisions}
                        disabled={loading}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <Link
                        href="/supervision/cases"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        <Shield className="w-3.5 h-3.5" />
                        View Cases Registry
                    </Link>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Decisions</span>
                        <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-2xl font-bold text-white mt-2">{totalCount}</div>
                    <p className="text-xs text-slate-500 mt-1">Recorded supervisory determinations</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Sign-off</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">{pendingCount}</div>
                    <p className="text-xs text-slate-500 mt-1">Awaiting authority validation</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Approved & Enacted</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">{approvedCount}</div>
                    <p className="text-xs text-slate-500 mt-1">Binding authority determinations</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action Orders</span>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-300 mt-2">{actionRequiredCount}</div>
                    <p className="text-xs text-slate-500 mt-1">Remediation mandate required</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search ID, case ID, rationale, decision maker..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">Type:</span>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="ALL">All Types</option>
                            <option value="REQUIRE_ACTION">Require Action</option>
                            <option value="CONTINUE_MONITORING">Continue Monitoring</option>
                            <option value="CLOSE">Close</option>
                            <option value="ESCALATE">Escalate</option>
                            <option value="ACCEPT_RISK">Accept Risk</option>
                            <option value="REQUEST_REVIEW">Request Review</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="ENACTED">Enacted</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Decisions Table */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                                <th className="p-3.5">Decision ID</th>
                                <th className="p-3.5">Supervisory Case</th>
                                <th className="p-3.5">Determination</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5">Authority / Signer</th>
                                <th className="p-3.5">Effective / Review Date</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                                        Loading supervisory determinations...
                                    </td>
                                </tr>
                            ) : filteredDecisions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No supervisory decisions match your filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredDecisions.map((decision) => (
                                    <tr
                                        key={decision.id}
                                        className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedDecision(decision)}
                                    >
                                        <td className="p-3.5 font-mono text-indigo-400 font-medium">
                                            {decision.business_id}
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex flex-col">
                                                <Link
                                                    href={`/supervision/cases/${decision.supervisory_case_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-mono text-slate-300 hover:text-indigo-400 flex items-center gap-1 font-semibold"
                                                >
                                                    {decision.supervisory_case_business_id || decision.supervisory_case_id.slice(0, 8)}
                                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                                </Link>
                                                <span className="text-slate-400 line-clamp-1 max-w-xs text-[11px]">
                                                    {decision.supervisory_case_title || 'Untitled Case'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getDecisionTypeBadge(decision.decision_type)}`}>
                                                {decision.decision_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(decision.status)}`}>
                                                {decision.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-300">
                                            {decision.decision_maker_name || 'System / Unassigned'}
                                        </td>
                                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                                            <div>Eff: {decision.effective_date ? new Date(decision.effective_date).toLocaleDateString() : 'Immediate'}</div>
                                            {decision.review_date && (
                                                <div className="text-slate-500 text-[10px]">Rev: {new Date(decision.review_date).toLocaleDateString()}</div>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                                            {decision.status === 'PENDING_APPROVAL' && (
                                                <button
                                                    onClick={() => handleApprove(decision.id)}
                                                    disabled={actionLoading}
                                                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-medium transition-colors"
                                                >
                                                    Approve
                                                </button>
                                            )}
                                            <Link
                                                href={`/supervision/cases/${decision.supervisory_case_id}`}
                                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                                            >
                                                Case <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Decision Detail Drawer Modal */}
            {selectedDecision && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                    <Gavel className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-white">{selectedDecision.business_id}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(selectedDecision.status)}`}>
                                            {selectedDecision.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">Binding Supervisory Authority Determination</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDecision(null)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Determination Type</span>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold ${getDecisionTypeBadge(selectedDecision.decision_type)}`}>
                                        {selectedDecision.decision_type.replace('_', ' ')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Authority Signer</span>
                                    <span className="text-white font-medium mt-1 block">
                                        {selectedDecision.decision_maker_name || 'Authority'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Supervisory Case</span>
                                    <Link
                                        href={`/supervision/cases/${selectedDecision.supervisory_case_id}`}
                                        className="text-indigo-400 font-mono hover:underline mt-1 inline-flex items-center gap-1"
                                    >
                                        {selectedDecision.supervisory_case_business_id || selectedDecision.supervisory_case_id}
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Recorded Timestamp</span>
                                    <span className="text-slate-300 font-mono mt-1 block">
                                        {new Date(selectedDecision.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-slate-300 font-semibold mb-1.5 uppercase text-[11px] tracking-wider">Supervisory Rationale</h4>
                                <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedDecision.rationale}
                                </div>
                            </div>

                            {selectedDecision.action_required && (
                                <div>
                                    <h4 className="text-amber-400 font-semibold mb-1.5 uppercase text-[11px] tracking-wider">Mandatory Actions Required</h4>
                                    <div className="p-3.5 bg-amber-950/10 rounded-xl border border-amber-500/20 text-amber-200 whitespace-pre-wrap leading-relaxed">
                                        {selectedDecision.action_required}
                                    </div>
                                </div>
                            )}

                            {selectedDecision.conditions && (
                                <div>
                                    <h4 className="text-slate-300 font-semibold mb-1.5 uppercase text-[11px] tracking-wider">Binding Conditions & Undertakings</h4>
                                    <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed">
                                        {selectedDecision.conditions}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                                    <span className="text-slate-500 text-[11px]">Effective Date:</span>
                                    <p className="text-slate-200 font-mono font-medium mt-0.5">
                                        {selectedDecision.effective_date ? new Date(selectedDecision.effective_date).toLocaleDateString() : 'Immediate upon signing'}
                                    </p>
                                </div>
                                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                                    <span className="text-slate-500 text-[11px]">Next Review Date:</span>
                                    <p className="text-slate-200 font-mono font-medium mt-0.5">
                                        {selectedDecision.review_date ? new Date(selectedDecision.review_date).toLocaleDateString() : 'None stipulated'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
                            <Link
                                href={`/supervision/cases/${selectedDecision.supervisory_case_id}`}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                Open Full Case Dossier <ExternalLink className="w-3 h-3" />
                            </Link>

                            <div className="flex items-center gap-2">
                                {selectedDecision.status === 'PENDING_APPROVAL' && (
                                    <button
                                        onClick={() => handleApprove(selectedDecision.id)}
                                        disabled={actionLoading}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Approve & Enact Decision
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedDecision(null)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
