"use client";

import React from "react";
import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    className?: string;
}

export default function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    className = "",
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 ${className}`}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-3.5">
                {icon || <FolderOpen className="h-6 w-6" />}
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
                {description}
            </p>

            {actionLabel && (actionHref || onAction) && (
                <div>
                    {actionHref ? (
                        <Link
                            href={actionHref}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{actionLabel}</span>
                        </Link>
                    ) : (
                        <button
                            onClick={onAction}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{actionLabel}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
