"use client";

import React from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export default function ErrorBanner({
    message,
    onRetry,
    onDismiss,
    className = "",
}: ErrorBannerProps) {
    return (
        <div
            className={`flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 shadow-sm ${className}`}
        >
            <div className="flex items-center gap-2.5 flex-1">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="leading-relaxed font-medium">{message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-1 rounded bg-rose-500/20 hover:bg-rose-500/30 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors"
                    >
                        <RefreshCw className="h-3 w-3" />
                        <span>Retry</span>
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="rounded p-1 text-rose-400 hover:bg-rose-500/20 hover:text-white transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
