'use client';

import React, { useState } from 'react';
import { supervisionApi, EscalationItem } from '@/lib/api/supervision';
import { ShieldAlert, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface EscalateModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceType: 'CSE' | 'FINDING' | 'RISK' | 'REMEDIATION' | 'ASSESSMENT';
    resourceId: string;
    resourceBusinessId: string;
    resourceTitle: string;
    onSuccess?: (escalation: EscalationItem) => void;
}

export const EscalateModal: React.FC<EscalateModalProps> = ({
    isOpen,
    onClose,
    resourceType,
    resourceId,
    resourceBusinessId,
    resourceTitle,
    onSuccess,
}) => {
    const [reason, setReason] = useState('');
    const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
    const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
    const [level, setLevel] = useState<'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'>('LEVEL_2');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('Please provide a substantive justification for supervisory escalation.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const escalation = await supervisionApi.createEscalation({
                resource_type: resourceType,
                resource_id: resourceId,
                reason,
                severity,
                priority,
                level,
                due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
            });
            setSuccess(true);
            setTimeout(() => {
                onSuccess?.(escalation);
                onClose();
            }, 1200);
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to submit escalation to Supervision.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-wide">Escalate to Cyber Supervision</h3>
                            <p className="text-xs text-slate-400">
                                Transmit {resourceType} <span className="font-mono text-amber-400">{resourceBusinessId}</span> to the Supervisory Authority
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {success ? (
                    <div className="p-8 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                        <h4 className="text-lg font-bold text-white">Supervisory Escalation Registered</h4>
                        <p className="text-sm text-slate-300">
                            A formal supervisory case has been created and assigned for review.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-rose-400 text-sm">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Resource Context Card */}
                        <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs space-y-1">
                            <div className="text-slate-400">Subject Entity:</div>
                            <div className="font-medium text-slate-200 truncate">{resourceTitle}</div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Escalation Rationale & Threat Context <span className="text-rose-400">*</span>
                            </label>
                            <textarea
                                required
                                rows={3}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Explain why supervisory oversight or higher authority intervention is required..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Form Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
                                <select
                                    value={severity}
                                    onChange={(e: any) => setSeverity(e.target.value)}
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
                                    value={priority}
                                    onChange={(e: any) => setPriority(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="CRITICAL">P1 - CRITICAL</option>
                                    <option value="HIGH">P2 - HIGH</option>
                                    <option value="MEDIUM">P3 - MEDIUM</option>
                                    <option value="LOW">P4 - LOW</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Escalation Tier</label>
                                <select
                                    value={level}
                                    onChange={(e: any) => setLevel(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="LEVEL_1">LEVEL 1 - Operational</option>
                                    <option value="LEVEL_2">LEVEL 2 - Supervisory</option>
                                    <option value="LEVEL_3">LEVEL 3 - Authority Directive</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Response Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
                            >
                                {loading ? 'Submitting...' : 'Confirm Escalation'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
