"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason?: string) => Promise<void> | void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    requireReason?: boolean;
    reasonPlaceholder?: string;
    variant?: "danger" | "warning" | "primary";
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    requireReason = false,
    reasonPlaceholder = "Enter justification or operational rationale...",
    variant = "danger",
}: ConfirmDialogProps) {
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (requireReason && !reason.trim()) {
            setError("Operational justification is required.");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            await onConfirm(reason.trim() || undefined);
            setReason("");
            onClose();
        } catch (err: any) {
            setError(err.message || "Action failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const confirmBtnStyles = {
        danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40",
        warning: "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-amber-900/40",
        primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">{title}</h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

                {error && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleConfirm} className="space-y-4">
                    {requireReason && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                Operational Justification *
                            </label>
                            <textarea
                                rows={3}
                                required={requireReason}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={reasonPlaceholder}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none leading-relaxed"
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 ${confirmBtnStyles[variant]}`}
                        >
                            {submitting ? "Processing..." : confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
