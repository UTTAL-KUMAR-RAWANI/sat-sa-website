'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    supervisionApi,
    SupervisoryCaseItem,
    TimelineEvent,
} from '@/lib/api/supervision';
import { useAuth } from '@/lib/auth/AuthContext';
import { Permissions, hasPermission } from '@/lib/rbac/permissions';
import ActivityTimeline from '@/components/common/ActivityTimeline';
import {
    Gavel,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    ArrowLeft,
    Send,
    UserCheck,
    Check,
    RotateCcw,
    XCircle,
    Plus,
    Building2,
    Layers,
    Calendar,
    ChevronRight,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';

export default function SupervisoryCaseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const id = params.id as string;

    const [caseData, setCaseData] = useState<SupervisoryCaseItem | null>(null);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Analyst Review Inputs
    const [analystNotes, setAnalystNotes] = useState('');
    const [recommendationText, setRecommendationText] = useState('');

    // Authority Decision Inputs
    const [decisionType, setDecisionType] = useState<string>('REQUIRE_ACTION');
    const [rationale, setRationale] = useState('');
    const [actionRequired, setActionRequired] = useState('');
    const [conditions, setConditions] = useState('');
    const [effectiveDate, setEffectiveDate] = useState('');
    const [reviewDate, setReviewDate] = useState('');

    // Supervisory Finding Modal
    const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
    const [fndTitle, setFndTitle] = useState('');
    const [fndDesc, setFndDesc] = useState('');
    const [fndSeverity, setFndSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
    const [fndPriority, setFndPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

    const loadCase = async () => {
        try {
            setLoading(true);
            const [data, tl] = await Promise.all([
                supervisionApi.getCase(id),
                supervisionApi.getTimeline(id),
            ]);
            setCaseData(data);
            setTimeline(tl);
            if (data.analyst_notes) setAnalystNotes(data.analyst_notes);
            if (data.recommendation) setRecommendationText(data.recommendation);
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to load case dossier.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) loadCase();
    }, [id]);

    const handleStartReview = async () => {
        try {
            setActionLoading(true);
            await supervisionApi.startReview(id, { analyst_notes: analystNotes });
            await loadCase();
        } catch (err: any) {
            alert('Failed to start review: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitRecommendation = async () => {
        if (!recommendationText.trim()) {
            alert('Please provide a substantive supervisory recommendation.');
            return;
        }
        try {
            setActionLoading(true);
            await supervisionApi.submitRecommendation(id, {
                recommendation: recommendationText,
                analyst_notes: analystNotes,
                target_status: 'RECOMMENDATION_READY',
            });
            await loadCase();
        } catch (err: any) {
            alert('Failed to submit recommendation: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestRework = async () => {
        const comments = prompt('Provide required revision comments for the analyst:');
        if (!comments) return;
        try {
            setActionLoading(true);
            await supervisionApi.requestReview(id, { comments });
            await loadCase();
        } catch (err: any) {
            alert('Failed to request rework: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecordDecision = async () => {
        if (!rationale.trim()) {
            alert('Formal decision rationale is mandatory.');
            return;
        }
        try {
            setActionLoading(true);
            await supervisionApi.recordDecision(id, {
                decision_type: decisionType,
                rationale,
                action_required: actionRequired || undefined,
                conditions: conditions || undefined,
                effective_date: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
                review_date: reviewDate ? new Date(reviewDate).toISOString() : undefined,
            });
            await loadCase();
        } catch (err: any) {
            alert('Failed to render decision: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateSupervisoryFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fndTitle.trim()) return;
        try {
            setActionLoading(true);
            await supervisionApi.createSupervisoryFinding(id, {
                title: fndTitle,
                description: fndDesc,
                severity: fndSeverity,
                priority: fndPriority,
                remediation_required: true,
            });
            setIsFindingModalOpen(false);
            setFndTitle('');
            setFndDesc('');
            await loadCase();
        } catch (err: any) {
            alert('Failed to create supervisory finding: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCloseCase = async () => {
        const reason = prompt('Specify case resolution and closure summary:');
        if (!reason) return;
        try {
            setActionLoading(true);
            await supervisionApi.closeCase(id, { reason });
            await loadCase();
        } catch (err: any) {
            alert('Failed to close case: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-16 text-center text-xs text-slate-400 animate-pulse">
                Loading supervisory case dossier...
            </div>
        );
    }

    if (error || !caseData) {
        return (
            <div className="p-8 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Case Not Found</h3>
                <p className="text-xs text-slate-400">{error || 'Unable to locate supervisory case record.'}</p>
                <Link href="/supervision/cases" className="text-xs text-amber-400 hover:underline">
                    &larr; Return to Cases Dossier
                </Link>
            </div>
        );
    }

    const steps = [
        'OPEN',
        'ASSIGNED',
        'UNDER_REVIEW',
        'RECOMMENDATION_READY',
        'DECISION_REQUIRED',
        'ACTION_REQUIRED',
        'MONITORING',
        'CLOSED',
    ];

    const currentStepIndex = steps.indexOf(caseData.status);

    // Separation of Duties check
    const isAnalyst = caseData.assigned_analyst_id && user?.id === caseData.assigned_analyst_id;
    const canMakeAuthorityDecision = hasPermission(user, Permissions.SUPERVISION_DECIDE) || hasPermission(user, Permissions.SUPERVISION_APPROVE);
    const sodBlocked = isAnalyst && canMakeAuthorityDecision;

    return (
        <div className="space-y-6 animate-in fade-in duration-150 pb-16">
            {/* Top Navigation */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                    <Link
                        href="/supervision/cases"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm font-bold text-amber-400">{caseData.business_id}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                caseData.priority === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                caseData.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                'bg-slate-700 text-slate-300'
                            }`}>
                                {caseData.priority}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                {caseData.trigger_type}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">{caseData.title}</h1>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {caseData.status !== 'CLOSED' && (
                        <button
                            onClick={handleCloseCase}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                        >
                            Close Case
                        </button>
                    )}
                </div>
            </div>

            {/* Lifecycle Status Stepper */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between overflow-x-auto pb-2">
                    {steps.map((step, idx) => {
                        const isDone = currentStepIndex > idx || caseData.status === 'CLOSED';
                        const isCurrent = caseData.status === step;
                        return (
                            <div key={step} className="flex items-center space-x-2 shrink-0">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                                    isCurrent ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' :
                                    isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                    'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}>
                                    {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                                </div>
                                <span className={`text-[11px] font-semibold ${
                                    isCurrent ? 'text-amber-400' : isDone ? 'text-slate-200' : 'text-slate-500'
                                }`}>
                                    {step.replace('_', ' ')}
                                </span>
                                {idx < steps.length - 1 && (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 mx-1 shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Traceability Source Chain Banner */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/20 rounded-xl space-y-2">
                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Complete Upstream Traceability Chain</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {caseData.source_cse_id ? (
                        <Link
                            href={`/cse/${caseData.source_cse_id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-sky-500/40 text-sky-300 rounded font-mono font-medium flex items-center space-x-1"
                        >
                            <span>CSE: {caseData.source_cse_business_id || 'View CSE'}</span>
                            <ExternalLink className="w-3 h-3 text-sky-400" />
                        </Link>
                    ) : (
                        <span className="text-slate-500 text-xs italic">No CSE Link</span>
                    )}

                    <span className="text-slate-600">&rarr;</span>

                    {caseData.source_finding_id ? (
                        <Link
                            href={`/findings/${caseData.source_finding_id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 rounded font-mono font-medium flex items-center space-x-1"
                        >
                            <span>Finding: {caseData.source_finding_business_id || 'View Finding'}</span>
                            <ExternalLink className="w-3 h-3 text-amber-400" />
                        </Link>
                    ) : (
                        <span className="text-slate-500 text-xs italic">No Finding Link</span>
                    )}

                    <span className="text-slate-600">&rarr;</span>

                    {caseData.source_risk_id ? (
                        <Link
                            href={`/risks/${caseData.source_risk_id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-rose-300 rounded font-mono font-medium flex items-center space-x-1"
                        >
                            <span>Risk: {caseData.source_risk_business_id || 'View Risk'}</span>
                            <ExternalLink className="w-3 h-3 text-rose-400" />
                        </Link>
                    ) : (
                        <span className="text-slate-500 text-xs italic">No Risk Link</span>
                    )}

                    <span className="text-slate-600">&rarr;</span>

                    {caseData.source_remediation_id ? (
                        <Link
                            href={`/remediations/${caseData.source_remediation_id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300 rounded font-mono font-medium flex items-center space-x-1"
                        >
                            <span>Remediation: {caseData.source_remediation_business_id || 'View Remediation'}</span>
                            <ExternalLink className="w-3 h-3 text-emerald-400" />
                        </Link>
                    ) : (
                        <span className="text-slate-500 text-xs italic">No Remediation Link</span>
                    )}
                </div>
            </div>

            {/* Grid layout: Dossier details & Analyst review vs Decision Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Dossier, Review, Findings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Case Overview Dossier */}
                    <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Supervisory File Scope & Description
                        </h3>
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {caseData.description || 'No detailed scope description registered.'}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                            <div>
                                <span className="text-slate-500 block">Organization:</span>
                                <span className="text-slate-200 font-medium">{caseData.organization_name || 'Enterprise'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Sector:</span>
                                <span className="text-slate-200 font-medium">{caseData.sector_name || 'All Sectors'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Assigned Analyst:</span>
                                <span className="text-slate-200 font-medium">{caseData.assigned_analyst_name || 'Unassigned'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Target Resolution:</span>
                                <span className="text-slate-200 font-mono font-medium">
                                    {caseData.due_date ? new Date(caseData.due_date).toLocaleDateString() : '—'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Analyst Review & Recommendation Panel */}
                    <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white tracking-wide">
                                    Supervision Analyst Review & Recommendation
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Technical evaluation, anomaly identification, and proposed directive
                                </p>
                            </div>
                            <button
                                onClick={() => setIsFindingModalOpen(true)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Supervisory Finding</span>
                            </button>
                        </div>

                        {/* Analysis Notes */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Technical Review & Investigative Notes
                            </label>
                            <textarea
                                rows={3}
                                value={analystNotes}
                                onChange={(e) => setAnalystNotes(e.target.value)}
                                placeholder="Record technical findings, evidence verification results, threat actor attribution notes..."
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Recommendation Text */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Proposed Supervisory Recommendation
                            </label>
                            <textarea
                                rows={3}
                                value={recommendationText}
                                onChange={(e) => setRecommendationText(e.target.value)}
                                placeholder="Formulate clear directive recommendation for the Supervisory Authority..."
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end space-x-3 pt-2">
                            {caseData.status === 'ASSIGNED' && (
                                <button
                                    onClick={handleStartReview}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                                >
                                    Start Review
                                </button>
                            )}

                            {['ASSIGNED', 'UNDER_REVIEW'].includes(caseData.status) && (
                                <button
                                    onClick={handleSubmitRecommendation}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Submit Recommendation to Authority</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Timeline & Audit Stream */}
                    <ActivityTimeline resourceType="SUPERVISORY_CASE" resourceId={caseData.id} />
                </div>

                {/* Right Column: Authority Final Decision Panel (SoD Enforced) */}
                <div className="space-y-6">
                    <div className="p-5 bg-slate-900/70 border border-amber-500/30 rounded-xl space-y-4 shadow-xl">
                        <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                <Gavel className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white tracking-wide">
                                    Supervisory Authority Final Decision
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Separation of Duties (SoD) Enforced
                                </p>
                            </div>
                        </div>

                        {/* Existing Decision display if already decided */}
                        {caseData.final_decision && (
                            <div className="p-4 bg-slate-800/60 border border-amber-500/20 rounded-lg space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Determined Decision:</span>
                                    <span className="font-bold text-amber-400">{caseData.final_decision}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block">Authority Rationale:</span>
                                    <span className="text-slate-200 font-medium">{caseData.decision_reason}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/50">
                                    Decided By: {caseData.decided_by_name || 'Supervisory Authority'} on {caseData.decided_at ? new Date(caseData.decided_at).toLocaleDateString() : '—'}
                                </div>
                            </div>
                        )}

                        {/* Separation of Duties Warning */}
                        {sodBlocked && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 space-y-1">
                                <div className="font-bold flex items-center space-x-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Separation of Duties Lock</span>
                                </div>
                                <div>
                                    You are the assigned analyst who formulated the recommendation. The final decision must be rendered by an independent Supervisory Authority.
                                </div>
                            </div>
                        )}

                        {/* Decision Form */}
                        {caseData.status !== 'CLOSED' && (
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Supervisory Determination Type
                                    </label>
                                    <select
                                        value={decisionType}
                                        onChange={(e) => setDecisionType(e.target.value)}
                                        disabled={sodBlocked || !canMakeAuthorityDecision}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    >
                                        <option value="REQUIRE_ACTION">REQUIRE ACTION - Mandate Remediation Directive</option>
                                        <option value="CONTINUE_MONITORING">CONTINUE MONITORING - Place on Watchlist</option>
                                        <option value="ESCALATE">ESCALATE - Ministry / Law Enforcement</option>
                                        <option value="ACCEPT_RISK">ACCEPT RISK - Formal Supervisory Concurrence</option>
                                        <option value="REQUEST_REVIEW">REQUEST REVIEW - Return to Analyst for Rework</option>
                                        <option value="CLOSE">CLOSE - Issue Formally Resolved</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Authority Rationale & Legal/Regulatory Basis <span className="text-rose-400">*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        required
                                        value={rationale}
                                        onChange={(e) => setRationale(e.target.value)}
                                        disabled={sodBlocked || !canMakeAuthorityDecision}
                                        placeholder="State statutory justification and regulatory conditions..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Mandated Corrective Action
                                    </label>
                                    <input
                                        type="text"
                                        value={actionRequired}
                                        onChange={(e) => setActionRequired(e.target.value)}
                                        disabled={sodBlocked || !canMakeAuthorityDecision}
                                        placeholder="e.g. Deploy hardware HSM within 14 calendar days"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Effective Date</label>
                                        <input
                                            type="date"
                                            value={effectiveDate}
                                            onChange={(e) => setEffectiveDate(e.target.value)}
                                            disabled={sodBlocked || !canMakeAuthorityDecision}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">Review Date</label>
                                        <input
                                            type="date"
                                            value={reviewDate}
                                            onChange={(e) => setReviewDate(e.target.value)}
                                            disabled={sodBlocked || !canMakeAuthorityDecision}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleRequestRework}
                                        disabled={actionLoading || sodBlocked || !canMakeAuthorityDecision}
                                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                                    >
                                        Return for Review
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRecordDecision}
                                        disabled={actionLoading || sodBlocked || !canMakeAuthorityDecision}
                                        className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Recording...' : 'Render Decision'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Supervisory Finding Creation Modal */}
            {isFindingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
                            <h3 className="text-base font-bold text-white">Issue Supervisory Finding</h3>
                            <button onClick={() => setIsFindingModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreateSupervisoryFinding} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Finding Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={fndTitle}
                                    onChange={(e) => setFndTitle(e.target.value)}
                                    placeholder="e.g. Failure to maintain isolated telemetry interfaces"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Finding Description</label>
                                <textarea
                                    rows={3}
                                    value={fndDesc}
                                    onChange={(e) => setFndDesc(e.target.value)}
                                    placeholder="Provide detailed non-compliance or vulnerability observation..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
                                    <select
                                        value={fndSeverity}
                                        onChange={(e: any) => setFndSeverity(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="CRITICAL">CRITICAL</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                                    <select
                                        value={fndPriority}
                                        onChange={(e: any) => setFndPriority(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="CRITICAL">P1 - CRITICAL</option>
                                        <option value="HIGH">P2 - HIGH</option>
                                        <option value="MEDIUM">P3 - MEDIUM</option>
                                        <option value="LOW">P4 - LOW</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsFindingModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20"
                                >
                                    Create Finding
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
